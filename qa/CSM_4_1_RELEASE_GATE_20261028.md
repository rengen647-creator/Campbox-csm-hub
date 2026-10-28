# CampBox CSM Hub 4.1 — stage release gate / QA evidence (2026-10-28)

**Release status: NOT approved for production.** Parent PR #13 (draft), contrast PR #14 (draft), integrated PR #15 (draft). The only live application code is OS 4.0 at main `dc487b908df7cc18f61a5317b2179997b664f96a`.

## Restore points
- Code before 4.1: `backup/csm-before-4-1-20261028` at main `dc487b908df7...`.
- Earlier code backup: `backup/csm-before-publish-20261028`.
- Database: **no PostgreSQL snapshot or database backup was performed by this feature work.** Confirm provider recovery/PITR and record pre-migration schema backup before any release.
- No production SQL was executed in this work: only SELECT metadata and aggregate counts.

## Read-only production inventory verified 2026-10-28
- `public.csm_camps`: **77**; Sales-owned `active=true`: **70**.
- `csm_camp_features`: **650** rows; `csm_camp_profile_values`: **436** rows; `csm_contacts`: **115** rows.
- `csm_reporting_active` column **does not exist** in production.
- PostgreSQL `pg_policies`: `csm_camps_update` is `TO authenticated`, `USING csm_is_manager()`, `WITH CHECK csm_is_manager()`. `csm_camps_select` is role/owner scoped. This is schema evidence, **not** a signed-in manager/CSM PATCH test.
- Existing Sales->CSM active sync remains unchanged; `csm_camps.active` is never written by the new feature.

## 4.1 change map
- `src/styles/csm-os4.css`: semantic tokens, primary button contrast, focus, fields, inherited light/dark palette; explicit component-level overrides for old hard-coded dark surfaces.
- `src/styles/csm-reporting-status.css`: readable status badges in both themes.
- `src/csm-reporting-ui.js`: stable client identity in list/table, exact feature selection for absent camp×feature rows, accessible status name, manager confirmation and server-returned value.
- `index.html`: old Discovery / unknown drilldown, trends, training, funnel, team and KPI denominators use active cohort. Missing camp×feature is `Не начато`, `Не требуется` excluded. Current 0/0 is `—`. Historical report events use role-visible period history, not today's active cohort.
- `src/csm-os4.js`: two explicit report dimensions, current active metrics and historical contacts/training/transitions; history filter `Все доступные лагеря / Только активные сейчас`, metadata and Excel consistent.
- Database migration file `migrations/20261028_csm_reporting_active.sql` **staged only**, not executed.

## Automated evidence
- `qa/contrast-4-1.test.mjs`: token/legacy coverage and paired theoretical WCAG contrast.
- `qa/contrast-4-1-browser.mjs`: computed color/final background scan in 2 themes, 7 widths (375,430,768,900,1024,1440,1920), key views and edit modal, JSON and screenshots. Prior passing run recorded **688 text samples**, zero flagged in this *sampled* set; gradients marked for manual review.
- `qa/axe-4-1-browser.mjs`: axe-core color-contrast scan in 2 themes, desktop/mobile, main views + modal, JSON report. Do **not** claim full WCAG 2.2 AA without reviewing scan results and manual checks.
- `qa/csm-4-1-invariants.test.mjs`, `qa/csm-reporting-status.test.mjs`, legacy `qa/os4.test.mjs`, `qa/contact-partial-save.test.mjs`: static and pure model checks.
- `qa/browser-os4.mjs`: synthetic browser smoke and manager-demo status toggle. Demo is not auth or real database proof.

## A01–A30 release decision matrix
| ID | Evidence / status | What is still required |
|---|---|---|
| A01 | Migration authored; production column absent (BLOCKED) | Apply only in isolated CSM database, test old active and default true |
| A02 | Synthetic status toggle / unit eligibility | Authenticated DB persistence test |
| A03 | Synthetic reactivation / unit eligibility | Authenticated reload and persistence test |
| A04 | Sales `active` untouched in code; eligibility tested | Sales trigger in isolated DB |
| A05 | Eligibility rule checked | Sales reactivation with CSM false |
| A06 | Demo filter `Все` tested | Role-scoped production-like data |
| A07 | UI filter `Неактивные` code ready | UI + contract state regression with auth |
| A08 | Manager-only UPDATE policy inspected (BLOCKED) | Direct employee PostgREST PATCH denial |
| A09 | Manager UPDATE policy inspected (BLOCKED) | Signed-in manager UPDATE then reload |
| A10 | Returned boolean equality check and error path | Network failure and 0-row integration |
| A11 | Dirty guard from OS4 and demo browser test | Manual long-form edit and status control |
| A12 | Pure applicable denominator tests | Dataset with `Не требуется` |
| A13 | Pure applicable denominator tests | `Не планирует` preserved in exact cohort |
| A14 | Missing relation selector + dynamic cohort wrapper | Browser click for absent relation |
| A15 | Current KPI `—` and pure selector test | Empty real cohort |
| A16 | `Нет` known answer test | Authenticated Discovery drilldown |
| A17 | Eligibility before known/unknown aggregation | Real inactive missing answer |
| A18 | Legacy cards/unknown list use `csmScopeCamps` | Review screenshots/selection match |
| A19 | Trend/training/funnel use active scope | Chart.js loaded browser check |
| A20 | Cohort wrapper expands missing rows | Count-to-list browser assertion |
| A21 | Historical report scope separated | Compare pre/post deactivation in test DB |
| A22 | Context-matched six-sheet export code | Inspect XLSX on realistic dataset |
| A23 | No contract handlers changed; existing SQL QA | Duplicate numbers across 2–10 camps |
| A24 | No Sales handoff/triggers changed | End-to-end Sales→CSM sync |
| A25 | B10 mock partial-save tests retained | Authenticated partial-write denial/retry |
| A26 | Light/dark browser samples and persisted setting | F5 + sign-in and manual visual confirmation |
| A27 | Computed samples + axe scan added | Full WCAG audit (including gradients, non-text, popup states) |
| A28 | 375/430 screenshots and mobile smoke | Human long-name/status action review |
| A29 | Responsive screenshots and no body overflow | 200%/400% zoom and sticky save manual QA |
| A30 | Actions run against every draft head | All CI green AND authenticated staging gate |

### Policy on history
History of events is selectable by period, irrespective of a client's current inclusion (default `Все доступные лагеря` within RLS). A retroactive *membership as of date* cannot be inferred from current booleans; a change ledger is a separate future migration and has not been invented.

### Remaining release blockers
1. Isolated, realistic CSM test database with identical policies and test manager/employee credentials.
2. Complete A01–A30 evidence, especially role/UPDATE/PATCH, real save/reload, Sales synchronization, XLSX parity and manual screenshot review.
3. Database schema backup and explicit **separate permission** for running `migrations/20261028_csm_reporting_active.sql` in production.
4. GitHub Actions all green on final SHA; inspect both-themes screenshots and contrast JSON; verify live Pages only after approved rollout.

**Correct order:** isolated DB migration + RLS QA → QA sign-off → production backup → separately approved additive migration → merge code PRs → Pages SUCCESS → read-only production count comparison → user acceptance. Do not automatically drop `csm_reporting_active` on rollback once values have been changed by users.
