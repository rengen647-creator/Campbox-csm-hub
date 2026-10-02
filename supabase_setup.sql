create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'csm' check (role in ('manager','csm')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.camps (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  responsible_id uuid references public.profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.profile_fields (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  field_type text not null default 'yes_no_unknown' check (field_type in ('yes_no_unknown','text','number','date','select')),
  options jsonb not null default '[]'::jsonb,
  details_label text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.camp_profile_values (
  camp_id uuid not null references public.camps(id) on delete cascade,
  field_id uuid not null references public.profile_fields(id) on delete cascade,
  value_text text,
  details text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key(camp_id, field_id)
);

create table if not exists public.camp_features (
  camp_id uuid not null references public.camps(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  status text not null default 'Не начато' check (status in ('Не начато','Запланировано','Обучение','В работе','Перешёл','Не планирует','Не требуется')),
  planned_date date,
  training_date date,
  activated_at date,
  reason text,
  comment text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key(camp_id, feature_id)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  contact_date date not null default current_date,
  camp_id uuid not null references public.camps(id) on delete cascade,
  csm_id uuid not null references public.profiles(id),
  feature_id uuid references public.features(id),
  contact_type text not null check (contact_type in ('Звонок','Встреча','Обучение','Письмо','Чат','Напоминание','Проверка','Другое')),
  result text check (result in ('Не дозвонились','Связались','Обсудили','Обучили','Перешёл','Не готов','Не планирует','Требуется доработка','Другое')),
  next_step text,
  next_step_date date,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.camp_launches (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps(id) on delete cascade,
  responsible_id uuid not null references public.profiles(id),
  shift_name text not null,
  start_date date,
  status text not null default 'Не выяснено' check (status in ('Не выяснено','Дата подтверждена','Подготовка','Готов к запуску','Запущена','Перенесена','Отменена')),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.launch_checkpoints (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.camp_launches(id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'Не начато' check (status in ('Не начато','В работе','Готово','Не требуется')),
  comment text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active and role='manager' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.can_access_camp(target_camp uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_manager() or exists (
    select 1 from public.camps c
    where c.id = target_camp
      and c.responsible_id = auth.uid()
      and c.active = true
      and public.is_active_user()
  );
$$;


create or replace function public.can_access_launch(target_launch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.camp_launches l
    where l.id = target_launch
      and public.can_access_camp(l.camp_id)
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists features_touch on public.features;
create trigger features_touch before update on public.features for each row execute function public.touch_updated_at();
drop trigger if exists camps_touch on public.camps;
create trigger camps_touch before update on public.camps for each row execute function public.touch_updated_at();
drop trigger if exists profile_fields_touch on public.profile_fields;
create trigger profile_fields_touch before update on public.profile_fields for each row execute function public.touch_updated_at();
drop trigger if exists camp_profile_values_touch on public.camp_profile_values;
create trigger camp_profile_values_touch before update on public.camp_profile_values for each row execute function public.touch_updated_at();
drop trigger if exists camp_features_touch on public.camp_features;
create trigger camp_features_touch before update on public.camp_features for each row execute function public.touch_updated_at();
drop trigger if exists camp_launches_touch on public.camp_launches;
create trigger camp_launches_touch before update on public.camp_launches for each row execute function public.touch_updated_at();
drop trigger if exists launch_checkpoints_touch on public.launch_checkpoints;
create trigger launch_checkpoints_touch before update on public.launch_checkpoints for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,email,full_name,role,active)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),'csm',false)
  on conflict(id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.seed_feature_for_existing_camps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.camp_features(camp_id,feature_id,status)
  select c.id,new.id,'Не начато'
  from public.camps c
  where c.active=true
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_feature_created on public.features;
create trigger on_feature_created after insert on public.features for each row execute function public.seed_feature_for_existing_camps();

create or replace function public.seed_camp_features()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.camp_features(camp_id,feature_id,status)
  select new.id,f.id,'Не начато'
  from public.features f
  where f.is_active=true
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_camp_created on public.camps;
create trigger on_camp_created after insert on public.camps for each row execute function public.seed_camp_features();

create or replace function public.auto_activation_date()
returns trigger
language plpgsql
as $$
begin
  if new.status='Перешёл' and new.activated_at is null then
    new.activated_at=current_date;
  end if;
  return new;
end;
$$;
drop trigger if exists camp_feature_activation on public.camp_features;
create trigger camp_feature_activation before insert or update on public.camp_features for each row execute function public.auto_activation_date();

alter table public.profiles enable row level security;
alter table public.features enable row level security;
alter table public.camps enable row level security;
alter table public.profile_fields enable row level security;
alter table public.camp_profile_values enable row level security;
alter table public.camp_features enable row level security;
alter table public.contacts enable row level security;
alter table public.camp_launches enable row level security;
alter table public.launch_checkpoints enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id=auth.uid() or public.is_manager());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (public.is_manager()) with check (public.is_manager());

drop policy if exists features_select on public.features;
create policy features_select on public.features for select using (public.is_active_user());
drop policy if exists features_insert on public.features;
create policy features_insert on public.features for insert with check (public.is_manager());
drop policy if exists features_update on public.features;
create policy features_update on public.features for update using (public.is_manager()) with check (public.is_manager());
drop policy if exists features_delete on public.features;
create policy features_delete on public.features for delete using (public.is_manager());

drop policy if exists camps_select on public.camps;
create policy camps_select on public.camps for select using (public.is_manager() or (public.is_active_user() and responsible_id=auth.uid()));
drop policy if exists camps_insert on public.camps;
create policy camps_insert on public.camps for insert with check (public.is_manager());
drop policy if exists camps_update on public.camps;
create policy camps_update on public.camps for update using (public.is_manager()) with check (public.is_manager());
drop policy if exists camps_delete on public.camps;
create policy camps_delete on public.camps for delete using (public.is_manager());


drop policy if exists profile_fields_select on public.profile_fields;
create policy profile_fields_select on public.profile_fields for select using (public.is_active_user());
drop policy if exists profile_fields_insert on public.profile_fields;
create policy profile_fields_insert on public.profile_fields for insert with check (public.is_manager());
drop policy if exists profile_fields_update on public.profile_fields;
create policy profile_fields_update on public.profile_fields for update using (public.is_manager()) with check (public.is_manager());
drop policy if exists profile_fields_delete on public.profile_fields;
create policy profile_fields_delete on public.profile_fields for delete using (public.is_manager());

drop policy if exists camp_profile_values_select on public.camp_profile_values;
create policy camp_profile_values_select on public.camp_profile_values for select using (public.can_access_camp(camp_id));
drop policy if exists camp_profile_values_insert on public.camp_profile_values;
create policy camp_profile_values_insert on public.camp_profile_values for insert with check (public.can_access_camp(camp_id));
drop policy if exists camp_profile_values_update on public.camp_profile_values;
create policy camp_profile_values_update on public.camp_profile_values for update using (public.can_access_camp(camp_id)) with check (public.can_access_camp(camp_id));
drop policy if exists camp_profile_values_delete on public.camp_profile_values;
create policy camp_profile_values_delete on public.camp_profile_values for delete using (public.is_manager());

drop policy if exists camp_features_select on public.camp_features;
create policy camp_features_select on public.camp_features for select using (public.can_access_camp(camp_id));
drop policy if exists camp_features_insert on public.camp_features;
create policy camp_features_insert on public.camp_features for insert with check (public.can_access_camp(camp_id));
drop policy if exists camp_features_update on public.camp_features;
create policy camp_features_update on public.camp_features for update using (public.can_access_camp(camp_id)) with check (public.can_access_camp(camp_id));
drop policy if exists camp_features_delete on public.camp_features;
create policy camp_features_delete on public.camp_features for delete using (public.is_manager());

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select using (public.can_access_camp(camp_id));
drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts for insert with check (
  public.is_manager() or (public.is_active_user() and csm_id=auth.uid() and public.can_access_camp(camp_id))
);
drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts for update using (public.is_manager() or csm_id=auth.uid()) with check (public.is_manager() or csm_id=auth.uid());
drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts for delete using (public.is_manager() or csm_id=auth.uid());


drop policy if exists camp_launches_select on public.camp_launches;
create policy camp_launches_select on public.camp_launches for select using (public.can_access_camp(camp_id));
drop policy if exists camp_launches_insert on public.camp_launches;
create policy camp_launches_insert on public.camp_launches for insert with check (
  public.is_manager() or (public.is_active_user() and responsible_id=auth.uid() and public.can_access_camp(camp_id))
);
drop policy if exists camp_launches_update on public.camp_launches;
create policy camp_launches_update on public.camp_launches for update using (public.is_manager() or (public.is_active_user() and responsible_id=auth.uid() and public.can_access_camp(camp_id))) with check (public.is_manager() or (public.is_active_user() and responsible_id=auth.uid() and public.can_access_camp(camp_id)));
drop policy if exists camp_launches_delete on public.camp_launches;
create policy camp_launches_delete on public.camp_launches for delete using (public.is_manager());

drop policy if exists launch_checkpoints_select on public.launch_checkpoints;
create policy launch_checkpoints_select on public.launch_checkpoints for select using (public.can_access_launch(launch_id));
drop policy if exists launch_checkpoints_insert on public.launch_checkpoints;
create policy launch_checkpoints_insert on public.launch_checkpoints for insert with check (public.can_access_launch(launch_id));
drop policy if exists launch_checkpoints_update on public.launch_checkpoints;
create policy launch_checkpoints_update on public.launch_checkpoints for update using (public.can_access_launch(launch_id)) with check (public.can_access_launch(launch_id));
drop policy if exists launch_checkpoints_delete on public.launch_checkpoints;
create policy launch_checkpoints_delete on public.launch_checkpoints for delete using (public.can_access_launch(launch_id));

create index if not exists idx_camps_responsible on public.camps(responsible_id);
create index if not exists idx_profile_fields_active_order on public.profile_fields(is_active,sort_order);
create index if not exists idx_camp_profile_values_field on public.camp_profile_values(field_id,value_text);
create index if not exists idx_camp_features_feature on public.camp_features(feature_id,status);
create index if not exists idx_contacts_camp_date on public.contacts(camp_id,contact_date desc,created_at desc);
create index if not exists idx_contacts_csm_date on public.contacts(csm_id,contact_date desc);
create index if not exists idx_contacts_next_step on public.contacts(next_step_date);
create index if not exists idx_launches_camp_start on public.camp_launches(camp_id,start_date);
create index if not exists idx_launches_responsible_start on public.camp_launches(responsible_id,start_date);
create index if not exists idx_launch_checkpoints_launch_date on public.launch_checkpoints(launch_id,due_date);

-- Первичная инициализация профиля клиента. Руководитель может добавлять и менять поля из интерфейса.
insert into public.profile_fields(code,name,description,field_type,details_label,sort_order)
values
  ('multiple_legal_entities','Работает с несколькими юрлицами?','Как лагерь организует продажи и оплаты между юридическими лицами','yes_no_unknown','Как работают с юрлицами',10),
  ('subsidies','Работает с субсидиями?','Использует ли лагерь субсидии, сертификаты или компенсационные программы','yes_no_unknown','Как устроена работа с субсидиями',20)
on conflict(code) do nothing;

-- Первичная инициализация функций. Руководитель затем может менять их из интерфейса.
insert into public.features(code,name,description,sort_order)
values
  ('documents','Документооборот','Сбор, подписание и контроль документов',10),
  ('auto_distribution','Авторасселение','Автоматическое распределение по отрядам и комнатам',20),
  ('new_booking','Новый модуль бронирования','Новый сценарий бронирования путёвки',30)
on conflict(code) do nothing;

-- После регистрации первого руководителя выполни отдельно:
-- update public.profiles set role='manager', active=true where lower(email)=lower('YOUR_EMAIL@example.com');
