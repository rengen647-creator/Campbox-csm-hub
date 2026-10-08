-- Manager-only CSM cleanup: merge CSM-only duplicates into an existing Sales camp,
-- or delete an unused CSM-only camp. No existing camp is modified during installation.
begin;

create schema if not exists campbox_internal;
revoke all on schema campbox_internal from public, anon, authenticated;

-- Durable pre-operation snapshots: keep source/target field versions for audit/recovery.
create table if not exists campbox_internal.csm_camp_cleanup_log (
  id uuid primary key default gen_random_uuid(),
  action text not null check(action in ('merge','delete')),
  actor_id uuid not null,
  source_id uuid not null,
  source_name text not null,
  target_id uuid,
  target_name text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
revoke all on table campbox_internal.csm_camp_cleanup_log from public,anon,authenticated;

-- Prevent direct deletion through Data API (including Sales-originated camps).
drop policy if exists csm_camps_delete on public.csm_camps;
revoke delete on public.csm_camps from authenticated, anon;

create or replace function public.csm_manager_merge_camp(p_source uuid, p_target uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_source public.csm_camps%rowtype;
  v_target public.csm_camps%rowtype;
  v_contacts integer := 0;
  v_launches integer := 0;
  v_features integer := 0;
  v_profiles integer := 0;
begin
  if v_actor is null or not exists (
    select 1 from public.csm_memberships
    where user_id=v_actor and role='manager' and active and not archived
  ) then
    raise exception 'Действие доступно только руководителю КСМ' using errcode='42501';
  end if;
  if p_source is null or p_target is null or p_source=p_target then
    raise exception 'Выбери два разных лагеря';
  end if;

  -- Lock the whole operation and both camp rows consistently.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('campbox:csm-manager-cleanup'));
  perform 1 from public.csm_camps where id in (p_source,p_target) order by id for update;

  select * into v_source from public.csm_camps where id=p_source;
  select * into v_target from public.csm_camps where id=p_target;
  if v_source.id is null or v_target.id is null then
    raise exception 'Лагерь не найден; обнови страницу';
  end if;
  if v_source.sales_client_id is not null then
    raise exception 'Лагерь из Sales нельзя объединять как дубль';
  end if;
  if v_target.sales_client_id is null then
    raise exception 'Основной лагерь должен быть связан с Sales';
  end if;

  insert into campbox_internal.csm_camp_cleanup_log(
    action,actor_id,source_id,source_name,target_id,target_name,snapshot
  ) values (
    'merge',v_actor,v_source.id,v_source.name,v_target.id,v_target.name,
    jsonb_build_object(
      'source',to_jsonb(v_source),'target',to_jsonb(v_target),
      'source_contacts',coalesce((select jsonb_agg(to_jsonb(x)) from public.csm_contacts x where x.camp_id=p_source),'[]'::jsonb),
      'source_launches',coalesce((select jsonb_agg(to_jsonb(x)) from public.csm_camp_launches x where x.camp_id=p_source),'[]'::jsonb),
      'source_features',coalesce((select jsonb_agg(to_jsonb(x)) from public.csm_camp_features x where x.camp_id=p_source),'[]'::jsonb),
      'target_features',coalesce((select jsonb_agg(to_jsonb(x)) from public.csm_camp_features x where x.camp_id=p_target),'[]'::jsonb),
      'source_profile',coalesce((select jsonb_agg(to_jsonb(x)) from public.csm_camp_profile_values x where x.camp_id=p_source),'[]'::jsonb),
      'target_profile',coalesce((select jsonb_agg(to_jsonb(x)) from public.csm_camp_profile_values x where x.camp_id=p_target),'[]'::jsonb)
    )
  );

  -- Retain all chronological contact and launch records under the stable Sales camp ID.
  update public.csm_contacts set camp_id=p_target where camp_id=p_source;
  get diagnostics v_contacts = row_count;
  update public.csm_camp_launches set camp_id=p_target where camp_id=p_source;
  get diagnostics v_launches = row_count;
  -- csm_launch_checkpoints link to launch IDs and therefore follow automatically.

  select count(*) into v_features from public.csm_camp_features where camp_id=p_source;
  insert into public.csm_camp_features(
    camp_id,feature_id,status,planned_date,training_date,activated_at,reason,comment,updated_by
  )
  select p_target,feature_id,status,planned_date,training_date,activated_at,reason,comment,updated_by
  from public.csm_camp_features where camp_id=p_source
  on conflict(camp_id,feature_id) do update set
    status=case when public.csm_camp_features.status='Не начато'
      then excluded.status else public.csm_camp_features.status end,
    planned_date=coalesce(public.csm_camp_features.planned_date,excluded.planned_date),
    training_date=coalesce(public.csm_camp_features.training_date,excluded.training_date),
    activated_at=coalesce(public.csm_camp_features.activated_at,excluded.activated_at),
    reason=case
      when nullif(btrim(excluded.reason),'') is null then public.csm_camp_features.reason
      when nullif(btrim(public.csm_camp_features.reason),'') is null then excluded.reason
      when btrim(public.csm_camp_features.reason)=btrim(excluded.reason) then public.csm_camp_features.reason
      else public.csm_camp_features.reason || E'\nИз объединённого лагеря «' || v_source.name || '»: ' || excluded.reason end,
    comment=case
      when nullif(btrim(excluded.comment),'') is null then public.csm_camp_features.comment
      when nullif(btrim(public.csm_camp_features.comment),'') is null then excluded.comment
      when btrim(public.csm_camp_features.comment)=btrim(excluded.comment) then public.csm_camp_features.comment
      else public.csm_camp_features.comment || E'\nИз объединённого лагеря «' || v_source.name || '»: ' || excluded.comment end,
    updated_by=coalesce(public.csm_camp_features.updated_by,excluded.updated_by);

  select count(*) into v_profiles from public.csm_camp_profile_values where camp_id=p_source;
  insert into public.csm_camp_profile_values(camp_id,field_id,value_text,details,updated_by)
  select p_target,field_id,value_text,details,updated_by
  from public.csm_camp_profile_values where camp_id=p_source
  on conflict(camp_id,field_id) do update set
    value_text=case
      when nullif(btrim(public.csm_camp_profile_values.value_text),'') is null
        or public.csm_camp_profile_values.value_text='Не выяснено'
      then excluded.value_text
      else public.csm_camp_profile_values.value_text end,
    details=case
      when nullif(btrim(excluded.details),'') is null then public.csm_camp_profile_values.details
      when nullif(btrim(public.csm_camp_profile_values.details),'') is null then excluded.details
      when btrim(public.csm_camp_profile_values.details)=btrim(excluded.details) then public.csm_camp_profile_values.details
      else public.csm_camp_profile_values.details || E'\nИз объединённого лагеря «' || v_source.name || '»: '
        || coalesce(excluded.value_text,'') || ' — ' || excluded.details end,
    updated_by=coalesce(public.csm_camp_profile_values.updated_by,excluded.updated_by);

  -- Existing Sales name, link and owner win, except we adopt source owner if unset.
  if v_target.responsible_id is null and v_source.responsible_id is not null then
    update public.csm_camps set responsible_id=v_source.responsible_id where id=p_target;
  end if;

  -- Cascade removes only now-merged source rows (every original version is in the log).
  delete from public.csm_camps where id=p_source and sales_client_id is null;
  if not found then raise exception 'Не удалось удалить дубликат; операция отменена'; end if;

  return jsonb_build_object('ok',true,'contacts',v_contacts,'launches',v_launches,
    'features',v_features,'profiles',v_profiles,'source',v_source.name,'target',v_target.name);
end
$fn$;

create or replace function public.csm_manager_delete_camp(p_camp uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_camp public.csm_camps%rowtype;
begin
  if v_actor is null or not exists (
    select 1 from public.csm_memberships
    where user_id=v_actor and role='manager' and active and not archived
  ) then raise exception 'Действие доступно только руководителю КСМ' using errcode='42501'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('campbox:csm-manager-cleanup'));
  select * into v_camp from public.csm_camps where id=p_camp for update;
  if v_camp.id is null then raise exception 'Лагерь не найден; обнови страницу'; end if;
  if v_camp.sales_client_id is not null then
    raise exception 'Удаление лагеря из Sales запрещено';
  end if;

  -- Deleting a manually added camp with work would erase its history.
  -- Require merge instead; only empty / never used CSM cards can be removed.
  if exists(select 1 from public.csm_contacts where camp_id=p_camp)
     or exists(select 1 from public.csm_camp_launches where camp_id=p_camp)
     or exists(
       select 1 from public.csm_camp_features where camp_id=p_camp
       and (status<>'Не начато' or planned_date is not null or training_date is not null
         or activated_at is not null or nullif(btrim(reason),'') is not null
         or nullif(btrim(comment),'') is not null)
     ) or exists(
       select 1 from public.csm_camp_profile_values where camp_id=p_camp
       and (coalesce(nullif(btrim(value_text),''),'Не выяснено')<>'Не выяснено'
         or nullif(btrim(details),'') is not null)
     )
  then
    raise exception 'У лагеря уже есть рабочие данные. Сначала объедини его с лагерем из Sales, чтобы сохранить историю.';
  end if;

  insert into campbox_internal.csm_camp_cleanup_log(
    action,actor_id,source_id,source_name,snapshot
  ) values (
    'delete',v_actor,v_camp.id,v_camp.name,
    jsonb_build_object('source',to_jsonb(v_camp),
      'features',coalesce((select jsonb_agg(to_jsonb(x)) from public.csm_camp_features x where x.camp_id=p_camp),'[]'::jsonb),
      'profile',coalesce((select jsonb_agg(to_jsonb(x)) from public.csm_camp_profile_values x where x.camp_id=p_camp),'[]'::jsonb))
  );
  delete from public.csm_camps where id=p_camp and sales_client_id is null;
  if not found then raise exception 'Удаление не удалось; операция отменена'; end if;
  return jsonb_build_object('ok',true,'deleted',v_camp.name);
end
$fn$;

revoke all on function public.csm_manager_merge_camp(uuid,uuid) from public,anon,authenticated;
revoke all on function public.csm_manager_delete_camp(uuid) from public,anon,authenticated;
grant execute on function public.csm_manager_merge_camp(uuid,uuid) to authenticated;
grant execute on function public.csm_manager_delete_camp(uuid) to authenticated;

commit;