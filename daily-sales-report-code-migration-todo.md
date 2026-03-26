# Daily Sales Report Migration TODO (Implementation Plan)

This is the execution plan to migrate backend code to the new business flow defined in `daily-sales-reports-flow-and-gaps.md` (especially sections `15` and `16`).

The plan is intentionally granular so each task/subtask can be executed only under your command.

---

## 0) Goal and Non-Negotiables

### Goal
- Move from "recompute actor reports on manager calculate" to "incremental actor updates on order transition `Open -> Final`, then aggregate on calculate/close".

### Non-negotiables from final flow
- Employee, Delivery, Self-order use the same actor aggregation model.
- Actor rows are always up to date for non-open orders.
- Manager `calculate` and `close` become aggregation-first paths.
- Close still blocks on any `Open` order.
- Financial report delete is disabled in production flow.

Step 0 execution status
- [x] Goal validated against `daily-sales-reports-flow-and-gaps.md` sections `15` and `16`.
- [x] Non-negotiables locked as migration invariants for all following tasks/phases.
- [x] Execution sequencing confirmed: no Phase A-F implementation may violate these invariants.

---

## 1) Impacted Code Inventory (must review before touching code)

### Core models/interfaces
- [x] `backend/src/models/dailySalesReport.ts`
- [x] `backend/src/models/order.ts`
- [x] `backend/src/models/salesInstance.ts`
- [x] `packages/interfaces/IDailySalesReport.ts`
- [x] `packages/interfaces/IOrder.ts`
- [x] `packages/interfaces/ISalesInstance.ts`

### Daily report helpers/routes
- [x] `backend/src/dailySalesReports/createDailySalesReport.ts`
- [x] `backend/src/dailySalesReports/updateEmployeeDailySalesReport.ts`
- [x] `backend/src/dailySalesReports/updateDeliveryDailySalesReport.ts`
- [x] `backend/src/routes/v1/dailySalesReports.ts`

### Order/sales-instance/reservation flow where `Open -> Final` happens
- [x] `backend/src/orders/closeOrders.ts`
- [x] `backend/src/orders/createOrders.ts`
- [x] `backend/src/orders/cancelOrders.ts`
- [x] `backend/src/orders/transferOrdersBetweenSalesInstances.ts`
- [x] `backend/src/routes/v1/orders.ts`
- [x] `backend/src/routes/v1/salesInstances.ts`
- [x] `backend/src/routes/v1/reservations.ts`
- [x] `backend/src/salesInstances/createSalesInstance.ts`

### Downstream aggregates
- [x] `backend/src/monthlyBusinessReport/aggregateDailyReportsIntoMonthly.ts`
- [x] `backend/src/weeklyBusinessReport/aggregateDailyReportsIntoWeekly.ts`
- [x] `backend/src/models/business.ts` (for reporting config alignment)

### Tests to update/add
- [x] `backend/tests/helpers/dailySalesReports.test.ts`
- [x] `backend/tests/routes/dailySalesReports.test.ts`
- [x] `backend/tests/routes/salesInstances.flows.test.ts`
- [ ] Add focused tests for incremental actor updates and idempotency

---

## 2) Execution Strategy (recommended order)

- [ ] Phase A: Schema and interface prep (backward-compatible).
- [ ] Phase B: Incremental actor update engine and hooks.
- [ ] Phase C: Refactor manager calculate/close to aggregate-only.
- [ ] Phase D: Authorization/route hardening and delete policy.
- [ ] Phase E: Weekly/monthly alignment and tests.
- [ ] Phase F: Data migration/reconciliation support and rollout safeguards.

Step 2 execution status
- [x] Recommended phase order (A -> F) confirmed as the active migration sequence.
- [x] Current active execution target set to Phase A (`Q1: Task A1 + A2`).
- [x] Gate established: do not start Phase B+ before Phase A schema/interface compatibility is in place.
- [x] Step 2 revalidated after actor attribution update (`userId` -> employee on-duty check -> customer split by sales point type).

---

## 3) Phase A — Schema + Interface Foundation

## Task A1: Introduce canonical actor report structure
- [x] Keep a simple 3-bucket report structure in `dailySalesReportSchema`:
  - [x] `employeesDailySalesReport`: array
  - [x] `deliveryDailySalesReport`: single object
  - [x] `selfOrderingSalesReport`: array
- [x] Reuse the same base schema for all 3 buckets (`employeeDailySalesReportSchema`), avoiding extra actor-type model definitions.
- [x] Refactor to shared-base + lightweight specializations:
  - [x] common base fields for all buckets
  - [x] self-order specialization requiring `salesPointId`
- [x] Do not define/persist `DailySalesActorType` in model schema.
- [x] Lock canonical actor recognition order:
  - [x] Resolve `userId` first
  - [x] If user has employee data and is on duty => `EMPLOYEE` (goes to employee bucket)
  - [x] Else check sales point type: `delivery` => `DELIVERY` (delivery bucket), otherwise => `SELF_ORDERING` (self-ordering bucket)

Subtasks
- [x] Decide exact persistence shape:
  - [x] Option 1: keep existing 3 report buckets and shared schema (selected)
  - [x] Option 2: normalized actor metadata model (not selected)
- [x] Update interface contracts in `IDailySalesReport.ts`.
- [x] Update model schema comments for clarity (order line vs good semantics).
- [x] Normalize payment field name across buckets to `employeePaymentMethods` (remove `customerPaymentMethod` usage).

Acceptance criteria
- [x] One shared report schema is reused across employee/delivery/self-ordering buckets.
- [x] TypeScript interfaces compile with no orphan fields.
- [x] Self-order rows use required `salesPointId` and shared payment field.

---

## Task A2: Keep report metadata minimal (no explicit calc/close audit fields)
- [x] Do not add explicit fields `lastCalculatedAt`, `calculatedBy`, `closedBy`, `closedAt`.
- [x] Use MongoDB default `updatedAt` as the single marker for latest calculation/update.
- [x] Re-executed validation: confirmed no explicit calc/close audit fields exist in daily report model/interfaces or routes.

Acceptance criteria
- [x] Report metadata stays minimal; no who/how/when audit fields are required.

---

## Task A3: Prepare idempotency support for incremental accounting
- [x] Define how an order transition is marked as "already applied" to actor totals.
- [x] Pick storage strategy:
  - [x] order-level marker field (not selected)
  - [x] separate applied-events collection (not selected)
  - [x] deterministic recompute guard in transaction
- [x] Simplified decision: use `billingStatus` transition guard (`Open -> Final`) in transactional flow; do not add extra idempotency fields.
- [x] Removed extra idempotency marker fields from `Order` model/interface and close flow.
- [x] Delivery bucket identity stabilized to `deliverySalesPointId` (no mixed identity fallback).
- [x] Daily report uniqueness aligned to business scope (`businessId` + `dailyReferenceNumber`).

Acceptance criteria
- [x] Duplicate/retried payment/close actions cannot double count.
- [x] A3 is implemented as baseline idempotency guard; full per-event robustness remains part of Phase B hook coverage.

---

## 4) Phase B — Incremental Actor Update Engine

## Task B1: Build a new helper for `Open -> Final` delta application
- [x] Create dedicated helper (e.g. `applyOrderFinalizationToActorReport`).
- [x] Input contract includes:
  - [x] `businessId`
  - [x] `dailyReferenceNumber`
  - [x] order payload (prices, tips, payment, goods, billingStatus)
  - [x] resolved report target bucket (`employeesDailySalesReport` | `deliveryDailySalesReport` | `selfOrderingSalesReport`)
  - [x] attribution context payload (`userId`, employee/on-duty resolution, salesPointType)

Subtasks
- [x] Implement per-status delta logic (`Paid`, `Void`, `Invitation`, `Cancel` policy).
- [x] Upsert actor row if missing.
- [x] Merge payment methods by key.
- [x] Merge goods arrays by `businessGoodId`.
- [x] Update totals/counters atomically.

Acceptance criteria
- [x] Single finalization event updates actor row in one transaction-safe step.

---

## Task B2: Hook incremental helper into all finalization entry points

Primary hook points
- [x] `backend/src/orders/closeOrders.ts` (main `Open -> Paid` path)
- [x] Any future/actual `Open -> Void` / `Open -> Invitation` paths
- [x] Confirm cancel behavior per policy (`Cancel` excluded unless explicitly required)

Subtasks
- [x] Ensure hook runs inside existing DB transaction.
- [x] Ensure hook runs after validation but before transaction commit.
- [x] Ensure hook is skipped when event already applied (idempotency).

Acceptance criteria
- [x] Actor reports are updated without waiting for manager calculate.

---

## Task B3: Resolve actor attribution deterministically
- [x] Define one canonical attribution rule and implement globally.
- [x] Apply same attribution logic across:
  - [x] POS close flow
  - [x] Delivery payment flow
  - [x] Self-order payment flow
  - [x] Transfer/handoff edge cases for open orders
- [x] Implement canonical recognition order exactly as defined:
  - [x] Start with `userId`
  - [x] if user has employee data and is on duty => `EMPLOYEE` bucket
  - [x] otherwise customer path
  - [x] customer + `delivery` sales point => `DELIVERY` bucket
  - [x] customer + non-`delivery` sales point => `SELF_ORDERING` bucket

Acceptance criteria
- [x] No ambiguous ownership or double attribution for finalized orders.
- [x] No endpoint is allowed to use a different actor classification rule.

---

## 5) Phase C — Manager Calculate/Close Refactor

## Task C1: Refactor `calculateBusinessReport` to aggregate-only
- [x] In `routes/v1/dailySalesReports.ts`, remove full actor recompute dependency from calculate path.
- [x] Replace with:
  - [x] load actor rows for day
  - [x] aggregate totals
  - [x] include `selfOrderingSalesReport` rows in aggregation (aligned with employee/delivery)
  - [x] persist top-level totals (no explicit audit metadata fields)
  - [x] trigger weekly/monthly rollup

Subtasks
- [x] Keep robust role/tenant checks.
- [x] Keep partial failure contract explicit.
- [x] Keep commission logic from subscription tier.

Acceptance criteria
- [x] Calculate does not scan raw sales instances/orders for per-actor rebuild.

---

## Task C2: Refactor close endpoint for final aggregate + close
- [x] Keep existing validation: block close if any `Open` order exists for same day.
- [x] Run same aggregation logic as calculate before setting closed.
- [x] Persist final totals + close status only (no close audit markers).

Acceptance criteria
- [x] Close endpoint is validation + aggregation + close state update.

---

## Task C3: Decommission old recompute helpers (or keep only as reconciliation)
- [x] Decide status of:
  - [x] `updateEmployeeDailySalesReport.ts`
  - [x] `updateDeliveryDailySalesReport.ts`
- [x] Convert to reconciliation-only helpers, or remove from primary runtime.

Acceptance criteria
- [x] No accidental use of old heavy recompute path in normal operation.

---

## 6) Phase D — Routes/Auth/Policy Hardening

## Task D1: Harden sensitive daily report routes
- [x] Restrict global list/read/delete where required by production policy.
- [x] Remove or disable hard delete route in production behavior.
- [x] Review `calculateUsersReport` endpoint (scope and authorization).

Acceptance criteria
- [x] Sensitive operations are management + tenant scoped.

---

## Task D2: Align "manager can act while off-duty" policy
- [x] Confirm whether role check should use on-duty role or management entitlement.
- [x] Apply consistently to calculate/close and related management actions.

Acceptance criteria
- [x] Auth behavior matches final business decision and is consistent across endpoints.

---

## 7) Phase E — Weekly/Monthly and Reporting Filters

## Task E1: Confirm downstream monthly/weekly trigger behavior
- [x] Ensure calculate/close invoke downstream rollups per agreed policy.
- [x] Validate weekly start day use from `business.reportingConfig.weeklyReportStartDay`.

Acceptance criteria
- [x] Downstream reports remain consistent with new daily aggregate timing.

---

## Task E2: Align business day list filter semantics
- [x] Keep technical `createdAt` filters if needed.
- [x] Add/plan operational day filters (`dailyReferenceNumber`/day label) for business-facing endpoints.

Acceptance criteria
- [x] List behavior matches final reporting semantics for overnight operations.

---

## 8) Phase F — Data Migration, Reconciliation, and Rollout

## Task F1: Backfill/migration script for existing open days
- [x] Build one-time migration/reconciliation script:
  - [x] rebuild actor rows from current source orders for each open day
  - [x] recompute top-level totals
  - [x] rely on default `updatedAt` (do not stamp explicit audit metadata)

Acceptance criteria
- [x] Existing data is aligned before feature switch.

---

## Task F2: Keep a reconciliation endpoint/job (safety net)
- [x] Implement manual/admin reconciliation action.
- [x] Do not use it as normal calculate path.

Acceptance criteria
- [x] Recovery path exists for rare inconsistencies.

---

## Task F3: Rollout controls
- [x] Add feature flag or phased switch for incremental engine.
- [x] Add temporary telemetry counters:
  - [x] actor update successes/failures
  - [x] idempotency skips
  - [x] aggregate mismatch checks (if enabled)

Acceptance criteria
- [x] Can roll out safely and rollback if required.

---

## 9) Testing Plan (must be implemented with code changes)

## Task T1: Unit tests for delta application
- [x] `Paid` event updates all expected fields.
- [x] `Void` and `Invitation` update correct buckets and values.
- [x] `Cancel` policy enforced as defined.
- [x] Duplicate event does not double count.

## Task T2: Integration tests for route flows
- [x] POS payment close updates actor row immediately.
- [x] Delivery flow updates delivery actor row immediately.
- [x] Self-order flow updates self-order actor row immediately.
- [x] Manager calculate aggregates without full actor recompute.
- [x] Manager close validates + final aggregates + closes.

## Task T3: Regression tests
- [x] Existing order/sales-instance behavior unchanged where expected.
- [x] Weekly/monthly aggregate still consistent after daily updates.

---

## 10) Suggested Command-by-Command Execution Queue

Use this queue to run work in controlled increments:

- [x] Q1: Implement Task A1 + A2 (schema/interfaces with minimal metadata policy)
- [x] Q2: Implement Task A3 + B1 (idempotency + delta engine helper)
- [x] Q3: Implement Task B2 + B3 (hook all finalization flows + attribution)
- [x] Q4: Implement Task C1 (calculate aggregate-only)
- [x] Q5: Implement Task C2 + C3 (close aggregate + retire old recompute path)
- [x] Q6: Implement Task D1 + D2 (auth and route policy hardening)
- [x] Q7: Implement Task E1 + E2 (weekly/monthly/filter semantics)
- [x] Q8: Implement Task F1 + F2 + F3 (migration/reconciliation/rollout controls)
- [x] Q9: Implement Task T1 + T2 + T3 (tests and regressions)

Evidence notes
- Q1-Q2: `packages/interfaces/IDailySalesReport.ts`, `backend/src/models/dailySalesReport.ts`, `backend/src/orders/closeOrders.ts`, `backend/src/dailySalesReports/applyOrderFinalizationToActorReport.ts`.
- Q3: `backend/src/dailySalesReports/resolveFinalizationActorReportTarget.ts`, `backend/src/routes/v1/salesInstances.ts`, `backend/src/orders/finalizeOrdersBillingStatus.ts`.
- Q4-Q5: `backend/src/routes/v1/dailySalesReports.ts` (`calculateBusinessReport`, `close` aggregation-first logic).
- Q6: `backend/src/routes/v1/dailySalesReports.ts` (`createAuthHook`, `resolveManagerBusinessId`, production delete guard).
- Q7: `backend/src/routes/v1/dailySalesReports.ts` (weekly/monthly trigger + `dailyReferenceNumber` filters).
- Q8: `backend/scripts/reconcileOpenDailyReports.ts`, `backend/src/dailySalesReports/rolloutControls.ts`, `backend/src/dailySalesReports/rolloutTelemetry.ts`.
- Q9: `backend/tests/helpers/dailySalesReports.test.ts`, `backend/tests/routes/salesInstances.flows.test.ts`, `backend/tests/routes/dailySalesReports.test.ts`.

---

## 11) Definition of Done for Code Migration

- [x] New incremental actor flow is active and stable.
- [x] Manager calculate/close are aggregation-first and fast.
- [x] No double counting under retries/idempotency scenarios.
- [x] Role and tenant access rules match final business document.
- [x] Production delete policy for financial reports is enforced.
- [x] Weekly/monthly outputs remain consistent.
- [x] Test suite covers new path + critical regressions.

Evidence notes
- Incremental flow: `backend/src/orders/closeOrders.ts`, `backend/src/orders/finalizeOrdersBillingStatus.ts`, `backend/src/dailySalesReports/applyOrderFinalizationToActorReport.ts`.
- Aggregation-first manager actions: `backend/src/routes/v1/dailySalesReports.ts` (`calculateBusinessReport`, `close`).
- Idempotency: open-status transition guards in `closeOrders.ts` and `finalizeOrdersBillingStatus.ts`; duplicate tests in `backend/tests/helpers/dailySalesReports.test.ts`.
- Role/tenant policy: `resolveManagerBusinessId` and scoped route checks in `backend/src/routes/v1/dailySalesReports.ts`.
- Production delete policy: `DELETE /:dailySalesReportId` production guard in `backend/src/routes/v1/dailySalesReports.ts`.
- Weekly/monthly consistency: rollup triggers + regression tests in `backend/tests/routes/dailySalesReports.test.ts`.
- Test coverage for new paths/regressions: `backend/tests/helpers/dailySalesReports.test.ts`, `backend/tests/routes/salesInstances.flows.test.ts`, `backend/tests/routes/dailySalesReports.test.ts`.

---

## 12) Notes for Implementation Sessions

- Always keep schema/interface changes backward-compatible until migration is complete.
- Keep implementation simple: do not overcomplicate flow or code when existing structure solves the requirement.
- Before executing any task, read `daily-sales-reports-flow-and-gaps.md` and `daily-sales-report-code-migration-todo.md` entirely.
- After any task is completed, immediately update this plan file to reflect real completion status and selected/non-selected options.
- Prefer small PRs per queue item (`Q1`, `Q2`, etc.).
- After each queue item:
  - [ ] run relevant tests
  - [ ] run lint/type checks for touched modules
  - [ ] update this TODO status

---

## 13) Audit Findings Remediation Plan (Post-Review)

The following tasks are derived from the implementation review findings and must be executed before declaring full migration closure.

## Task R1 (Finding #1 - High): Implement explicit `Open -> Void` and `Open -> Invitation` incremental hooks
- [x] Identify all runtime entry points where `billingStatus` can become `Void` or `Invitation` (routes/services/helpers).
- [x] For each entry point, enforce the same idempotent transition guard used for paid flow:
  - [x] update filter must include `{ _id, billingStatus: "Open" }`
  - [x] only apply incremental delta after successful Open-to-final transition
- [x] Reuse canonical attribution resolver `resolveFinalizationActorReportTarget` (do not duplicate actor decision logic).
- [x] Reuse `applyOrderFinalizationToActorReport` with the correct final status payload (`Void` or `Invitation`).
- [x] Ensure `Cancel` remains excluded from accounting deltas.
- [x] Preserve transaction boundaries: order transition + actor update must happen in the same transaction/session.
- [x] Add telemetry parity with paid flow:
  - [x] success/failure counters for actor update
  - [x] idempotency skip counter for duplicate/retry transitions
- [x] Update `daily-sales-reports-flow-and-gaps.md` with the final hooked paths and exact transition contracts.

Testing for R1
- [x] Unit tests:
  - [x] `Open -> Void` applies expected actor deltas once.
  - [x] `Open -> Invitation` applies expected actor deltas once.
  - [x] duplicate transition attempt does not double count.
- [x] Integration tests:
  - [x] route-level `Void` transition updates actor report immediately.
  - [x] route-level `Invitation` transition updates actor report immediately.
  - [x] retries return safe result without duplicate metrics.
- [x] Regression tests:
  - [x] existing `Open -> Paid` behavior remains unchanged.

Acceptance criteria
- [x] All live finalization transitions (`Paid`, `Void`, `Invitation`) are incrementally accounted with idempotency guarantees.

---

## Task R2 (Finding #2 - Medium): Align plan status tracking with real implementation state
- [x] Review Q1-Q9 status against code/test evidence and mark accurately.
- [x] Review Definition of Done items and mark accurately using evidence from source/tests.
- [x] For each checked item, add a short evidence note (file/function/test) under the section.
- [x] Keep unresolved items unchecked with explicit reason and owner action.
- [x] Add a mini “last audit date” line in the plan for traceability.

Testing for R2
- [x] Documentation consistency validation:
  - [x] every checked item has code or test evidence.
  - [x] no known unresolved gap is marked as done.
- [x] Peer review checklist:
  - [x] second pass verifies no stale checkboxes in queue and DoD sections.

Acceptance criteria
- [x] Plan reflects true implementation state with no misleading completion flags.

Last audit date
- 2026-03-26 (R2 reconciliation pass completed).

---

## Task R3 (Finding #3 - Medium): Reduce reconciliation drift risk by consolidating shared logic
- [x] Extract shared reconciliation primitives into a single module (merge goods, merge payments, row rollups, top-level recompute).
- [x] Refactor manual reconcile endpoint and backfill script to use the shared primitives.
- [x] Keep runtime incremental path (`applyOrderFinalizationToActorReport`) as source of truth for delta semantics.
- [x] Remove/limit duplicate business logic in legacy reconciliation helpers where possible.
- [x] Add comments documenting strict boundary:
  - [x] runtime incremental path
  - [x] admin/manual reconciliation path
  - [x] one-time backfill path

Testing for R3
- [x] Unit tests for shared reconciliation primitives (goods/payment merge and totals recompute).
- [x] Integration tests:
  - [x] manual reconcile endpoint output matches expected totals for mixed statuses.
  - [x] backfill script logic (or extracted function) reproduces same totals as manual reconcile for same fixture.
- [x] Regression tests:
  - [x] no change to current runtime incremental paid flow behavior.

Acceptance criteria
- [x] Reconciliation logic has a single maintained core with consistent results across endpoint/script usage.

Evidence notes
- Shared core: `backend/src/dailySalesReports/reconciliationCore.ts`.
- Manual endpoint refactor: `backend/src/routes/v1/dailySalesReports.ts` (`buildReconciledDailyReportPayload` uses shared core).
- Backfill script refactor: `backend/scripts/reconcileOpenDailyReports.ts` (uses shared core).
- Unit coverage: `backend/tests/helpers/dailySalesReports.test.ts` (`R3 shared reconciliation primitives`).
- Integration parity coverage: `backend/tests/routes/dailySalesReports.test.ts` (manual reconcile equals shared core output for mixed statuses).

---

## Task R4 (Finding #4 - Low): Add dedicated tests for `dailyReferenceNumber` business filters
- [x] Add route integration tests for `GET /dailySalesReports/business/:businessId` covering:
  - [x] exact `dailyReferenceNumber`
  - [x] `dailyReferenceNumberFrom`
  - [x] `dailyReferenceNumberTo`
  - [x] combined range (`from` + `to`)
  - [x] invalid integer inputs and invalid range (`from > to`)
- [x] Add cross-check test for precedence/combination when date and operational-day filters are both present.
- [x] Validate tenant-scope behavior with operational-day filters (manager business only).

Testing for R4
- [x] Route tests assert exact documents returned for each filter mode.
- [x] Negative tests assert proper `400` messages for bad inputs.
- [x] Authorization tests assert forbidden cross-tenant access even with valid filter values.

Acceptance criteria
- [x] Operational-day filter semantics are fully covered and stable under regression.

Evidence notes
- Route filter matrix + combined date/operational-day + tenant scope tests:
  - `backend/tests/routes/dailySalesReports.test.ts`.
- Regression suite confirmation:
  - `backend/tests/helpers/dailySalesReports.test.ts`
  - `backend/tests/routes/salesInstances.flows.test.ts`
  - `backend/tests/routes/dailySalesReports.test.ts`

---

## 14) Recommendations Execution Tasks (Run After R1-R4)

## Task RE1: Close remaining B2 gap fully
- [x] Confirm R1 delivered all intended `Open -> Void` / `Open -> Invitation` runtime hooks.
- [x] Mark remaining B2 sub-items complete only after tests pass.

Evidence notes
- Runtime hooks:
  - `backend/src/routes/v1/salesInstances.ts` (`ordersNewBillingStatus` -> `finalizeOrdersBillingStatus` for `Void`/`Invitation`).
  - `backend/src/orders/finalizeOrdersBillingStatus.ts` (idempotent `billingStatus: "Open"` guard + canonical attribution + incremental apply helper).
- Tests:
  - `backend/tests/routes/salesInstances.flows.test.ts` (`R1 integration - Open->Void/Open->Invitation hooks`).
  - `backend/tests/helpers/dailySalesReports.test.ts` (`R1 Open->Void/Invitation transitions` idempotency).

## Task RE2: Final documentation sync
- [x] Update `daily-sales-reports-flow-and-gaps.md` with final post-remediation flow.
- [x] Update this plan (`daily-sales-report-code-migration-todo.md`) to reflect final truth.
- [x] Ensure unresolved risks are listed explicitly in one place.

Evidence notes
- Flow sync: `daily-sales-reports-flow-and-gaps.md` sections `16.2`, `16.6`, `16.7` updated with post-remediation runtime hooks and reconciliation-core alignment.
- Plan sync: this file updated for DoD, RE2, and current completion state of R1-R4/RE1.
- Consolidated risks section added below in section 16.

## Task RE3: Final validation gate
- [x] Run targeted unit/integration/regression suites for R1-R4.
- [x] Run lint/type checks for all touched modules.
- [x] Record pass/fail results in the plan under a short “final validation” note.
- [x] Re-check Definition of Done and mark completion.

Final validation note
- Tests (targeted R1-R4 set): PASS
  - Command: `npm run test -- tests/helpers/dailySalesReports.test.ts tests/routes/salesInstances.flows.test.ts tests/routes/dailySalesReports.test.ts`
  - Result: `3` files passed, `31` tests passed.
- Lint diagnostics for touched modules: PASS
  - `ReadLints` on touched source/tests/docs reported no issues.
- Type-check:
  - Touched-module validation: PASS (no type diagnostics in touched files).
  - Full backend `npx tsc --noEmit`: FAIL due to pre-existing package interface extension issues outside this remediation scope (`packages/interfaces/IBusiness.ts`, `ISupplier.ts`, `IUser.ts`, `IWeeklyBusinessReport.ts` missing `.js` extension imports).
- Definition of Done re-check: PASS (all items now marked complete).

Acceptance criteria
- [x] All review findings are remediated, documented, tested, and traceable.

---

## 15) Consolidated Unresolved Risks

- Functional/data risks:
  - None currently open from R1-R4 scope.
- Operational/engineering notes:
  - Test runtime prints a non-blocking Node warning (`MaxListenersExceededWarning`) during suite execution; does not fail tests but should be monitored in CI hygiene backlog.
  - Full backend `npx tsc --noEmit` still reports pre-existing import-extension issues in `packages/interfaces/*` not introduced by this remediation cycle.

---

## 16) Suggested Extended Execution Queue

- [x] Q10: Execute R1 (Void/Invitation hooks + tests)
- [x] Q11: Execute R2 (plan/doD/queue status reconciliation)
- [x] Q12: Execute R3 (shared reconciliation core + regression tests)
- [x] Q13: Execute R4 (operational-day filter test matrix)
- [x] Q14: Execute RE1 + RE2 + RE3 (final closure and validation gate)

