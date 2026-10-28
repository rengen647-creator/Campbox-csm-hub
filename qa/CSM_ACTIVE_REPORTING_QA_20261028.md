# CSM Hub 4.0 — active / inactive client reporting QA, 2026-10-28

## Scope and facts
- Production CSM repo main at `dc487b908df7` before this branch.
- Live database at inspection: 77 camps, 70 with Sales-owned `active=true`, 7 with `active=false`; all 77 linked to Sales. No live schema or client data modified by this PR.
- Sales→CSM trigger `campbox_internal.apply_salary_client` writes `csm_camps.active` from `salary_clients.active`. Therefore CSM user changes **must never** update `csm_camps.active`.
- Add independent `csm_reporting_active boolean not null default true`; effective participation: `c.active === true && c.csm_reporting_active !== false`.
- Historical contacts, feature states and question answers remain stored and editable according to existing permissions; current active-cohort reporting excludes inactive camps from numerator and denominator.
- Inactive means **excluded from current cohort metrics**, not contract termination or deletion.

## Changes included
- Active/inactive status pill at client list, inspector, legacy compare table, mobile card and editable camp modal.
- CSM manager-only explicit toggle, transaction confirmed by SELECT after UPDATE and existing RLS; unsaved camp edits are protected.
- Filters: active, inactive, all; user can still locate inactive camps.
- Core CSM scope, adoption, discovery, KPI drills, team performance, report preview and Excel use effective active scope.
- UI explicitly discloses denominator as active camps in feature and question dashboards.
- No Sales Board schema or triggers, no salary/business formula or historic rows altered.

## Required tests
1. One active camp with an implemented feature and one newly disabled camp without implementation: numerator and denominator change correctly, without deleting rows.
2. Question 'Нет' counts as known for active camp; unknown answer in inactive camp excluded from known and unknown counts.
3. An inactive camp still appears in 'Все' and 'Неактивные', disappears from 'Активные', and can open its dossier.
4. A manager can switch true→false→true; after reload the state is durable.
5. A CSM employee can read the badge but cannot alter status through UI **or direct PostgREST PATCH**; verify RLS (server-side).
6. A Sales update to client name or active must not overwrite `csm_reporting_active`. Sales-owned `active=false` always means excluded until Sales reactivates.
7. Reselecting filters and owner/team scope must never re-add an inactive camp to adoption/discovery/report.
8. No linked contract status, role, Sales handoff, activity history or salary data changes.
9. Default true for existing rows after migration; no mass relabeling on deployment.
10. Empty active cohort renders '—' / 'no applicable data', not a misleading success percentage.

## Deployment sequence: not approved for production in this PR
1. Backup current database schema and retain source backup branch.
2. Apply reviewed additive migration `migrations/20261028_csm_reporting_active.sql` to the SAME CSM/Sales Supabase project, after separate authorization and isolation testing.
3. Verify column default, CSM manager UPDATE RLS, employee denial, Sales sync preserving new flag.
4. Verify real auth save/reload for both manager and CSM; check selected data counts.
5. Re-run browser and SQL QA, merge PR, verify Pages and active-only KPI on real authorized data.
6. Roll back UI via PR revert; do not automatically remove column if it contains decisions.

## Known limits
Automated browser checks are offline-demo checks. They do NOT prove authenticated PostgREST writes, historic reports or RLS after migration. PR remains **draft** and should not be released on demo QA alone.
