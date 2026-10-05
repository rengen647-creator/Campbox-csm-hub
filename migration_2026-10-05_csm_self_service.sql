-- Apply once in Supabase SQL Editor for the existing CSM Hub database.
-- 2026-10-05: active CSM users can add/edit shared features and questions.

drop policy if exists csm_features_insert on public.csm_features;
create policy csm_features_insert on public.csm_features for insert to authenticated
with check (public.csm_is_active_user());

drop policy if exists csm_features_update on public.csm_features;
create policy csm_features_update on public.csm_features for update to authenticated
using (public.csm_is_active_user()) with check (public.csm_is_active_user());

drop policy if exists csm_profile_fields_insert on public.csm_profile_fields;
create policy csm_profile_fields_insert on public.csm_profile_fields for insert to authenticated
with check (public.csm_is_active_user());

drop policy if exists csm_profile_fields_update on public.csm_profile_fields;
create policy csm_profile_fields_update on public.csm_profile_fields for update to authenticated
using (public.csm_is_active_user()) with check (public.csm_is_active_user());

-- Delete permissions remain manager-only.
