-- Protect Sales identity against changing the origin through authenticated REST updates.
-- The Salary->CSM trigger uses its postgres-owned SECURITY DEFINER function,
-- so authoritative Sales name/link updates continue to work.
begin;
create or replace function campbox_internal.csm_guard_sales_identity()
returns trigger language plpgsql security invoker set search_path = ''
as $fn$
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    if new.sales_client_id is distinct from old.sales_client_id then
      raise exception 'Связь с Sales изменяется только автоматической синхронизацией' using errcode='42501';
    end if;
    if old.sales_client_id is not null and new.name is distinct from old.name then
      raise exception 'Название лагеря из Sales нельзя изменять в КСМ' using errcode='42501';
    end if;
  end if;
  return new;
end
$fn$;
revoke all on function campbox_internal.csm_guard_sales_identity() from public,anon,authenticated;
drop trigger if exists csm_camps_guard_sales_identity on public.csm_camps;
create trigger csm_camps_guard_sales_identity
before update of sales_client_id,name on public.csm_camps
for each row execute function campbox_internal.csm_guard_sales_identity();
commit;