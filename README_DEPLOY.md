# CSM Hub 4.1 — current release status

**4.1 remains staging-only.** PR #13 independent CSM status, PR #14 contrast hotfix, PR #15 integrated reporting fixes. Main stays 4.0; schema migration not deployed.

Backup of 4.0 source: `backup/csm-before-4-1-20261028`.

## Release order
1. Use an isolated CSM Supabase project for `migrations/20261028_csm_reporting_active.sql`, with manager/CSM auth and actual RLS. Do not migrate production during staging.
2. Complete A01–A30 in `qa/CSM_4_1_RELEASE_GATE_20261028.md`; inspect computed contrast, axe logs and screenshots for both light/dark.
3. Capture production DB backup and read-only totals; obtain **separate explicit** permission for the production migration.
4. Only after QA, merge contrast PR #14, status PR #13 and integration PR #15, updating branches to avoid duplicating CSS changes. Verify Pages SUCCESS.
5. Verify read-only results for at least 5 authorized camps; change status only on a specifically approved safe test camp.

## Rollback
Restore UI from the backup branch by revert. Never automatically drop `csm_reporting_active` if managers have already saved choices; separate migration/restore plan is required. Never change Sales Board, salaries, contract IDs, or synchronized Sales-owned `csm_camps.active` as part of CSM status handling.

## Previous deployment instructions (4.0 and earlier)

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
