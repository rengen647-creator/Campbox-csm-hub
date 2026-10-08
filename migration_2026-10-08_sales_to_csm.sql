-- CampBox Sales -> CSM, 2026-10-08.
-- Database verified: public.salary_clients and public.csm_camps in the SAME Supabase project.
-- Backfill is idempotent, linked by salary_clients.id, retaining existing CSM IDs and dependent history.
-- New camps are UNASSIGNED (responsible_id NULL): a manager assigns their CSM intentionally.
-- This script does not modify Bitrix, payroll amounts, CSM work history or contracts.
begin;

-- Private recovery snapshot created BEFORE changing the CSM camp table.
create schema if not exists campbox_internal;
revoke all on schema campbox_internal from public, anon, authenticated;
create table if not exists campbox_internal.csm_camps_before_sales_sync_20261008
  as table public.csm_camps;
revoke all on table campbox_internal.csm_camps_before_sales_sync_20261008
  from public, anon, authenticated;

-- Keep the CSM UUID stable; linked client UUID is never the CSM card UUID.
alter table public.csm_camps
  add column if not exists sales_client_id uuid
  references public.salary_clients(id) on delete set null;
create unique index if not exists csm_camps_sales_client_id_uq
  on public.csm_camps(sales_client_id) where sales_client_id is not null;

-- Private conflict queue. No browser access, no public RLS policy needed.
create table if not exists campbox_internal.csm_sales_sync_conflicts(
  sales_client_id uuid primary key,
  client_name text not null,
  reason text not null,
  detected_at timestamptz not null default now()
);

create or replace function campbox_internal.apply_salary_client(
  p_id uuid, p_name text, p_active boolean
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_camp_id uuid;
  v_matches integer;
  v_name_key text;
  v_linked_conflict integer;
begin
  if p_id is null or nullif(btrim(p_name), '') is null then
    return;
  end if;
  -- Punctuation and spacing normalize e.g. "Взлетай(Танай)" / "Взлетай (Танай)".
  v_name_key := regexp_replace(lower(p_name),'[^[:alnum:]]','','g');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('sales-csm:' || v_name_key));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('sales-csm-id:' || p_id::text));

  select id into v_camp_id from public.csm_camps
  where sales_client_id = p_id limit 1;

  if v_camp_id is null then
    -- Never steal another salary client's linked card.
    select count(*) into v_linked_conflict from public.csm_camps
    where sales_client_id is not null
      and regexp_replace(lower(name),'[^[:alnum:]]','','g') = v_name_key;
    if v_linked_conflict > 0 then
      insert into campbox_internal.csm_sales_sync_conflicts(sales_client_id,client_name,reason,detected_at)
      values(p_id,p_name,'Это название уже связано с другим Sales ID; требуется проверка',now())
      on conflict (sales_client_id) do update
      set client_name=excluded.client_name,reason=excluded.reason,detected_at=now();
      return;
    end if;

    select count(*) into v_matches from public.csm_camps
    where sales_client_id is null
      and regexp_replace(lower(name),'[^[:alnum:]]','','g') = v_name_key;
    if v_matches > 1 then
      insert into campbox_internal.csm_sales_sync_conflicts(sales_client_id,client_name,reason,detected_at)
      values(p_id,p_name,'Несколько существующих карточек КСМ с таким названием',now())
      on conflict (sales_client_id) do update
      set client_name=excluded.client_name,reason=excluded.reason,detected_at=now();
      return;
    end if;
    if v_matches = 1 then
      select id into v_camp_id from public.csm_camps
      where sales_client_id is null
        and regexp_replace(lower(name),'[^[:alnum:]]','','g') = v_name_key limit 1;
    end if;
  end if;

  if v_camp_id is null then
    -- No random manager or CSM assignment; queue is visible to CSM managers.
    insert into public.csm_camps(name,responsible_id,active,sales_client_id)
    values(btrim(p_name),null,coalesce(p_active,true),p_id);
  else
    -- Preserve responsible_id, CSM ID and all attached work.
    update public.csm_camps
    set name=btrim(p_name), active=coalesce(p_active,true),
        sales_client_id=p_id, updated_at=now()
    where id=v_camp_id;
  end if;
  delete from campbox_internal.csm_sales_sync_conflicts where sales_client_id=p_id;
end
$$;

create or replace function campbox_internal.on_salary_client_changed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform campbox_internal.apply_salary_client(new.id,new.client_name,new.active);
  return new;
exception when others then
  -- Keep Sales usable even if CSM sync encounters an unexpected conflict.
  begin
    insert into campbox_internal.csm_sales_sync_conflicts(sales_client_id,client_name,reason,detected_at)
    values(new.id,coalesce(new.client_name,'Без названия'),left(sqlerrm,500),now())
    on conflict(sales_client_id) do update
    set client_name=excluded.client_name,reason=excluded.reason,detected_at=now();
  exception when others then
    raise warning 'CSM sync failed, Sales client %: %',new.id,sqlerrm;
  end;
  return new;
end
$$;

drop trigger if exists salary_clients_sync_to_csm on public.salary_clients;
create trigger salary_clients_sync_to_csm
after insert or update of client_name,active on public.salary_clients
for each row execute function campbox_internal.on_salary_client_changed();

-- One-time copy of all 71 existing Sales clients, including terminated/archived.
do $$
declare r record;
begin
  for r in select id,client_name,active from public.salary_clients order by client_name,id loop
    perform campbox_internal.apply_salary_client(r.id,r.client_name,r.active);
  end loop;
end $$;

-- Browser only receives aggregate reconciliation; NO client names or salary data.
create or replace function public.csm_sales_sync_status()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not exists(
    select 1 from public.csm_memberships
    where user_id=auth.uid() and active=true and archived=false
  ) then
    raise exception 'CSM access required' using errcode='42501';
  end if;
  select jsonb_build_object(
    'total',count(*),
    'active',count(*) filter(where s.active),
    'linked',count(c.id),
    'ready_active',count(c.id) filter(where s.active and c.active),
    'missing',count(*) filter(where c.id is null),
    'unassigned',count(c.id) filter(where s.active and c.responsible_id is null),
    'conflicts',(select count(*) from campbox_internal.csm_sales_sync_conflicts)
  ) into v_result
  from public.salary_clients s
  left join public.csm_camps c on c.sales_client_id=s.id;
  return v_result;
end
$$;

revoke all on schema campbox_internal from public, anon, authenticated;
revoke all on function campbox_internal.apply_salary_client(uuid,text,boolean) from public,anon,authenticated;
revoke all on function campbox_internal.on_salary_client_changed() from public,anon,authenticated;
revoke all on function public.csm_sales_sync_status() from public,anon,authenticated;
grant execute on function public.csm_sales_sync_status() to authenticated;

commit;

-- Diagnostics (for SQL Editor admin only):
-- select count(*) from public.csm_camps;
-- select count(*) from public.salary_clients s left join public.csm_camps c
--   on c.sales_client_id=s.id where c.id is null;
-- select * from campbox_internal.csm_sales_sync_conflicts;
