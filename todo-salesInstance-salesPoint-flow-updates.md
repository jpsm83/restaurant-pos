# TODO: Reconcile `SalesInstance` / `SalesPoint` flow

Source of truth: `salesInstance-salesPoint-logic-ideas.md`

## High-signal differences found in current backend

- Employee-open conflict blocking is too broad:
  - POS open, QR `openTable`, and reservation `Seated` all block any open `SalesInstance` for the point (they do **not** filter by `openedAsRole === "employee"`).
  - These conflict checks also include `dailyReferenceNumber`, but the idea doc says the “at a time” invariant must be independent of the reporting bucket.
  - File: `backend/src/routes/v1/salesInstances.ts`, `backend/src/routes/v1/reservations.ts`.
- POS open is missing business scoping:
  - POS open validates `SalesPoint` by `_id` only, not `SalesPoint.businessId === request.businessId`.
  - File: `backend/src/routes/v1/salesInstances.ts`.
- Customer self-order conflict logic blocks too much:
  - QR self-order blocks when **any** open `SalesInstance` exists (regardless of `openedAsRole`), but the idea doc says it must only block when an **employee-open** instance exists.
  - File: `backend/src/routes/v1/salesInstances.ts`.
- QR gating is not scanner-role aware for customer self-order:
  - Customer self-order endpoint (`POST /selfOrderingLocation/:id`) requires auth, but it does not reject on-duty employee sessions (it allows an employee to create `openedAsRole: "customer"`).
  - File: `backend/src/routes/v1/salesInstances.ts`.
- PATCH `/salesInstances/:salesInstanceId` auth and integrity are too permissive:
  - The route uses `createOptionalAuthHook` (auth optional), but allows close/transfer/cancel operations anyway.
  - The route does not restrict these operations based on `salesInstance.openedAsRole` (idea doc says most PATCH ops should not be legal for customer-open/delivery).
  - The route also does not validate that `ordersIdsArr` all belong to the patched `salesInstanceId`.
  - File: `backend/src/routes/v1/salesInstances.ts`, plus helpers `closeOrders.ts`, `cancelOrders.ts`, `transferOrdersBetweenSalesInstances.ts`.
- `createOrders(...)` does not fully enforce business + salesInstance invariants for customer flows:
  - It verifies SalesInstance existence/status only for the employee-created branch.
  - It does not validate SalesInstance business scoping (`SalesInstance.businessId === provided businessId`) for any branch.
  - File: `backend/src/orders/createOrders.ts`.
- Receipt/notification payloads don’t include the order grouping discriminator needed by the idea doc:
  - `sendOrderConfirmation(...)` dispatches event `ORDER_CONFIRMED` and email/in-app receipt references `orderCode` only if passed, but current calling sites don’t pass `orderCode`.
  - File: `backend/src/orderConfirmation/sendOrderConfirmation.ts`, `backend/src/routes/v1/salesInstances.ts`.
- Promotions do not have delivery-vs-seated applicability:
  - `Promotion` schema has no `applyToDelivery`/context, and `applyPromotionsToOrders` has no notion of delivery.
  - File: `backend/src/models/promotion.ts`, `backend/src/promotions/applyPromotions.ts`, `backend/src/routes/v1/salesInstances.ts`.
- Kitchen dispatch/printing must NOT rely on backend comms:
  - `communications/dispatchEvent.ts` is only for customer receipts/notifications (e.g. `ORDER_CONFIRMED`).
  - Kitchen readiness is driven by persisted order state in the DB (`orderStatus`) and grouped by `salesGroup.orderCode`.
- No explicit abandonment/timeout cleanup for customer sessions:
  - There is no TTL job/logic that deletes unpaid customer-open `SalesInstance` + related orders when payment is not completed.
  - This must be added per the idea doc’s “abandon cleanup” section.

## TODO plan (implementation checklist)

### Task 1: Extract “conflict check” rules into server helpers

Goal: prevent drift between POS open / QR openTable / reservation seating / QR self-order.

- [x] Create a new helper module (or extend an existing `backend/src/salesInstances/*` module) that exposes:
  - [x] `pointBusyForEmployee({ salesPointId, businessId, session? })`
    - Query must be:
      - `SalesInstance.salesPointId == salesPointId`
      - `SalesInstance.businessId == businessId`
      - `SalesInstance.openedAsRole == "employee"`
      - `SalesInstance.salesInstanceStatus != "Closed"`
    - Acceptance: does not block when only customer-open instances exist.
  - [x] `pointBusyForCustomerSelfOrder({ salesPointId, businessId, session? })`
    - Should be true **only** if an open employee-open instance exists (same query as above).
- [x] Ensure these helpers do **not** use `dailyReferenceNumber`.
- [x] Update all call sites to use the helpers:
  - [x] `backend/src/routes/v1/salesInstances.ts`
    - POS open (`POST /`)
    - QR employee `openTable` (`POST /selfOrderingLocation/:id/openTable`)
    - QR customer self-order (`POST /selfOrderingLocation/:id`)
  - [x] `backend/src/routes/v1/reservations.ts`
    - Reservation `PATCH` where status becomes `Seated`
  - [x] `backend/src/routes/v1/salesInstances.ts`
    - `PATCH /:salesInstanceId/transferSalesPoint` conflict check

Acceptance criteria:
- Customer self-order no longer blocks on other customer self-order instances.
- Employee open blocks only employee-open instances (time-based “at a time”, not daily).

### Task 2: Fix POS open business scoping + strengthen validations

- [ ] In `backend/src/routes/v1/salesInstances.ts` POS open (`POST /`):
  - [x] Replace `SalesPoint.exists({ _id: salesPointId })` with a business-scoped check (validated in route).
  - [x] If missing, return `404` with a clear message (e.g. “Sales point does not belong to this business”).
- [x] Ensure `createSalesInstance(...)` or the calling route validates the chain:
  - `SalesInstance.salesPointId.businessId == request.businessId` (either in route or in helper).

Acceptance criteria:
- It’s impossible to open a POS table in a different business by passing a random `salesPointId`.

### Task 3: Enforce “QR gating server-authoritative” for customer self-order

- [ ] In `backend/src/routes/v1/salesInstances.ts` customer self-order endpoint (`POST /selfOrderingLocation/:id`):
  - [x] After auth, compute `effectiveRole` using `getEffectiveUserRoleAtTime({ userId, businessId })`.
  - [x] If `effectiveRole === "employee"`, return `403` and do not create a customer-open `SalesInstance`.
   - [x] Keep customer self-order enabled only when:
     - `SalesPoint.selfOrdering === true`
     - scanner is customer (per effectiveRole)
     - business is open per `isBusinessOpenNow(...)`
     - delivery/self-order conflict rules are satisfied (Task 1 helpers)
- [x] Ensure multi-customer self-order continues to work:
  - The endpoint must allow multiple concurrent customer-open instances.

Acceptance criteria:
- On-duty employees cannot open customer self-order sessions via QR.

### Task 4: Restrict PATCH operations; customers close via self-order/payment endpoints

Goal: enforce the carve-out (“delivery and self-order must not use most PATCH flows”), while still allowing customers to complete their own session end-to-end (create instance -> add items -> pay -> server closes the instance).

- [ ] In `backend/src/routes/v1/salesInstances.ts`:
  - [x] Change behavior to require `sessionUserId` when any of close/transfer/cancel is requested.
  - [x] Fetch the target `SalesInstance` with at least:
    - `openedAsRole`, `salesInstanceStatus`, `businessId`, `salesPointId`, `salesGroup`
  - [x] Add a guard:
    - If this is the PATCH endpoint (`PATCH /:salesInstanceId`) and `openedAsRole !== "employee"` (opened as customer/self-order/delivery), then:
      - [x] disallow `cancel`, `closeOrders` (paymentMethodArr + ordersIdsArr), and transfer orders via `toSalesInstanceId` via PATCH
      - [x] return `409` with an explicit message.
  - [x] Keep management-role-only checks for cancellation strict (existing behavior remains, but only for employee-open sessions).
- [ ] Update `PATCH /:salesInstanceId/transferSalesPoint`:
  - [x] Reuse Task 1 conflict helpers.
  - [x] Also ensure the destination point belongs to the same business (already validated by `SalesPoint.exists({ businessId: salesInstance.businessId, _id: salesPointId })`).

Acceptance criteria:
- Customer self-order and delivery sessions can be completed (paid) and closed through their own POST/payment flows; they must not require the employee PATCH endpoint to close.
- Customer/delivery sessions cannot be closed/transferred/cancelled through the employee PATCH operations.

### Task 5: Add orders-to-salesInstance integrity checks for PATCH operations

Goal: close/cancel/transfer must only touch orders that belong to the PATCHed sales instance.

- [ ] In `backend/src/routes/v1/salesInstances.ts` PATCH `/:salesInstanceId`:
  - [x] Before calling `closeOrders`, `cancelOrders`, or `transferOrdersBetweenSalesInstances`, validate:
    - [x] All `ordersIdsArr` belong to `salesInstanceId` (and belong to the same `businessId`).
    - [x] For close:
      - orders are `billingStatus: "Open"`.
    - [x] For cancel:
      - orders are cancellable by your rules, and belong to the salesInstance.
      - [x] only employees with managers positions can cancel orders
- [x] orders transfers must be done by the receiver: the receiver requests the transfer via PATCH on their employee-open `salesInstanceId`. No sender acceptance is required; transfer is performed immediately from the source (`toSalesInstanceId`) orders.
  - [x] If any validation fails, abort and return `400`/`404` appropriately.
  - [x] Modify helper signatures to accept `salesInstanceId` (recommended) so validation can live in one place:
    - [x] `backend/src/orders/closeOrders.ts`:
      - Change to require `salesInstanceId` and filter orders by it in the query.
    - [x] `backend/src/orders/cancelOrders.ts`:
      - Change to require `salesInstanceId` and filter orders by it (and business if needed).
    - [x] `backend/src/orders/transferOrdersBetweenSalesInstances.ts`:
      - Change to require `fromSalesInstanceId` (or verify all orders are under the from instance) and ensure business scoping when pushing to destination.

Acceptance criteria:
- Passing an order id from another sales session must not be able to close/cancel/transfer it.

### Task 6: Harden `createOrders(...)` for all roles and business scoping

- [ ] In `backend/src/orders/createOrders.ts`:
  - [x] Always validate SalesInstance first (for both employee and customer createdAsRole flows):
    - `SalesInstance.findOne({ _id: salesInstanceId, businessId })`
    - Optionally also validate `SalesInstance.salesPointId` belongs to `businessId` (either via populate or a second query on SalesPoint).
    - Reject if SalesInstance is not found or is `salesInstanceStatus === "Closed"`.
  - [x] Remove the current “only check for employee branch” logic.
- [x] Ensure inserted orders always get:
  - correct `businessId`
  - correct `salesInstanceId`
- [x] Ensure `createOrders(...)` fails with an actionable error string when validation fails.

Acceptance criteria:
- Customer orders cannot be created against closed/non-existent sales instances, and cannot cross business boundaries.

### Task 7: Fix conflict & occupancy logic in reservation seating and employee open endpoints

- [x] Update `backend/src/routes/v1/reservations.ts`:
  - [x] In the “status === Seated” block, replace the open-conflict query with:
    - `openedAsRole === "employee"`
    - `salesInstanceStatus != "Closed"`
    - `businessId` scoping
    - remove `dailyReferenceNumber` from the conflict check
- [x] Update `backend/src/routes/v1/salesInstances.ts`:
  - [x] POS open (`POST /`) conflict query:
    - scope to openedAsRole employee only
    - remove dailyReferenceNumber from conflict check
  - [x] QR employee openTable conflict query:
    - scope to openedAsRole employee only
    - remove dailyReferenceNumber from conflict check

Acceptance criteria:
- Reservation seating respects the “only one employee-open at a time per salesPointId” rule.

### Task 8: Promotion scope: add `applyToDelivery` and apply it in delivery pricing

- [x] Update promotion model:
  - [x] Add `applyToDelivery?: boolean` (default `false`, meaning delivery is opt-in).
  - Files: `backend/src/models/promotion.ts` and packages interfaces for `IPromotion` if they exist.
- [x] Update promotion validation + routes:
  - [x] `backend/src/routes/v1/promotions.ts` must accept/validate `applyToDelivery`.
  - [x] Update `PATCH /promotions/:promotionId` similarly.
- [x] Fix an existing field-name bug in promotion creation:
  - [x] In the promotions create handler, it now persists `businessGoodsToApplyIds` (correct).
  - [x] Update `POST /promotions` to write the correct schema field so promotion targeting works.
- [x] Update promotion application:
  - [x] Modify `backend/src/promotions/applyPromotions.ts` so the function receives context:
    - `flow` or `isDelivery` / `salesPointType`
- [x] When applying promotions for delivery:
    - Include only promotions where `applyToDelivery === true`; seated flows include promotions where `applyToDelivery !== true`.
- [x] Update call sites:
    - [x] delivery endpoint: pass delivery context
    - [x] self-order QR endpoint: pass seated/selfOrder context
    - [x] employee orders: pass seated context

Acceptance criteria:
- Delivery promotions and seated promotions differ when configured.

### Task 9: Order code + receipt payload updates (orderCode must be used everywhere)

Goal: the order grouping discriminator (`orderCode`) must be part of:
- kitchen ticket grouping
- receipt notification/email payload

Minimum required changes (based on current backend):

- [x] Treat `SalesInstance.salesGroup[]` as an array of "time-batches":
  - each `salesGroup[i]` represents the orders created at the same time/batch
  - each batch element has a unique `salesGroup[i].orderCode`
- [x] Update `createOrders(...)` so a single `createOrders(...)` call creates/targets exactly one `salesGroup` batch:
  - generate a fresh `orderCode` per orders batch
  - insert `ordersIdsCreated` into that batch (do not reuse only `salesGroup[0].orderCode` for later, distinct batches)
- [x] Ensure the kitchen/ticket grouping uses `salesGroup.orderCode` (and that readiness is driven by persisted `orderStatus` after payment).
- [x] Update `backend/src/routes/v1/salesInstances.ts`:
  - [x] After creating orders + closing orders in customer self-order and delivery endpoints:
    - fetch the `salesGroup.orderCode` for the specific `salesGroup` element that contains the created order ids
    - pass it to `sendOrderConfirmation(...)`
- [x] Update `backend/src/orderConfirmation/sendOrderConfirmation.ts` and `backend/src/communications/dispatchEvent.ts`:
  - [x] Use `orderCode` in receipt text (already supported via `orderCode?:` in payload).
  - [ ] Ensure delivery/customer details are included if you implement them (next task).

Acceptance criteria:
- Receipt messages reference the correct `orderCode` for the specific `salesGroup` batch the orders were created in.

### Task 10: Persist kitchen-readiness state after payment completion

Per the idea doc, the kitchen does NOT rely on backend “ticket events”. The kitchen reads the DB and uses persisted order state (`orderStatus`) to know what to prepare.

- [x] Ensure employee-open orders can become immediately “ready” for the kitchen:
  - `createOrders(...)` should set `orderStatus` to "Sent" value immediately for `createdAsRole: "employee"` (or equivalent employee-served flow).
- [x] Ensure customer self-order + delivery orders (including `SalesInstance.salesGroup` writes) are created only after payment succeeds:
  - For self-order (QR) and delivery, the backend must not persist any `SalesInstance` / `Order` / `salesGroup` rows until payment is fully accepted.
  - This includes any other flow persistence (e.g. `dailyReferenceNumber` / `DailySalesReport` updates): those must also be performed only in the post-payment transaction.
  - All post-payment DB writes must be done atomically (inside the post-payment transaction) and only committed after `closeOrders(...)` succeeds (orders become `billingStatus: "Paid"`).
  - After the transaction commits, `createOrders(...)`-created orders must be kitchen-readable (via `orderStatus`) and the `SalesInstance` must be completed/closed.
- [x] Update both completion paths so the same post-payment close flow runs:
  - customer self-order completion path (QR endpoint)
  - delivery completion path (`POST /delivery`)

Acceptance criteria:
- Kitchen readiness is driven by DB polling of persisted order state (no backend-to-kitchen dispatch/print-ticket events).
- Retried payment completion does not regress or double-transition kitchen-readiness state (idempotency).

### Task 11: Idempotency + safe retry handling after payment acceptance

New contract (per your clarification):
- For self-order (QR) and delivery, the backend must NOT create `SalesInstance`/`Order` records until payment is accepted by your payment provider / front-end flow.
- Therefore, “abandon unpaid sessions TTL cleanup” is not applicable, because unpaid customer-open rows never exist.

- [x] Decide your idempotency mechanism for payment retries:
  - store a stable `paymentId` (or front-end `clientOrderId`) on the created `SalesInstance` (or a dedicated idempotency record)
  - enforce uniqueness at DB-level so repeated payment acceptance triggers do not create duplicates
- [x] Ensure partial-failure safety:
  - if the backend crashes after payment is accepted but before committing the transaction, there should be no persisted `SalesInstance`/`Order` state
  - ensure receipts/notifications are only sent after the DB transaction commits successfully
- [x] Ensure closeOrders/payment completion is not dispatched/emailed multiple times on retry:
  - the idempotency key must guarantee “create + close + receipt” runs at most once per accepted payment

Acceptance criteria:
- A retried “payment accepted” request does not create duplicate `SalesInstance`/`Order` records.
- Receipts/notifications are sent exactly once per accepted payment.

### Task 12: Tests + manual QA checklist

Because this touches concurrency and authorization, add both automated and manual coverage.

- [ ] Unit tests (or minimal integration tests via Fastify inject):
  - [ ] Conflict helpers:
    - employee-open blocks employee-open
    - employee-open does not block customer-open
    - customer self-order blocks only when employee-open exists
  - [ ] createOrders validation:
    - cannot create orders for closed SalesInstance
    - cannot create orders with mismatched businessId
- [ ] Integration tests for endpoints:
  - [ ] `POST /api/v1/salesInstances` POS open:
    - business scoping enforcement
    - conflict rule correctness
  - [ ] `POST /api/v1/salesInstances/selfOrderingLocation/:id/openTable`:
    - conflict rule correctness
  - [ ] `POST /api/v1/salesInstances/selfOrderingLocation/:id`:
    - customer-only gating
    - conflict rule correctness
  - [ ] `POST /api/v1/salesInstances/delivery`:
    - applyToDelivery promotions applied correctly
  - [ ] PATCH /salesInstances:
    - customer-open cannot close/cancel/transfer
    - orders IDs cannot escape to other sales instances
- [ ] Manual QA:
  - [ ] Attempt concurrent POS open on same salesPointId:
    - first succeeds, second returns `409`
  - [ ] Open customer QR self-order while employee open exists:
    - must `409`
  - [ ] Open multiple customer QR self-orders concurrently:
    - both succeed
  - [ ] Ensure abandoned sessions get cleaned and don’t dispatch receipts/tickets.

### Task 13: Dummy data update

- [ ] Update dummy data after schema changes (seed alignment):
  - [ ] `dummyData/promotions.json`: add `applyToDelivery` to each promotion (choose `true` only for delivery-applicable promotions, otherwise `false` or omit if you prefer default).
  - [ ] `dummyData/salesLocation.json`: ensure any required `SalesPoint` fields still match the model expectations (verify `selfOrdering`, `qrEnabled`, etc.).
