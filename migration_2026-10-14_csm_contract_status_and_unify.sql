-- One canonical customer base, independent contract lifecycle for CSM. 2026-10-14.
-- SQL is transactional. Only four confirmed CSM-only UUIDs can be linked.
-- Never create salary_contracts, salary_payments or fake signing dates.
begin;

create table if not exists public.csm_contract_statuses(
 camp_id uuid primary key references public.csm_camps(id) on delete cascade,
 sales_client_id uuid not null references public.salary_clients(id) on delete cascade,
 status text not null check(status in ('active','paused','terminated','not_formalized')),
 signed_date date,
 updated_at timestamptz not null default now()
);
alter table public.csm_contract_statuses enable row level security;
revoke all on public.csm_contract_statuses from public, anon, authenticated;
grant select on public.csm_contract_statuses to authenticated;
drop policy if exists csm_contract_statuses_select on public.csm_contract_statuses;
create policy csm_contract_statuses_select on public.csm_contract_statuses
for select to authenticated using (
 public.csm_is_manager() or (
   public.csm_is_active_user() and exists(
     select 1 from public.csm_camps c
     where c.id=camp_id and c.responsible_id=auth.uid()
   )
 )
);

create or replace function campbox_internal.refresh_csm_contract_status(p_sales_client_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare
 v_status text;
 v_signed_date date;
begin
 if p_sales_client_id is null then return; end if;
 select sc.status,sc.signed_date into v_status,v_signed_date
 from public.salary_contracts sc where sc.client_id=p_sales_client_id
 order by coalesce(sc.signed_date,sc.created_at::date) desc,sc.created_at desc,sc.id desc
 limit 1;
 insert into public.csm_contract_statuses(camp_id,sales_client_id,status,signed_date,updated_at)
 select c.id,c.sales_client_id,
   case when v_status in ('active','paused','terminated') then v_status else 'not_formalized' end,
   v_signed_date,now()
 from public.csm_camps c where c.sales_client_id=p_sales_client_id
 on conflict(camp_id) do update set
 sales_client_id=excluded.sales_client_id,
 status=excluded.status,
 signed_date=excluded.signed_date,
 updated_at=now();
end;
$function$;
revoke all on function campbox_internal.refresh_csm_contract_status(uuid)
from public,anon,authenticated;

create or replace function campbox_internal.on_salary_contract_csm_status()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if tg_op='DELETE' then
   perform campbox_internal.refresh_csm_contract_status(old.client_id);
   return old;
 end if;
 perform campbox_internal.refresh_csm_contract_status(new.client_id);
 if tg_op='UPDATE' and old.client_id is distinct from new.client_id then
   perform campbox_internal.refresh_csm_contract_status(old.client_id);
 end if;
 return new;
end;
$function$;
revoke all on function campbox_internal.on_salary_contract_csm_status()
from public,anon,authenticated;
drop trigger if exists salary_contracts_sync_csm_status on public.salary_contracts;
create trigger salary_contracts_sync_csm_status
after insert or update or delete on public.salary_contracts
for each row execute function campbox_internal.on_salary_contract_csm_status();

create or replace function campbox_internal.on_csm_camp_contract_status()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if new.sales_client_id is null then
   delete from public.csm_contract_statuses where camp_id=new.id;
 else
   perform campbox_internal.refresh_csm_contract_status(new.sales_client_id);
 end if;
 return new;
end;
$function$;
revoke all on function campbox_internal.on_csm_camp_contract_status()
from public,anon,authenticated;
drop trigger if exists csm_camps_sync_contract_status on public.csm_camps;
create trigger csm_camps_sync_contract_status
after insert or update of sales_client_id on public.csm_camps
for each row execute function campbox_internal.on_csm_camp_contract_status();

-- Link only exact, already-existing CSM identities; do not merge or rename them.
do $block$
declare
  v_expected uuid[] := array[
    '3a1f0582-44be-401e-9150-05f8c2406af5'::uuid, -- Воток (preserve entered spelling)
    '489db763-a49c-461c-b271-a6a18c9898e1'::uuid, -- Каникулы Афанасий
    '85d414f0-c0b2-4826-add2-167f45a06c88'::uuid, -- Молния
    'cda37fb0-9791-49e4-917d-d62735de74f3'::uuid  -- ФОК Гагаринский
  ];
  v_linked integer;
begin
 if (select count(*) from public.csm_camps where id=any(v_expected) and sales_client_id is null)<>4
 then raise exception 'Expected 4 CSM-only rows; stop to avoid merging live data'; end if;
 if exists(select 1 from public.csm_camps c where c.id=any(v_expected) and
   not ((c.id='3a1f0582-44be-401e-9150-05f8c2406af5' and c.name='Воток') or
        (c.id='489db763-a49c-461c-b271-a6a18c9898e1' and c.name='Каникулы Афанасий') or
        (c.id='85d414f0-c0b2-4826-add2-167f45a06c88' and c.name='Молния') or
        (c.id='cda37fb0-9791-49e4-917d-d62735de74f3' and c.name='ФОК Гагаринский')))
 then raise exception 'CSM names changed: manual reconciliation is required';end if;
 if exists(select 1 from public.salary_clients s join public.csm_camps c on c.id=any(v_expected)
   where pg_catalog.regexp_replace(pg_catalog.lower(s.client_name),'[^[:alnum:]]','','g')
      = pg_catalog.regexp_replace(pg_catalog.lower(c.name),'[^[:alnum:]]','','g'))
 then raise exception 'Sales client name already exists; do not create duplicates';end if;
 insert into public.salary_clients(client_name,active,notes,contractor_id,signed_date,created_by)
 select c.name,c.active,'Из КСМ: подтверждение договора не получено. Договор не оформлен; без начисления мотивации.',
        null,null,null from public.csm_camps c where c.id=any(v_expected);
 -- Existing salary_clients trigger reuses the original CSM UUID and work history.
 select count(*) into v_linked from public.csm_camps c join public.salary_clients s
 on s.id=c.sales_client_id where c.id=any(v_expected)
 and pg_catalog.regexp_replace(pg_catalog.lower(c.name),'[^[:alnum:]]','','g')
   = pg_catalog.regexp_replace(pg_catalog.lower(s.client_name),'[^[:alnum:]]','','g');
 if v_linked<>4 then raise exception 'CSM linking failed; rolling back all changes';end if;
 if exists(select 1 from public.salary_contracts sc join public.csm_camps c
     on c.sales_client_id=sc.client_id where c.id=any(v_expected))
 then raise exception 'Unexpected salary contract; rolling back'; end if;
end;
$block$;

-- Backfill current contract states for all linked camps (no Sales wages touched).
select campbox_internal.refresh_csm_contract_status(sales_client_id)
from public.csm_camps where sales_client_id is not null;

commit;
