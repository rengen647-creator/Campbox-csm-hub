-- CampBox CSM Hub — shared Supabase setup
-- Safe for the existing CampBox Sales Board project.
-- Shared: auth.users + public.profiles (identity only).
-- Independent: CSM memberships, roles, data and RLS.

create extension if not exists pgcrypto;

create table if not exists public.csm_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'csm' check (role in ('manager','csm')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.csm_memberships(user_id)
select id from auth.users
on conflict (user_id) do nothing;

create table if not exists public.csm_features (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.csm_camps (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  responsible_id uuid references auth.users(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.csm_profile_fields (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  field_type text not null default 'yes_no_unknown'
    check (field_type in ('yes_no_unknown','text','number','date','select')),
  options jsonb not null default '[]'::jsonb,
  details_label text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.csm_camp_profile_values (
  camp_id uuid not null references public.csm_camps(id) on delete cascade,
  field_id uuid not null references public.csm_profile_fields(id) on delete cascade,
  value_text text,
  details text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(camp_id, field_id)
);

create table if not exists public.csm_camp_features (
  camp_id uuid not null references public.csm_camps(id) on delete cascade,
  feature_id uuid not null references public.csm_features(id) on delete cascade,
  status text not null default 'Не начато'
    check (status in ('Не начато','Запланировано','Обучение','В работе','Перешёл','Не планирует','Не требуется')),
  planned_date date,
  training_date date,
  activated_at date,
  reason text,
  comment text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(camp_id, feature_id)
);

create table if not exists public.csm_contacts (
  id uuid primary key default gen_random_uuid(),
  contact_date date not null default current_date,
  camp_id uuid not null references public.csm_camps(id) on delete cascade,
  csm_id uuid not null references auth.users(id),
  feature_id uuid references public.csm_features(id),
  contact_type text not null
    check (contact_type in ('Звонок','Встреча','Обучение','Письмо','Чат','Напоминание','Проверка','Другое')),
  result text
    check (result in ('Не дозвонились','Связались','Обсудили','Обучили','Перешёл','Не готов','Не планирует','Требуется доработка','Другое')),
  next_step text,
  next_step_date date,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.csm_camp_launches (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.csm_camps(id) on delete cascade,
  responsible_id uuid not null references auth.users(id),
  shift_name text not null,
  start_date date,
  status text not null default 'Не выяснено'
    check (status in ('Не выяснено','Дата подтверждена','Подготовка','Готов к запуску','Запущена','Перенесена','Отменена')),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.csm_launch_checkpoints (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.csm_camp_launches(id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'Не начато'
    check (status in ('Не начато','В работе','Готово','Не требуется')),
  comment text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.csm_is_active_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.csm_memberships
    where user_id = auth.uid() and active = true
  );
$$;

create or replace function public.csm_is_manager()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.csm_memberships
    where user_id = auth.uid() and active = true and role = 'manager'
  );
$$;

create or replace function public.csm_can_access_camp(target_camp uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.csm_is_manager() or exists(
    select 1 from public.csm_camps c
    where c.id = target_camp
      and c.responsible_id = auth.uid()
      and c.active = true
      and public.csm_is_active_user()
  );
$$;

create or replace function public.csm_can_access_launch(target_launch uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.csm_camp_launches l
    where l.id = target_launch
      and public.csm_can_access_camp(l.camp_id)
  );
$$;

create or replace function public.csm_can_see_profile(target_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.csm_is_manager()
    or (
      public.csm_is_active_user()
      and exists(
        select 1 from public.csm_memberships m
        where m.user_id = target_user and m.active = true
      )
    );
$$;

create or replace function public.csm_touch_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists csm_memberships_touch on public.csm_memberships;
create trigger csm_memberships_touch before update on public.csm_memberships
for each row execute function public.csm_touch_updated_at();

drop trigger if exists csm_features_touch on public.csm_features;
create trigger csm_features_touch before update on public.csm_features
for each row execute function public.csm_touch_updated_at();

drop trigger if exists csm_camps_touch on public.csm_camps;
create trigger csm_camps_touch before update on public.csm_camps
for each row execute function public.csm_touch_updated_at();

drop trigger if exists csm_profile_fields_touch on public.csm_profile_fields;
create trigger csm_profile_fields_touch before update on public.csm_profile_fields
for each row execute function public.csm_touch_updated_at();

drop trigger if exists csm_camp_profile_values_touch on public.csm_camp_profile_values;
create trigger csm_camp_profile_values_touch before update on public.csm_camp_profile_values
for each row execute function public.csm_touch_updated_at();

drop trigger if exists csm_camp_features_touch on public.csm_camp_features;
create trigger csm_camp_features_touch before update on public.csm_camp_features
for each row execute function public.csm_touch_updated_at();

drop trigger if exists csm_camp_launches_touch on public.csm_camp_launches;
create trigger csm_camp_launches_touch before update on public.csm_camp_launches
for each row execute function public.csm_touch_updated_at();

drop trigger if exists csm_launch_checkpoints_touch on public.csm_launch_checkpoints;
create trigger csm_launch_checkpoints_touch before update on public.csm_launch_checkpoints
for each row execute function public.csm_touch_updated_at();

create or replace function public.csm_handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.csm_memberships(user_id,role,active)
  values(new.id,'csm',false)
  on conflict(user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_csm on auth.users;
create trigger on_auth_user_created_csm
after insert on auth.users
for each row execute procedure public.csm_handle_new_auth_user();

create or replace function public.csm_seed_feature_for_existing_camps()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.csm_camp_features(camp_id,feature_id,status)
  select c.id,new.id,'Не начато'
  from public.csm_camps c
  where c.active=true
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists csm_on_feature_created on public.csm_features;
create trigger csm_on_feature_created
after insert on public.csm_features
for each row execute function public.csm_seed_feature_for_existing_camps();

create or replace function public.csm_seed_camp_features()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.csm_camp_features(camp_id,feature_id,status)
  select new.id,f.id,'Не начато'
  from public.csm_features f
  where f.is_active=true
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists csm_on_camp_created on public.csm_camps;
create trigger csm_on_camp_created
after insert on public.csm_camps
for each row execute function public.csm_seed_camp_features();

create or replace function public.csm_auto_activation_date()
returns trigger language plpgsql
as $$
begin
  if new.status='Перешёл' and new.activated_at is null then
    new.activated_at=current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists csm_camp_feature_activation on public.csm_camp_features;
create trigger csm_camp_feature_activation
before insert or update on public.csm_camp_features
for each row execute function public.csm_auto_activation_date();

alter table public.csm_memberships enable row level security;
alter table public.csm_features enable row level security;
alter table public.csm_camps enable row level security;
alter table public.csm_profile_fields enable row level security;
alter table public.csm_camp_profile_values enable row level security;
alter table public.csm_camp_features enable row level security;
alter table public.csm_contacts enable row level security;
alter table public.csm_camp_launches enable row level security;
alter table public.csm_launch_checkpoints enable row level security;

revoke all on
  public.csm_memberships,
  public.csm_features,
  public.csm_camps,
  public.csm_profile_fields,
  public.csm_camp_profile_values,
  public.csm_camp_features,
  public.csm_contacts,
  public.csm_camp_launches,
  public.csm_launch_checkpoints
from anon, authenticated;

grant select,insert,update,delete on
  public.csm_memberships,
  public.csm_features,
  public.csm_camps,
  public.csm_profile_fields,
  public.csm_camp_profile_values,
  public.csm_camp_features,
  public.csm_contacts,
  public.csm_camp_launches,
  public.csm_launch_checkpoints
to authenticated;

drop policy if exists csm_memberships_select on public.csm_memberships;
create policy csm_memberships_select on public.csm_memberships for select to authenticated
using (user_id=auth.uid() or public.csm_is_manager());
drop policy if exists csm_memberships_insert on public.csm_memberships;
create policy csm_memberships_insert on public.csm_memberships for insert to authenticated
with check (public.csm_is_manager());
drop policy if exists csm_memberships_update on public.csm_memberships;
create policy csm_memberships_update on public.csm_memberships for update to authenticated
using (public.csm_is_manager()) with check (public.csm_is_manager());
drop policy if exists csm_memberships_delete on public.csm_memberships;
create policy csm_memberships_delete on public.csm_memberships for delete to authenticated
using (public.csm_is_manager());

-- Additive SELECT policy only. Existing Sales Board policies remain untouched.
drop policy if exists profiles_csm_select on public.profiles;
create policy profiles_csm_select on public.profiles for select to authenticated
using (public.csm_can_see_profile(id));

drop policy if exists csm_features_select on public.csm_features;
create policy csm_features_select on public.csm_features for select to authenticated
using (public.csm_is_active_user());
drop policy if exists csm_features_insert on public.csm_features;
create policy csm_features_insert on public.csm_features for insert to authenticated
with check (public.csm_is_manager());
drop policy if exists csm_features_update on public.csm_features;
create policy csm_features_update on public.csm_features for update to authenticated
using (public.csm_is_manager()) with check (public.csm_is_manager());
drop policy if exists csm_features_delete on public.csm_features;
create policy csm_features_delete on public.csm_features for delete to authenticated
using (public.csm_is_manager());

drop policy if exists csm_camps_select on public.csm_camps;
create policy csm_camps_select on public.csm_camps for select to authenticated
using (public.csm_is_manager() or (public.csm_is_active_user() and responsible_id=auth.uid()));
drop policy if exists csm_camps_insert on public.csm_camps;
create policy csm_camps_insert on public.csm_camps for insert to authenticated
with check (public.csm_is_manager());
drop policy if exists csm_camps_update on public.csm_camps;
create policy csm_camps_update on public.csm_camps for update to authenticated
using (public.csm_is_manager()) with check (public.csm_is_manager());
drop policy if exists csm_camps_delete on public.csm_camps;
create policy csm_camps_delete on public.csm_camps for delete to authenticated
using (public.csm_is_manager());

drop policy if exists csm_profile_fields_select on public.csm_profile_fields;
create policy csm_profile_fields_select on public.csm_profile_fields for select to authenticated
using (public.csm_is_active_user());
drop policy if exists csm_profile_fields_insert on public.csm_profile_fields;
create policy csm_profile_fields_insert on public.csm_profile_fields for insert to authenticated
with check (public.csm_is_manager());
drop policy if exists csm_profile_fields_update on public.csm_profile_fields;
create policy csm_profile_fields_update on public.csm_profile_fields for update to authenticated
using (public.csm_is_manager()) with check (public.csm_is_manager());
drop policy if exists csm_profile_fields_delete on public.csm_profile_fields;
create policy csm_profile_fields_delete on public.csm_profile_fields for delete to authenticated
using (public.csm_is_manager());

drop policy if exists csm_camp_profile_values_select on public.csm_camp_profile_values;
create policy csm_camp_profile_values_select on public.csm_camp_profile_values for select to authenticated
using (public.csm_can_access_camp(camp_id));
drop policy if exists csm_camp_profile_values_insert on public.csm_camp_profile_values;
create policy csm_camp_profile_values_insert on public.csm_camp_profile_values for insert to authenticated
with check (public.csm_can_access_camp(camp_id));
drop policy if exists csm_camp_profile_values_update on public.csm_camp_profile_values;
create policy csm_camp_profile_values_update on public.csm_camp_profile_values for update to authenticated
using (public.csm_can_access_camp(camp_id)) with check (public.csm_can_access_camp(camp_id));
drop policy if exists csm_camp_profile_values_delete on public.csm_camp_profile_values;
create policy csm_camp_profile_values_delete on public.csm_camp_profile_values for delete to authenticated
using (public.csm_is_manager());

drop policy if exists csm_camp_features_select on public.csm_camp_features;
create policy csm_camp_features_select on public.csm_camp_features for select to authenticated
using (public.csm_can_access_camp(camp_id));
drop policy if exists csm_camp_features_insert on public.csm_camp_features;
create policy csm_camp_features_insert on public.csm_camp_features for insert to authenticated
with check (public.csm_can_access_camp(camp_id));
drop policy if exists csm_camp_features_update on public.csm_camp_features;
create policy csm_camp_features_update on public.csm_camp_features for update to authenticated
using (public.csm_can_access_camp(camp_id)) with check (public.csm_can_access_camp(camp_id));
drop policy if exists csm_camp_features_delete on public.csm_camp_features;
create policy csm_camp_features_delete on public.csm_camp_features for delete to authenticated
using (public.csm_is_manager());

drop policy if exists csm_contacts_select on public.csm_contacts;
create policy csm_contacts_select on public.csm_contacts for select to authenticated
using (public.csm_can_access_camp(camp_id));
drop policy if exists csm_contacts_insert on public.csm_contacts;
create policy csm_contacts_insert on public.csm_contacts for insert to authenticated
with check (
  public.csm_is_manager()
  or (public.csm_is_active_user() and csm_id=auth.uid() and public.csm_can_access_camp(camp_id))
);
drop policy if exists csm_contacts_update on public.csm_contacts;
create policy csm_contacts_update on public.csm_contacts for update to authenticated
using (public.csm_is_manager() or (public.csm_is_active_user() and csm_id=auth.uid()))
with check (public.csm_is_manager() or (public.csm_is_active_user() and csm_id=auth.uid()));
drop policy if exists csm_contacts_delete on public.csm_contacts;
create policy csm_contacts_delete on public.csm_contacts for delete to authenticated
using (public.csm_is_manager() or (public.csm_is_active_user() and csm_id=auth.uid()));

drop policy if exists csm_camp_launches_select on public.csm_camp_launches;
create policy csm_camp_launches_select on public.csm_camp_launches for select to authenticated
using (public.csm_can_access_camp(camp_id));
drop policy if exists csm_camp_launches_insert on public.csm_camp_launches;
create policy csm_camp_launches_insert on public.csm_camp_launches for insert to authenticated
with check (
  public.csm_is_manager()
  or (public.csm_is_active_user() and responsible_id=auth.uid() and public.csm_can_access_camp(camp_id))
);
drop policy if exists csm_camp_launches_update on public.csm_camp_launches;
create policy csm_camp_launches_update on public.csm_camp_launches for update to authenticated
using (
  public.csm_is_manager()
  or (public.csm_is_active_user() and responsible_id=auth.uid() and public.csm_can_access_camp(camp_id))
)
with check (
  public.csm_is_manager()
  or (public.csm_is_active_user() and responsible_id=auth.uid() and public.csm_can_access_camp(camp_id))
);
drop policy if exists csm_camp_launches_delete on public.csm_camp_launches;
create policy csm_camp_launches_delete on public.csm_camp_launches for delete to authenticated
using (public.csm_is_manager());

drop policy if exists csm_launch_checkpoints_select on public.csm_launch_checkpoints;
create policy csm_launch_checkpoints_select on public.csm_launch_checkpoints for select to authenticated
using (public.csm_can_access_launch(launch_id));
drop policy if exists csm_launch_checkpoints_insert on public.csm_launch_checkpoints;
create policy csm_launch_checkpoints_insert on public.csm_launch_checkpoints for insert to authenticated
with check (public.csm_can_access_launch(launch_id));
drop policy if exists csm_launch_checkpoints_update on public.csm_launch_checkpoints;
create policy csm_launch_checkpoints_update on public.csm_launch_checkpoints for update to authenticated
using (public.csm_can_access_launch(launch_id)) with check (public.csm_can_access_launch(launch_id));
drop policy if exists csm_launch_checkpoints_delete on public.csm_launch_checkpoints;
create policy csm_launch_checkpoints_delete on public.csm_launch_checkpoints for delete to authenticated
using (public.csm_can_access_launch(launch_id));

create index if not exists idx_csm_camps_responsible on public.csm_camps(responsible_id);
create index if not exists idx_csm_profile_fields_active_order on public.csm_profile_fields(is_active,sort_order);
create index if not exists idx_csm_camp_profile_values_field on public.csm_camp_profile_values(field_id,value_text);
create index if not exists idx_csm_camp_features_feature on public.csm_camp_features(feature_id,status);
create index if not exists idx_csm_contacts_camp_date on public.csm_contacts(camp_id,contact_date desc,created_at desc);
create index if not exists idx_csm_contacts_csm_date on public.csm_contacts(csm_id,contact_date desc);
create index if not exists idx_csm_contacts_next_step on public.csm_contacts(next_step_date);
create index if not exists idx_csm_launches_camp_start on public.csm_camp_launches(camp_id,start_date);
create index if not exists idx_csm_launches_responsible_start on public.csm_camp_launches(responsible_id,start_date);
create index if not exists idx_csm_launch_checkpoints_launch_date on public.csm_launch_checkpoints(launch_id,due_date);

insert into public.csm_profile_fields(code,name,description,field_type,details_label,sort_order)
values
  ('multiple_legal_entities','Работает с несколькими юрлицами?','Как лагерь организует продажи и оплаты между юридическими лицами','yes_no_unknown','Как работают с юрлицами',10),
  ('subsidies','Работает с субсидиями?','Использует ли лагерь субсидии, сертификаты или компенсационные программы','yes_no_unknown','Как устроена работа с субсидиями',20)
on conflict(code) do nothing;

insert into public.csm_features(code,name,description,sort_order)
values
  ('documents','Документооборот','Сбор, подписание и контроль документов',10),
  ('auto_distribution','Авторасселение','Автоматическое распределение по отрядам и комнатам',20),
  ('new_booking','Новый модуль бронирования','Новый сценарий бронирования путёвки',30)
on conflict(code) do nothing;

-- Bootstrap exactly one existing active Sales Board manager as the first CSM manager,
-- only when no CSM manager has been activated yet.
with candidate as (
  select p.id
  from public.profiles p
  where p.active=true and p.role='manager'
  order by p.created_at nulls last, p.id
  limit 1
)
update public.csm_memberships m
set role='manager',active=true,updated_at=now()
where m.user_id in (select id from candidate)
  and not exists (
    select 1 from public.csm_memberships x
    where x.active=true and x.role='manager'
  );

-- End. No Sales Board role, table or RLS policy is replaced.