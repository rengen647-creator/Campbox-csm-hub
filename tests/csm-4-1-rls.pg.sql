-- Isolated PostgreSQL role/RLS contract test for staged CSM reporting status.
-- CI ONLY: never connected to user Supabase project or production data.
\set ON_ERROR_STOP on
create schema if not exists auth;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $$;
grant usage on schema public,auth to authenticated;
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant execute on function auth.uid() to authenticated;
create table public.csm_memberships (
 user_id uuid primary key,
 role text not null check (role in ('manager','csm')),
 active boolean not null default false,
 archived boolean not null default false
);
create table public.csm_camps (
 id uuid primary key,
 name text not null,
 responsible_id uuid,
 active boolean not null default true,
 contract_number text
);
create table public.csm_camp_features (
 camp_id uuid not null references public.csm_camps(id),
 feature_id uuid not null,
 status text not null,
 primary key(camp_id,feature_id)
);
create table public.csm_camp_profile_values (
 camp_id uuid not null references public.csm_camps(id),
 field_id uuid not null,
 value_text text not null,
 primary key(camp_id,field_id)
);
create table public.csm_contacts (
 id uuid primary key,
 camp_id uuid not null references public.csm_camps(id),
 contact_date date not null,
 comment text
);
create function public.csm_is_active_user() returns boolean
language sql stable security definer set search_path=public as $$
 select exists (select 1 from public.csm_memberships
 where user_id=auth.uid() and active=true and archived=false)
$$;
create function public.csm_is_manager() returns boolean
language sql stable security definer set search_path=public as $$
 select exists (select 1 from public.csm_memberships
 where user_id=auth.uid() and active=true and archived=false and role='manager')
$$;
alter table public.csm_camps enable row level security;
grant select,update on public.csm_camps to authenticated;
create policy csm_camps_select on public.csm_camps for select to authenticated
using (public.csm_is_manager() or (public.csm_is_active_user() and responsible_id=auth.uid()));
create policy csm_camps_update on public.csm_camps for update to authenticated
using (public.csm_is_manager()) with check (public.csm_is_manager());
-- Match the actual production policy expression; no special migration-granted write privileges.
insert into public.csm_memberships(user_id,role,active,archived) values
 ('10000000-0000-4000-8000-000000000001','manager',true,false),
 ('20000000-0000-4000-8000-000000000002','csm',true,false),
 ('30000000-0000-4000-8000-000000000003','csm',true,false);
insert into public.csm_camps(id,name,responsible_id,active,contract_number) values
 ('40000000-0000-4000-8000-000000000001','Active assigned','20000000-0000-4000-8000-000000000002',true,'SHARED-1'),
 ('40000000-0000-4000-8000-000000000002','CSM inactive candidate','20000000-0000-4000-8000-000000000002',true,'SHARED-1'),
 ('40000000-0000-4000-8000-000000000003','Sales inactive','30000000-0000-4000-8000-000000000003',false,'SIGNED-2'),
 ('40000000-0000-4000-8000-000000000004','Other team','30000000-0000-4000-8000-000000000003',true,'SIGNED-3');
insert into public.csm_camp_features(camp_id,feature_id,status) values
 ('40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Перешёл'),
 ('40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001','Не начато'),
 ('40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','Не требуется');
insert into public.csm_camp_profile_values(camp_id,field_id,value_text) values
 ('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Да'),
 ('40000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','Не выяснено');
insert into public.csm_contacts(id,camp_id,contact_date,comment) values
 ('70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','2026-09-02','Historical work'),
 ('70000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','2026-10-10','Current work');
-- Verify additive migration on existing populated rows.
\ir ../migrations/20261028_csm_reporting_active.sql
do $$
begin
 if (select count(*) from public.csm_camps where csm_reporting_active=true)<>4
   then raise exception 'A01 existing rows did not default true'; end if;
 if (select count(*) from public.csm_camps where active=true)<>3
   then raise exception 'A01 migration altered Sales-owned active'; end if;
 if (select count(*) from public.csm_camps where contract_number='SHARED-1')<>2
   then raise exception 'A23 shared contract was changed'; end if;
 if not (select relrowsecurity from pg_class where oid='public.csm_camps'::regclass)
   then raise exception 'RLS unexpectedly disabled'; end if;
end $$;
-- Signed-in CSM #2 sees own clients but cannot update them directly.
set role authenticated;
set request.jwt.claim.sub='20000000-0000-4000-8000-000000000002';
do $$
declare n int;
begin
 select count(*) into n from public.csm_camps;
 if n<>2 then raise exception 'RLS read scope wrong: %', n; end if;
 update public.csm_camps set csm_reporting_active=false where name='CSM inactive candidate';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'A08 CSM employee changed reporting status'; end if;
 update public.csm_camps set active=false where name='Active assigned';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Employee modified Sales-owned active'; end if;
end $$;
reset role;
-- Signed-in manager switches state, sees returned row, reloads with separate statement.
set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$
declare n int; observed boolean;
begin
 select count(*) into n from public.csm_camps;
 if n<>4 then raise exception 'Manager does not see entire manager portfolio'; end if;
 update public.csm_camps set csm_reporting_active=false
 where id='40000000-0000-4000-8000-000000000002'
 returning csm_reporting_active into observed;
 if observed is distinct from false then raise exception 'Manager write did not confirm false'; end if;
 select csm_reporting_active into observed from public.csm_camps
 where id='40000000-0000-4000-8000-000000000002';
 if observed is distinct from false then raise exception 'A09 manager state not durable after reload statement'; end if;
 update public.csm_camps set csm_reporting_active=false
 where id='00000000-0000-0000-0000-000000000000';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'A10 zero-row update unexpectedly succeeded'; end if;
end $$;
reset role;
-- Sales sync simulation: update only Sales-owned active, preserve independent reporting status.
update public.csm_camps set active=false
 where id='40000000-0000-4000-8000-000000000002';
do $$
declare isactive boolean; flag boolean; n int;
begin
 select active,csm_reporting_active into isactive,flag from public.csm_camps
 where id='40000000-0000-4000-8000-000000000002';
 if isactive<>false or flag<>false then raise exception 'A04 inactive Sales changed CSM flag'; end if;
 select count(*) into n from public.csm_contacts where camp_id='40000000-0000-4000-8000-000000000002';
 if n<>1 then raise exception 'A21 history lost during inactivity'; end if;
 if (select count(*) from public.csm_camp_features where camp_id='40000000-0000-4000-8000-000000000002')<>1
  then raise exception 'A02 feature history lost'; end if;
 if (select count(*) from public.csm_camp_profile_values where camp_id='40000000-0000-4000-8000-000000000002')<>1
  then raise exception 'A17 question history lost'; end if;
end $$;
-- Restore only Sales-owned active; independent reporting flag remains excluded.
update public.csm_camps set active=true where id='40000000-0000-4000-8000-000000000002';
do $$ begin
 if (select csm_reporting_active from public.csm_camps where name='CSM inactive candidate')<>false
   then raise exception 'A05 Sales reactivation wrongly resets CSM flag'; end if;
end $$;
-- A03 manager reactivation is durable.
set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
update public.csm_camps set csm_reporting_active=true where name='CSM inactive candidate';
do $$ begin
 if (select csm_reporting_active from public.csm_camps where name='CSM inactive candidate') is distinct from true
  then raise exception 'A03 CSM reactivation not durable'; end if;
end $$;
reset role;
-- Other employee cannot see other team at all.
set role authenticated;
set request.jwt.claim.sub='30000000-0000-4000-8000-000000000003';
do $$ declare n int;
begin
 select count(*) into n from public.csm_camps;
 if n<>2 then raise exception 'CSM cross-owner read leak'; end if;
 update public.csm_camps set csm_reporting_active=false where name='Active assigned';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'CSM cross-owner UPDATE leak'; end if;
end $$;
reset role;
select 'PASS isolated PostgreSQL SQL migration + RLS manager/employee, persistence, shared contracts, history and Sales-active independence' as qa_result;