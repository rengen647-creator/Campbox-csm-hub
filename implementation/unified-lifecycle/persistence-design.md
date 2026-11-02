# Durable handoff persistence — release design (NOT deployed)

## Existing production facts
- `sales_handoff_statuses` maps `(sales_user_id, contract_key)` to linkage status.
- `csm_onboarding_tasks` references `salary_contract_id` and `camp_id`.
- `csm_camps.sales_client_id` links the source client.
- The existing shared production Supabase project is `kcjzrwmznahhischkrah`.

## Release blockers
Full DB backup **and test restore** are not verified. No production SQL, new table, or RLS policy should be applied until verified. Current Git work is safe and isolated.

## Proposed durable event record (requires schema design review)
`handoff_events`: id UUID primary key; sales_user_id UUID; source_contract_key TEXT; camp_id UUID; source_revision BIGINT; event_key TEXT UNIQUE; training_date DATE NULL; training_attendee TEXT NULL; customer_confirmed BOOLEAN NOT NULL DEFAULT FALSE; recorded_at TIMESTAMPTZ; applied_at TIMESTAMPTZ NULL; status TEXT with explicit pending/review/applied/conflict values.

Required indexes: unique (sales_user_id,source_contract_key,source_revision), unique (event_key). Stable assignment should reference `camp_id`, NEVER `contract_number`. Do not publish this as SQL before resolving identity and permission contracts.

## Trusted write path
1. Sales reads signed rows, maps stable contract keys, creates a revisioned transfer.
2. Authenticated trusted API validates identity, ownership, target camp and membership; never trusts a client-supplied `sales_user_id` without comparing auth claims.
3. In one transaction insert event by unique event key, resolve camp/contract relation, reconcile any later revision.
4. CSM reads authorized event and accepts or requests clarification. An unconfirmed training date never becomes accepted.
5. Acknowledgement status is reflected into existing handoff status, and shown back in Sales.
6. Detect replay, out-of-order revision, changed camp and contract collisions; write an audit entry for each.
7. If any step fails, retain event as pending/conflict with reason and safe retry.

## Security and data quality
- Never put service-role secrets in the HTML clients.
- All newly exposed tables require RLS; ownership must be checked, not merely `TO authenticated`.
- Existing `SECURITY DEFINER` access warnings must be audited before adding privileged RPC.
- Do not infer first booking from training or paid invoice from first booking.
- Never overwrite CSM-authored notes, owner, checklists or historical progress from Sales snapshots.

## Test scenarios
One contract/three camps; replay exact event; incoming old revision after new; no assigned CSM; user from unrelated account; unconfirmed training; missing participant; active/inactive dual flags; interrupted save retry; traceable rollback. A green unit test does not replace authenticated E2E.
