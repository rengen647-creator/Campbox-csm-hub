-- CampBox unified lifecycle: READ ONLY diagnostics.
-- Execute with authorized read-only access. Does not expose client PII.
-- Counts are snapshots; no mutation and no data backup.
select 'salary_clients' entity, count(*) count from public.salary_clients
union all select 'salary_contracts',count(*) from public.salary_contracts
union all select 'csm_camps',count(*) from public.csm_camps
union all select 'csm_onboarding_tasks',count(*) from public.csm_onboarding_tasks
union all select 'sales_handoff_statuses',count(*) from public.sales_handoff_statuses
union all select 'salary_retentions',count(*) from public.salary_retentions;

-- Existing linkage health
select count(*) as camps_total,
 count(*) filter (where sales_client_id is null) as without_sales_link,
 count(*) filter (where responsible_id is null) as without_csm_owner,
 count(*) filter (where active is true) as active_sales,
 count(*) filter (where active is true and csm_reporting_active is true) as effective_csm_reporting_active
from public.csm_camps;

-- Warning-only diagnostics: do NOT deduplicate by contract_number!
select count(*) as contracts_total,
 count(*) filter (where sales_source_contract_key is null) as without_source_key,
 count(distinct sales_source_contract_key) as distinct_source_keys
from public.salary_contracts;

-- Index/RLS status (metadata only)
select tablename,rowsecurity from pg_tables
where schemaname='public' and tablename in
 ('salary_clients','salary_contracts','daily_sales','csm_camps','sales_handoff_statuses','csm_onboarding_tasks','salary_retentions')
order by tablename;
