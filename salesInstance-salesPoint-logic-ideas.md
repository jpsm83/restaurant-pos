## Goal
Reconcile your intended runtime invariants between `SalesPoint` (location/QR) and `SalesInstance` (open session) across:
1) employee / POS opening,
2) customer self-ordering via QR,
3) delivery ordering.

This doc is intentionally “idea-level”: validate the rules and flows here before we implement changes.

---

## Current mental model (from code)
- `SalesPoint`: physical/virtual location, owns QR settings (`selfOrdering`, QR code, etc.).
  - `backend/src/models/salesPoint.ts`
- `SalesInstance`: open session tied to a `salesPointId`, with statuses like `Occupied`, `Reserved`, `Bill`, `Closed`.
  - `backend/src/models/salesInstance.ts`
- `Order`: always tied to a `salesInstanceId`; served point is derived from `order.salesInstanceId.salesPointId`.
  - `backend/src/models/order.ts`

---

## Key invariants you clarified
### 1) One open SalesInstance per salesPointId (at a time), not per day
You want: for employee-served flows, a `salesPointId` is “busy” if there exists an open instance where `salesInstanceStatus != "Closed"`.

Implication:
- You can open a new employee sales instance only after the previous one is closed.
- The “dailyReferenceNumber” should not be part of the conflict rule (conflict is temporal, not per reporting bucket).

Proposed formal rule:
- `pointBusyForEmployee(salesPointId, businessId)` is true if:
  - exists any `SalesInstance` with `salesPointId`, `businessId`, and
  - `salesInstanceStatus != "Closed"`
  - AND `openedAsRole === "employee"`

Implementation note (current backend):
- The server centralizes this rule in `backend/src/salesInstances/salesInstanceConflicts.ts`:
  - `pointBusyForEmployee({ salesPointId, businessId, session?, excludeSalesInstanceId? })`
  - `pointBusyForCustomerSelfOrder(...)` (same rule; customer flows only conflict with employee-open instances)

In other words: **instances opened with `openedAsRole === "customer"` (delivery/self-order) must NOT block** opening another instance for the same `salesPointId`. For customer self-order and delivery, the full order must be paid before it is dispatched/sent to the kitchen.

### 2) Multiple open SalesInstances allowed simultaneously for delivery + customer self-ordering
You want: multiple customers can be self ordering concurrently (via QR self-order page or delivery app) for the same `salesPointId`, without blocking each other the way employee-served sessions do.

Proposed formal rule:
- `salesPoint.selfOrdering` defines who is allowed to use that QR:
  - if `selfOrdering === true`: QR ordering is customer-only (employee QR scan must NOT create/open an employee-open SalesInstance for that point)
  - if `selfOrdering === false`: QR ordering is employee-only (customers should not start self-order via that QR)
- Runtime “busy” blocking is derived from `SalesInstance.openedAsRole`:
  - employee-open (`openedAsRole === "employee"`) blocks other employee-open instances for the same `salesPointId`
  - customer-open (`openedAsRole === "customer"`) does not block other customer-open instances (delivery/self-order can have many concurrent sessions)
- if the order is done via QR as a customer self-order, or via the delivery sales point, multiple `SalesInstance`s under the same `salesPointId` are allowed
- extra validations for those flows still apply (business open times, delivery acceptance/time, delivery properties)
- `pointBusyForCustomerSelfOrder(salesPointId, businessId)` is true only if there is an open employee-served instance
- delivery is already “virtual”, `salesPointType === "delivery"`.

Concretely:
- When a customer requests customer self-order/delivery:
  - allow creation if selfOrdering is true at the `salesPointId`.
  - allow multiple open customer instances concurrently.

### 3) Fix missing business scoping for POS open
Your feedback: the POS open flow must validate that the `salesPointId` belongs to the provided `businessId`.

Proposed rule:
- Every “open sales instance” call must validate the chain:
  `SalesInstance.salesPointId.businessId == request.businessId`.

### 4) PATCH auth/data-integrity gaps, but with a carve-out
Your carve-out:
- Delivery and self-order sales instances are paid “straight away”, so most PATCH flows for closing/transfer/cancel should not be used for those.
- Delivery and self-order must be validate before with the business open hours and delivery properties
- Employee-open sales instances should allow PATCH behaviors (close orders with payment, transfer, etc.).

So we should:
- Enforce authorization + integrity checks in PATCH, and
- Restrict which PATCH operations are legal depending on whether the target `SalesInstance` is employee-open vs customer-open.

Implementation note (current backend):
- `PATCH /salesInstances/:salesInstanceId`:
  - requires an authenticated user session for cancel/close-with-payment/transfer operations
  - disallows cancel/close-with-payment/transfer when `SalesInstance.openedAsRole !== "employee"`
  - validates `ordersIdsArr` belong to the correct sales instance + business and are in the correct state (`billingStatus: "Open"`)

### 5) Orders creation must verify SalesInstance belongs to business
Your feedback:
- `orders.ts` must not allow orders that reference a sales instance from another business.

Proposed rule:
- In `createOrders(...)`, always verify:
  - `SalesInstance.businessId == businessId argument`
  - and that `SalesInstance.salesPointId` belongs to that same business (either via the SalesInstance businessId or an explicit SalesPoint check).

### 6) Race condition for customer self-order/delivery open conflict
Your feedback:
- For customer flows you separate by session and order code.
- Therefore, “customer vs customer” conflict should not block.

So the race problem is primarily about:
- customer self-order being blocked/allowed incorrectly due to another transaction creating/closing an instance, and
- customer self-order needing to be blocked only when an employee-open instance exists.

Proposed approach:
- Adjust the “open conflict” query for customer self-order to check only employee-open instances.
- For the remaining employee-open conflict, consider adding a database-level constraint (partial unique index) only if you need DB-level correctness under high concurrency. Currently the backend relies on application-level conflict checks.

### 7) QR gating should be server-authoritative, but must not break multi-customer self-order
Your feedback:
- Remove `qrEnabled/qrLastScanned` from the model mindset.
- QR scan behavior is dictated by `salesPoint.selfOrdering` and scanner identity:
  - if `selfOrdering === true`: customer QR navigates to the self-order app
  - if `selfOrdering === false`: customer QR navigates to a static menu
  - if the scanner is an on-duty employee, QR can open/occupy via the employee-open rules (busy/authorization)

Therefore:
- For customer self-order, implement server-side anti-duplicates via idempotency at the request/payment step (per customer/session), not via global QR disable/cooldown.

---

## Flow design by scenario (proposed)

### A) Employee opening a table (POS open, and QR employee openTable)
Where (current):
- POS open: `backend/src/routes/v1/salesInstances.ts` POST `/`
- QR employee openTable: `backend/src/routes/v1/salesInstances.ts` POST `/selfOrderingLocation/:id/openTable`

Proposed behavior:
1. Validate ids + permissions:
   - request auth required (employee on-duty rules)
   - `salesPointId` belongs to `businessId`
2. Determine conflict set:
   - check for any open `SalesInstance` on that `salesPointId` / `businessId` with
     `salesInstanceStatus != "Closed"`
   - AND `openedAsRole === "employee"`
3. If conflict exists:
   - return `409` (“already occupied” / “cannot open”)
4. Otherwise:
   - create a new `SalesInstance` with `openedAsRole = "employee"` and `salesInstanceStatus` (`Occupied` or `Reserved` depending on endpoint).
5. (Optional) consider a partial unique index to enforce step 2 atomically.

Important change vs current:
- Remove `dailyReferenceNumber` from validation from the conflict check if you truly mean “at a time”, not “per day”. BUT do not remove `dailyReferenceNumber` reference because this number is used for all the business reports calculations and sales reports

### B) Reservation seating (Reservation -> SalesInstance)
Where (current):
- `backend/src/routes/v1/reservations.ts` PATCH `/:reservationId` when status transitions to `Seated`

Proposed behavior:
1. When `status === "Seated"` create a `SalesInstance` with `openedAsRole = "employee"` (your code does this).
2. Conflict check:
   - block if any open instance exists for the `salesPointId` with
     `salesInstanceStatus != "Closed"`
     AND `openedAsRole === "employee"`
   - remove `dailyReferenceNumber` from validation from the conflict check if you adopt the “at a time” invariant.BUT do not remove `dailyReferenceNumber` reference because this number is used for all the business reports calculations and sales reports
   - on the reservation, the option to set the status to "Seated", supose to be disable if the `salesPointId` is `salesInstanceStatus != "Closed"`

### C) Customer self ordering via QR
Where (current):
- `backend/src/routes/v1/salesInstances.ts` POST `/selfOrderingLocation/:selfOrderingLocationId`

Your clarified behavior:
- Do NOT block customer vs customer by salesPoint occupancy.
- Only block customer self-order if an employee-open instance is currently open and base on the business properties as open hours, delivery and salesPoint properties as well as selfOrdering boolean

Proposed behavior:
1. Validate:
   - `SalesPoint.selfOrdering === true`
   - salesPoint belongs to business
   - business opening hours (you already do this)
2. Conflict check:
   - query open instances for `salesPointId` / `businessId` where:
     - `salesInstanceStatus != "Closed"`
     - AND `openedAsRole === "employee"` (or equivalent “employee-served” marker)
   - if any exist => return `409`
   - do NOT consider customer-open instances as conflicts
3. Inside a transaction:
   - Important payment contract: the backend must NOT create any persisted `SalesInstance` / `Order` / `salesGroup` rows until the payment is fully accepted as successful by the payment flow.
   - This includes any other persistence needed for the flow (e.g. `dailyReferenceNumber` / `DailySalesReport` writes): those must also be performed only in the post-payment transaction.
   - Therefore, this endpoint/step is invoked only after payment success, and the backend performs all DB writes atomically in a single transaction:
     - create a new `SalesInstance` (`openedAsRole = "customer"`, status likely `Occupied`)
     - create orders with `createOrders(...)`
     - run the same `closeOrders(...)` flow used by other sales instances:
       - orders are marked `Paid` (billing)
       - and the `SalesInstance` is completed/closed in the same way as the employee flow
     - only after successful `closeOrders` should reporting be updated (`DailySalesReport.selfOrderingSalesReport`)
4. Sending to kitchen (difference vs employee flow):
  - employee orders can be marked orderStatus as "Sent" immediately as they are added
  - self customer orders (QR self-order / delivery):
    - must become orderStatus as "Sent" only after payment completion (`closeOrders` succeeds and the transaction commits after orders become `Paid`)
    - kitchen does NOT receive ticket/print notifications from the backend
    - instead, kitchen reads the database and uses the persisted order state (`orderStatus`) to know what to prepare
    - use `salesGroup.orderCode` to group items per customer/session so kitchen can disambiguate which items belong together
    - the backend still sends the customer:
      - an in-app notification with the order receipt/details
      - an email receipt with the same receipt/details
    - customer receipt sending can happen concurrently with kitchen readiness state updates
5. Make concurrency safe:
   - with the conflict narrowed to employee instances, “customer vs customer” races become non-issues
   - remaining employee-vs-customer race can still exist; decide whether application-level checks are enough or enforce with a partial unique index on employee-open.

Customer self-order abandonment/cleanup (critical):
- With the payment contract above, the backend creates no persisted `SalesInstance` / `Order` / `salesGroup` rows unless payment is accepted as successful.
- And it performs no other persistence (including daily reference/report writes) until payment is accepted.
- Therefore, abandonment (app close, timeout, payment failure) is handled before the backend “post-payment” endpoint/step is invoked:
  - Dispatch/print + receipt notification/email must be triggered only after payment (`closeOrders` success + orders are `Paid` and the transaction commits).

Granularity / attribution detail:
- Same QR (same `SalesPoint`, same location) can represent multiple concurrent customers.
- The waiter/kitchen can disambiguate which items belong to which customer using `salesGroup.orderCode`:
  - `salesInstance.salesGroup` is an array of "time-batches" where each batch has its own unique `orderCode`
  - kitchen uses the `orderCode` of the relevant `salesGroup` batch to disambiguate concurrent customer items
- Kitchen tickets/prints should include:
  - `responsibleByUserId` (staff/employee responsible at time of dispatch/fulfillment; ensure it is populated for customer/self-order sessions as well, using your chosen attribution rule)
  - table / physical location label (`salesPointName`, or derived human label)
  - the `orderCode` for that `salesGroup` (this is the primary customer/session discriminator)
  - order items for that `salesGroup` (each item/businessGood with quantity and relevant modifiers/add-ons)
  - time of order (use `salesGroup.createdAt` or the displayed order-group timestamp)
  - the customer/user name (if it exists) alongside the receipt details
  - for delivery/self-order, also include a delivery/customer name that is the same as `responsibleByUserId` (e.g. `clientName` or delivery destination summary)

### Recommendation (flow maximization)
- Centralize the “customer self-order completion” logic into a single server-side step that runs only after payment completion (`closeOrders` succeeds and orders are `Paid`):
  - mark/close the `SalesInstance`
  - update persisted order state so kitchen can pick them up by reading the DB (kitchen uses persisted `orderStatus`)
  - send in-app notification + email receipt

### D) Delivery orders
Where (current):
- `backend/src/routes/v1/salesInstances.ts` POST `/delivery`

Proposed behavior:
1. Validate delivery enabled + business open hours + delivery sales point configured.
2. Important payment contract: the backend must NOT persist any `SalesInstance` / `Order` / `salesGroup` rows until payment is fully accepted.
   - This includes any other persistence needed for the flow (e.g. `dailyReferenceNumber` / `DailySalesReport` writes): those must also be performed only in the post-payment transaction.
3. After payment is accepted, create a `SalesInstance` under the delivery sales point with `openedAsRole = "customer"` (as in your code).
4. Since delivery is “virtual”, you likely do not need any salesPoint occupancy conflict at all.
5. Create orders + apply promotions + close orders with payment (customer pays the whole delivery order at once):
   - all SalesInstance/Order/salesGroup writes must happen in a single transaction and be committed only after `closeOrders(...)` succeeds and orders are marked `Paid`
   - `closeOrders` also completes the `SalesInstance` lifecycle (marks it `Closed`) exactly like other paid sales instances
   - after payment is fully completed/received by the restaurant (after `closeOrders` succeeds and orders are `Paid`), the customer must immediately receive:
     - an in-app notification with the order receipt/details
     - an email receipt with the same receipt/details
   - this is triggered via `sendOrderConfirmation(...)` after `closeOrders` completes successfully (fire-and-forget) and before the endpoint returns the success response (`200/201`).
   - receipt content is generated by the communications template:
     - `backend/src/communications/templates/orderReceiptTemplate.ts`
     - it uses `orderCode` (from the created `salesGroup` batch) as the primary reference when present
     - delivery receipts can include delivery-specific fields (e.g. `deliveryAddress`)
6. Individual promotions on the model supose to have the property of "applyToDelivery" so management can decide if the promotion apply for the delivery or is just for seated in customers. We must add those to the model, routes, helpers and dummy data
7. Delivery supose to be give the choice to delivery to the user address or a differnt one where he can set manualy just for that delivery. This logic must be implemented

Delivery address detail:
- If the `SalesInstance` is delivery (`salesPointType === "delivery"` via the linked `SalesPoint`), the delivery fulfillment should use the customer address:
  - `deliveryAddress` from request if provided
  - otherwise fallback to `user.address`

Optional:
- If you have operational concerns about multiple open delivery instances, you can still constrain with per-business rules, but based on your requirements, “allow multiple” seems expected.

### E) Closing orders / transfer orders (PATCH)
Where (current):
- `backend/src/routes/v1/salesInstances.ts` PATCH `/:salesInstanceId`
- `backend/src/routes/v1/salesInstances.ts` PATCH `/:salesInstanceId/transferSalesPoint`

Proposed constraints aligned with your carve-out:
1. For operations like:
   - close orders with payment (`paymentMethodArr + ordersIdsArr`)
   - transfer orders between sales instances
   - cancel orders
2. Only allow if the target `SalesInstance` is employee-open (or at least not customer self-order/delivery).
   - Determine this by reading `salesInstance.openedAsRole` (and/or the connected `salesPoint.salesPointType`).
3. Authorization:
   - require authSession for these operations
   - for management-only operations (like cancel), keep strict management-role checks (you already do)
   - for closing and transfer:
     - allow only on-duty employee who can operate on that business OR management roles (your choice, but it must be explicit)
4. Data integrity:
   - for close/cancel: validate that `ordersIdsArr` all belong to the PATCHed `salesInstanceId`
   - for transfer: validate that `ordersIdsArr` all belong to the *source* sales instance (see receiver-request rule below)
   - validate that orders are in correct state (`billingStatus: "Open"`) for close/cancel/transfer
   - validate business scoping when transferring orders between points.

Transfer rule (implemented): receiver requests (no sender approval)
- Transfers are initiated by the employee/sales instance that will **receive** the orders.
- API shape:
  - receiver calls `PATCH /salesInstances/:receiverSalesInstanceId`
  - body contains:
    - `toSalesInstanceId = sourceSalesInstanceId` (current owner of the orders)
    - `ordersIdsArr = [...]` (orders to move)
- The backend moves orders immediately (no sender acceptance step).

### F) Orders creation (`POST /orders` + `createOrders(...)`)
Where (current):
- `backend/src/routes/v1/orders.ts` POST `/`
- `backend/src/orders/createOrders.ts`

Proposed hardening:
1. In `createOrders(...)`, always fetch:
   - SalesInstance by `_id = salesInstanceId` with `businessId = provided businessId`.
2. Enforce:
   - if sales instance not found -> error
   - if sales instance is `Closed` -> error
3. Only then:
   - insert orders and update SalesInstance.salesGroup.

Also consider:
- Even for customer-created orders (`createdAsRole === "customer"`), enforce these checks. (Right now your helper checks status only for employee role path.)

---

## Database-level enforcement ideas (optional but strongly suggested for concurrency)

If you want strong “only one employee-open instance at a time per salesPointId”, application checks may still fail under concurrent requests.

Two options:

### Option 1: Partial unique index on employee-open instances
Concept:
- Create a partial unique index across `(businessId, salesPointId)` for documents where:
  - `salesInstanceStatus != "Closed"` AND `openedAsRole == "employee"`

Then:
- All attempts to open employee-open instances concurrently for the same point will fail reliably at the DB layer.
- Customer self-order/delivery instances will not violate the index because they are `openedAsRole == "customer"`.

Trade-off:
- You may need to guarantee `openedAsRole` is always set (it is set on your creation paths today, but verify for all code paths).

Current backend status:
- This DB-level enforcement is **not enabled**; the app relies on the centralized conflict helper (`pointBusyForEmployee`) and endpoint-level checks.

### Option 2: App-level checks + stronger transactions
Concept:
- Keep the narrowed conflict queries (employee-open only for customer flows).
- Wrap conflict check + create inside the same transaction.

Trade-off:
- Transactions alone do not always prevent all anomalies depending on isolation and concurrent writes.

---

## QR gating server-authoritative ideas
You need server-side correctness without breaking “multiple customers can self-order concurrently”.

In the simplified model, QR behavior is dictated by:
- `SalesPoint.selfOrdering` (whether the QR leads customers to self-order app vs a static menu)
- scanner identity (customer vs employee-on-duty)
- `SalesInstance.openedAsRole` (employee-open blocks other employee-open instances; customer-open does not block other customer-open instances)

Desired QR scan behavior:
1. If `SalesPoint.selfOrdering === true`:
   - customer scan => self-order app
   - employee scan => must NOT open/occupy as an employee-open SalesInstance for that point (employee QR should only navigate to the employee flow without creating the self-order session)
2. If `SalesPoint.selfOrdering === false`:
   - customer scan => static menu
   - employee scan => open/occupy via employee-open flow rules

Concurrency implications:
- remove any “global QR disable” concept from server logic
- customer/self-order/delivery can create multiple concurrent `openedAsRole === "customer"` sales instances
- only employee-open openings remain restricted to avoid double-booking the same physical point

Optional anti-duplicates:
- for customer self-order, prefer idempotency at the request/payment creation step (not QR cooldown), so multiple customers at the same QR still work correctly

---

## Summary of what changes conceptually (mapping to your 1..7)
1. Change “open conflict rule” for employee flow from “per day” to “at a time” (remove dailyReferenceNumber from conflict).
2. Introduce mode-aware conflict:
   - employee-open conflicts are strict (block other opens)
   - customer self-order/delivery conflicts are weak (block only employee-open)
3. Add `businessId` scoping to SalesPoint validation in POS open.
4. Add auth + integrity to PATCH operations, but disallow those operations for customer-open sales instances (delivery/self-order).
5. Verify SalesInstance belongs to business in `createOrders(...)`.
6. Narrow customer self-order conflict query to employee-open only, and avoid global blocking.
7. Make QR scan/server behavior authoritative without global QR disable (employee-open busy rule + optional customer idempotency).

---

## Questions to validate before implementation
1. When an employee has an open instance at a table, do you still want to block QR customer self ordering?
   - My interpretation based on your “open conflict only for employee” rule is: block ONLY employee-open instances, allow multiple customer instances otherwise.
2. Should “at a time” uniqueness apply to reservation seating and transfer rules too (meaning remove dailyReferenceNumber there as well)?
3. For delivery, do you want any occupancy constraint at all, or is it fully exempt?
4. For QR scan/server behavior: should employee `openTable` rely purely on the employee-open busy rule (and/or optional DB uniqueness), while customer self-order relies on optional request/payment idempotency?

