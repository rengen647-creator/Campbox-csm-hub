# CampBox CSM Hub 4.0 — staging and QA handoff

Base / backup: \`main\` at \`9b5ee588788b0e9cf84df0c02880dd8fbbfc13f6\`,
\`backup/csm-before-design-20261027\`.

Candidate: \`feature/csm-customer-success-os-4-20261027\` · draft PR #10.

## Actual implementation
- **App shell & design system:** \`src/styles/csm-os4.css\`; light/dark, responsive
  navigation and More on mobile; interactive focus styles. Existing inline CSS
  remains available during phased migration. This is not yet full CSS consolidation.
- **Operational dashboard:** action hero, four KPIs with real drilldowns, dated
  next steps, risk source labels, upcoming launches and manager workload panel.
- **Client register:** working filtering contract preserved; compact 9-column
  comparative table + mobile cards, role scope, owner, last work, next step,
  confirmed launches, applicability-normalised adoption and client 360° tabs.
- **Client 360°:** existing save/RPC handlers preserved; dirty-form guard and
  tabbed overview/work/adoption/launches/profile/history. It remains a large
  modal workspace pending a full inspector route.
- **Work:** next-step buckets (overdue/today/7 days/later/no date) and separate
  history, with no invented task-completion flags.
- **Adoption:** exact matrix including absent camp×feature relations; all seven
  persisted statuses; \`Не требуется\` excluded, \`Не планирует\` included.
- **Discovery:** per question/per camp, with exact accessible sets and known
  \`Нет\` answers.
- **Launches:** timeline with confirmed and unknown dates separately; readiness
  denominator excludes \`Не требуется\`; no checkpoint is not \`0%\` success.
- **Executive briefing:** period/owner/as-of context, contact dynamics and
  drilldown; metrics and six-sheet Excel from shared read-only report context.
- **QA foundation:** pure selectors, Node unit/static suite, Chromium demo flow,
  nine viewport captures in CI.

## Non-modified critical contracts
No changes to SQL, Supabase Auth, RLS, data tables, Sales Board, Sales→CSM
triggers, \`csm_set_contract_number\`, \`csm_set_renewal_review_date\`, or
existing mutation handlers. \`csm-fixes-20261021.js\` loads before OS4.

## Known release blockers: don't merge yet
1. **B01/B02/B04/B09/B18/B19/B23/B24:** real signed-in manager/CSM
   tests on an isolated Supabase project are NOT verified. Static tests
   and demo tests cannot prove RLS, save/reload or synchronization correctness.
2. **B10:** the inherited saveContact handler inserts a contact and then
   upserts a feature when result is \`Перешёл\`, without reporting an error
   from the second operation. This needs a separate functional change,
   deliberate error-state handling, and real database tests before release.
3. **B05:** dirty-form guard needs manual input/close, Save/reload and chained
   navigation verification against both roles, including network failure.
4. **B16/B17:** verify the original report KPI drilldowns and the six-sheet
   Excel on a realistic dataset including future dates, missing feature
   rows and >20 contacts. Screen/Excel now share an OS4 context but
   server-backed parity is not yet independently signed off.
5. **B21/B22:** Chromium demo visual screenshots/contrast and 200% zoom
   still need independent human review. Automated demo smoke is not UX
   acceptance nor a WCAG 2.2 audit.
6. **Architecture cleanup:** move remaining legacy screen renderers/styles to
   the component/presentation layers after characterization, not blindly.
   Legacy large modal is tabbed, but not yet a full 35/65 split workspace.

## Explicit QA workflow
- \`node --test qa/os4.test.mjs\` (pure business invariants & static contracts).
- GitHub Actions \`CSM OS 4.0 static and selector QA\`: Node + Chromium
  \`?demo=1\` (synthetic data). See action artifact \`csm-os4-demo-screenshots\`.
- Regression case matrix in Master Blueprint B01–B24 remains controlling.
- Preserve role-specific filter state, repeated contract numbers across 2–10
  distinct camp UUIDs, no RLS widening, no invented unknown=zero metrics.
- A clean demo and static gate **never authorize** production rollout.

Rollback: revert PR #10; backup branch pins source. Neither action restores
database rows, which have not been migrated here.
