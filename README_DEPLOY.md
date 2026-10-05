# CampBox CSM Hub — shared Supabase setup

CSM Hub использует тот же Supabase-проект, что и CampBox Sales Board, но данные и роли изолированы.

## Общее
- `auth.users` — единая авторизация сотрудников.
- `public.profiles` — только ФИО/email для отображения.

## Раздельное
- доступ CSM Hub: `public.csm_memberships`;
- все рабочие таблицы CSM имеют префикс `csm_`;
- роли Sales Board (`manager/employee`) не меняются;
- роли CSM Hub (`manager/csm`) управляются отдельно.

## Запуск
1. Открой **Supabase → SQL Editor**.
2. Выполни целиком `supabase_setup.sql`.
3. Скрипт создаст CSM-таблицы, RLS и стартовые поля/функции.
4. Если в Sales Board уже есть активный руководитель, один такой пользователь автоматически станет первым руководителем CSM Hub.
5. В **Authentication → URL Configuration → Redirect URLs** добавь:
   `https://rengen647-creator.github.io/Campbox-csm-hub/`
6. Открой CSM Hub и войди тем же аккаунтом Supabase, который используешь в Sales Board.

## Безопасность
В браузере используется только Supabase publishable key. `service_role` / secret key в GitHub и HTML добавлять нельзя.


## Обновление 05.10.2026 — фичи и вопросы доступны КСМ
Интерфейс CSM Hub теперь позволяет активным КСМ самим добавлять и редактировать:
- фичи;
- пункты «Что выяснить у клиента».

Для уже работающей базы Supabase один раз выполни в SQL Editor файл:
`migration_2026-10-05_csm_self_service.sql`

Миграция меняет только RLS-политики на добавление и редактирование этих двух справочников. Удаление остаётся доступно только руководителю.
