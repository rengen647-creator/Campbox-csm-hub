-- CSM-only analytics participation flag. Does NOT replace Sales-owned csm_camps.active.
-- Additive migration, default preserves the current eligibility of every camp.
begin;
alter table public.csm_camps
  add column if not exists csm_reporting_active boolean not null default true;
comment on column public.csm_camps.csm_reporting_active is
  'CSM-controlled participation in feature, discovery and operations analytics; Sales sync never updates this field.';
-- Existing csm_camps UPDATE RLS restricts writes to active CSM managers.
-- Do not change Sales sync triggers, contract status, names or access policies.
commit;
