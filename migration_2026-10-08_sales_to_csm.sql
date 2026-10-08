-- CampBox · Sales -> CSM. Apply ONCE (safe to rerun) in the existing Supabase SQL Editor.
-- Source of truth: public.salary_clients (both active and archived).
-- Destination: public.csm_camps. Do NOT touch CSM contacts, features, launches or responsible on updates.
-- Needs an active CSM manager membership to assign newly created cards.
-- No direct Bitrix integration.

begin;

alter table public.csm_camps
  add column if not exists sales_client_id text;

create unique index if not exists csm_camps_sales_client_id_uq
  on public.csm_camps (sales_client_id)
  where sales_client_id is not null;

create table if not exists public.csm_sales_sync_conflicts (
  sales_client_id text primary key,
  client_name text not null,
  reason text not null,
  detected_at timestamptz not null default now()
);
alter table public.csm_sales_sync_conflicts enable row level security;

create or replace function public.csm_apply_salary_client(
  p_id text, p_name text, p_active boolean
) returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_camp_id public.csm_camps.id%type;
  v_matches integer;
  v_owner public.csm_memberships.user_id%type;
  v_norm_name text;
begin
  if p_id is null or nullif(btrim(p_name), '') is null then
    return;
  end if;

  -- Transactions for one client/name serialize; repeated backfill is idempotent.
  v_norm_name := regexp_replace(lower(btrim(p_name)), '[[:space:]]+', ' ', 'g');
  perform pg_advisory_xact_lock(hashtext('campbox-sales-csm:' || v_norm_name));
  perform pg_advisory_xact_lock(hashtext('campbox-sales-id:' || p_id));

  -- Stable external ID protects all historical CSM activity on renames and renewals.
  select id into v_camp_id
  from public.csm_camps where sales_client_id = p_id limit 1;

  if v_camp_id is null then
    -- Reuse an existing CSM card only when its normalized name is unambiguous.
    select count(*) into v_matches
    from public.csm_camps
    where sales_client_id is null
      and regexp_replace(lower(btrim(name)), '[[:space:]]+', ' ', 'g') = v_norm_name;

    if v_matches > 1 then
      insert into public.csm_sales_sync_conflicts(sales_client_id,client_name,reason,detected_at)
      values(p_id,p_name,'Найдено несколько карточек КСМ с тем же названием; требуется ручное сопоставление',now())
      on conflict(sales_client_id)
      do update set client_name=excluded.client_name,reason=excluded.reason,detected_at=now();
      return;
    elsif v_matches = 1 then
      select id into v_camp_id
      from public.csm_camps
      where sales_client_id is null
        and regexp_replace(lower(btrim(name)), '[[:space:]]+', ' ', 'g') = v_norm_name
      limit 1;
    end if;
  end if;

  if v_camp_id is not null then
    update public.csm_camps
    set sales_client_id=p_id, name=btrim(p_name), active=coalesce(p_active,true)
    where id=v_camp_id;
  else
    -- Route unassigned new clients to the manager's intake queue, never to a random CSM.
    select user_id into v_owner
    from public.csm_memberships
    where active is true and coalesce(archived,false) is false and role='manager'
    order by user_id limit 1;

    if v_owner is null then
      insert into public.csm_sales_sync_conflicts(sales_client_id,client_name,reason,detected_at)
      values(p_id,p_name,'Нет активного руководителя CSM для первичного назначения',now())
      on conflict(sales_client_id)
      do update set client_name=excluded.client_name,reason=excluded.reason,detected_at=now();
      return;
    end if;

    insert into public.csm_camps(name,responsible_id,active,sales_client_id)
    values(btrim(p_name),v_owner,coalesce(p_active,true),p_id);
  end if;

  delete from public.csm_sales_sync_conflicts where sales_client_id=p_id;
end
$$;

create or replace function public.csm_salary_client_change()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform public.csm_apply_salary_client(new.id::text,new.client_name,new.active);
  return new;
exception when others then
  -- Never prevent a Sales contract/client write because CSM synchronization failed.
  begin
    insert into public.csm_sales_sync_conflicts(sales_client_id,client_name,reason,detected_at)
    values(new.id::text,coalesce(new.client_name,'Без названия'),left(sqlerrm,500),now())
    on conflict(sales_client_id)
    do update set client_name=excluded.client_name,reason=excluded.reason,detected_at=now();
  exception when others then
    raise warning 'CampBox CSM sync failed for salary client %: %',new.id,sqlerrm;
  end;
  return new;
end
$$;

drop trigger if exists salary_clients_sync_to_csm on public.salary_clients;
create trigger salary_clients_sync_to_csm
after insert or update of client_name,active
on public.salary_clients
for each row execute function public.csm_salary_client_change();

-- Initial backfill, including inactive clients (they remain in CSM archive).
do $$
declare r record;
begin
  for r in select id::text as id,client_name,active from public.salary_clients
           order by client_name,id
  loop
    perform public.csm_apply_salary_client(r.id,r.client_name,r.active);
  end loop;
end $$;

-- Read-only health endpoint. Checks only aggregate counts; no payroll/client details leak.
create or replace function public.csm_sales_sync_status()
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.csm_memberships
    where user_id=auth.uid() and active is true and coalesce(archived,false) is false
  ) then
    raise exception 'CSM access required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'total',count(*),
    'active',count(*) filter(where coalesce(s.active,true)),
    'linked',count(c.id),
    'ready_active',count(c.id) filter(where coalesce(s.active,true) and c.active is true),
    'missing',count(*) filter(where c.id is null),
    'conflicts',(select count(*) from public.csm_sales_sync_conflicts)
  ) into v_result
  from public.salary_clients s
  left join public.csm_camps c on c.sales_client_id=s.id::text;
  return v_result;
end $$;

revoke all on function public.csm_apply_salary_client(text,text,boolean) from public,anon,authenticated;
revoke all on function public.csm_salary_client_change() from public,anon,authenticated;
revoke all on function public.csm_sales_sync_status() from public,anon;
grant execute on function public.csm_sales_sync_status() to authenticated;

commit;

-- POST-CHECK (run in SQL Editor, not in a browser):
-- select public.csm_sales_sync_status(); -- requires CSM user JWT, SQL Editor can query table directly instead
-- select s.client_name,s.active,c.name as csm_name,c.active as csm_active,err.reason
-- from public.salary_clients s
-- left join public.csm_camps c on c.sales_client_id=s.id::text
-- left join public.csm_sales_sync_conflicts err on err.sales_client_id=s.id::text
-- where c.id is null or (coalesce(s.active,true) <> coalesce(c.active,true));
-- select * from public.csm_sales_sync_conflicts order by detected_at desc;
