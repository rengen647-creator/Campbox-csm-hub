# CampBox release gate — 2026-11-02

## Current code
Sales PR #26; CSM PR #17. Both draft. No production changes.
Sales training fields, contract-number multi-camp support, transfer event adapters and tests.
CSM onboarding UI diagnostics, close guard, replay reducers and tests.

## Mandatory before production
- [ ] Full Supabase database backup (schema, rows, policies, functions, roles) and verified test restore.
- [ ] Test DB established after cost approval; do not incur unapproved fees.
- [ ] Transactional authenticated persistence, revision ordering and replay protection, with RLS.
- [ ] Actual Sales-to-CSM transport and acknowledgement back to Sales, preserving CSM-authored notes.
- [ ] Authorize completion on server side, not merely UI controls.
- [ ] Audit and remediate SECURITY DEFINER grants without breaking triggers.
- [ ] E2E: one document multiple camps; duplicate, stale, unauthorized events; training absent; salary/finance regression.
- [ ] Review 7 CSM camps without owner.
- [ ] All CI green on latest commits; approve PRs; rollout and rollback rehearsed.

## Business decisions before those features launch
- [ ] Retention rules from official Bilding policy.
- [ ] Non-launch 90-day compensation changes, if any.
- [ ] 'Zero' client definition; CSM upsell incentive policy.

Current state: testable source changes, NOT a release-ready production integration.