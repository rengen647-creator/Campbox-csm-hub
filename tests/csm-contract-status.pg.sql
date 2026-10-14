\set ON_ERROR_STOP on
-- Ephemeral PostgreSQL 17 database, no connection to production.
create schema auth;
create schema campbox_internal;
do $$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
end$$;
create function auth.uid() returns uuid language sql stable as
$$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function public.csm_is_manager() returns boolean language sql stable
as $$ select auth.uid()='11111111-1111-4111-8111-111111111111'::uuid $$;
create function public.csm_is_active_user() returns boolean language sql stable
as $$ select auth.uid() is not null $$;
create table public.salary_clients(
  id uuid primary key default gen_random_uuid(),client_name text not null,
  active boolean not null default true,notes text,contractor_id uuid,signed_date date,
  created_by uuid,updated_at timestamptz default now()
);
create table public.csm_camps(
  id uuid primary key default gen_random_uuid(),
  name text not null,active boolean not null default true,
  responsible_id uuid,sales_client_id uuid unique
);
create table public.salary_contracts(
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.salary_clients(id),
  status text not null,signed_date date,created_at timestamptz default now()
);
-- Fixture of the existing Sales -> CSM trigger (reusing same camp ID).
create or replace function campbox_internal.fixture_sales_to_csm()
returns trigger language plpgsql security definer set search_path='' as $f$
begin
  update public.csm_camps set sales_client_id=new.id where
  sales_client_id is null and name=new.client_name;
  if not found then
    insert into public.csm_camps(name,sales_client_id,active)
      values(new.client_name,new.id,new.active);
  end if;
  return new;
end $f$;
create trigger salary_clients_sync_to_csm after insert
on public.salary_clients for each row
execute function campbox_internal.fixture_sales_to_csm();
insert into public.csm_camps(id,name,active) values
 ('3a1f0582-44be-401e-9150-05f8c2406af5','Воток',true),
 ('489db763-a49c-461c-b271-a6a18c9898e1','Каникулы Афанасий',true),
 ('85d414f0-c0b2-4826-add2-167f45a06c88','Молния',true),
 ('cda37fb0-9791-49e4-917d-d62735de74f3','ФОК Гагаринский',true);
insert into public.salary_clients(client_name) values ('Активный'),('На паузе'),('Расторгнут');
insert into public.salary_contracts(client_id,status,signed_date)
select s.id,case when s.client_name='Активный' then 'active'
                 when s.client_name='На паузе' then 'paused' else 'terminated' end,
       '2026-09-01'::date
from public.salary_clients s;
\i migration_2026-10-14_csm_contract_status_and_unify.sql
do $$
begin
 if (select count(*) from public.salary_clients)<>7 then raise exception 'Expected 7 Sales rows';end if;
 if (select count(*) from public.csm_camps)<>7 then raise exception 'CSM history/card recreated';end if;
 if (select count(*) from public.csm_contract_statuses)<>7 then raise exception 'Missing statuses';end if;
 if (select count(*) from public.csm_contract_statuses where status='not_formalized')<>4
 then raise exception 'Unsiged CSM camps got fake contract';end if;
 if (select count(*) from public.salary_contracts)<>3 then raise exception 'Fake salary contract created';end if;
 if (select count(*) from public.csm_contract_statuses where status='active')<>1 then raise exception 'Active status missing';end if;
 if (select count(*) from public.csm_contract_statuses where status='paused')<>1 then raise exception 'Paused status missing';end if;
 if (select count(*) from public.csm_contract_statuses where status='terminated')<>1 then raise exception 'Terminated status missing';end if;
 if (select count(*) from public.csm_camps where sales_client_id is null)<>0 then raise exception 'Unlinked CSM';end if;
end$$;
update public.salary_contracts set status='active'
where client_id=(select id from public.salary_clients where client_name='На паузе');
do $$begin
 if(select count(*) from public.csm_contract_statuses where status='paused')<>0
 then raise exception 'Status not refreshed when Sales resumes';end if;
end$$;
update public.salary_contracts set status='terminated'
where client_id=(select id from public.salary_clients where client_name='Активный');
do $$begin
 if(select count(*) from public.csm_contract_statuses where status='terminated')<>2
 then raise exception 'Termination not synchronized';end if;
end$$;
-- Role access: manager sees all, a different unassigned CSM sees none.
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant select on public.csm_camps to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$begin
 if(select count(*) from public.csm_contract_statuses)<>0 then
 raise exception 'CSM RLS leaked unassigned camp statuses'; end if;
end$$;
reset role;
select 'CSM_CONTRACT_STATUS_INTEGRATION_OK' as result;
