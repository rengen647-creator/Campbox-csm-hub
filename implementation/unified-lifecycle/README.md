# CampBox unified lifecycle — CSM workstream

Status: feature branch only; not merged, not published; no production SQL executed.

## Stage 0: release gate
1. Git source backup branches created 2026-10-30 in both repositories.
2. Full database schema+data+roles+RLS+functions/triggers backup REQUIRED and **NOT YET COMPLETE**.
3. Test restore must pass before any DDL or mutation.
4. Record baseline reports with baseline.sql; store results in protected space (no client records in public Git).

## First CSM tasks
- C-01: receive handoff idempotently, receipt and responsible owner; preserve incomplete source facts.
- C-02: training date and customer confirmation separately; reschedules with history.
- C-03: launch, first booking, first charge and first payment are different dated facts.
- C-11: preserve independent Sales active and CSM reporting active states; only both true count for current feature/question metrics.

## Withheld until business decision
- Automated nonpayment and no-contact retention triggers: verify current Bilding rules and due obligations.
- 90-day nonlaunch penalty and any salary recalculation: analytics ONLY.
- CSM incentive amounts for cross-sales: require approved commercial policy.

## QA gates
One company/3 camps/1 contract; double replay; no handoff duplicates; no fabricated activation; SQL RLS by real roles; restore; export and finance regression; rollout by feature flags and limited camp cohort.
