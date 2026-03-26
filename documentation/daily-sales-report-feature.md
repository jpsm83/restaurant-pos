# Daily Sales Report Feature (Source-of-Truth Documentation)

This document describes how the Daily Sales Report (DSR) feature currently works, based on implementation in backend source code.

---

## 1) Purpose and Scope

The Daily Sales Report system provides:

- real-time incremental accounting of finalized orders into actor buckets
- manager-facing aggregation actions (`calculate` and `close`)
- reconciliation/backfill safety paths
- tenant-scoped reporting retrieval with operational-day filters

It is centered on one business day key: `dailyReferenceNumber`.

---

## 2) Core Data Model

Main model: `backend/src/models/dailySalesReport.ts`

Top-level report identity:

- `businessId`
- `dailyReferenceNumber`
- `isDailyReportOpen`
- unique index on (`businessId`, `dailyReferenceNumber`)

Actor buckets:

- `employeesDailySalesReport` (array)
- `deliveryDailySalesReport` (single bucket)
- `selfOrderingSalesReport` (array with required `salesPointId`)

Shared actor metrics include:

- payment methods (`employeePaymentMethods`)
- sales/net/tips/COGS
- sold/voided/invited goods
- total void/invited values
- customer counters and averages

Top-level aggregate fields include:

- `dailyTotalSalesBeforeAdjustments`
- `dailyNetPaidAmount`
- `dailyTipsReceived`
- `dailyCostOfGoodsSold`
- `dailyProfit`
- `daily*Goods` arrays and void/invited totals
- `dailyPosSystemCommission`

Type interfaces: `packages/interfaces/IDailySalesReport.ts`

---

## 3) Canonical Attribution Logic

Resolver: `backend/src/dailySalesReports/resolveFinalizationActorReportTarget.ts`

Attribution order:

1. Determine effective role for `userId` in `businessId`.
2. If effective role is employee -> `employeesDailySalesReport`.
3. Else if `salesPointType === "delivery"` -> `deliveryDailySalesReport`.
4. Else -> `selfOrderingSalesReport`.

This resolver is reused in:

- paid finalization flow (`closeOrders`)
- void/invitation finalization flow (`finalizeOrdersBillingStatus`)
- reconciliation core (`reconciliationCore`)

---

## 4) Incremental Runtime Accounting

Delta applier: `backend/src/dailySalesReports/applyOrderFinalizationToActorReport.ts`

Supported final statuses:

- `Paid`
- `Void`
- `Invitation`
- `Cancel` (explicitly excluded from mutation)

Per-status behavior:

- `Paid`: updates gross/net/tips/COGS, payment methods, sold goods
- `Void`: updates COGS, voided goods, `totalVoidValue`
- `Invitation`: updates COGS, invited goods, `totalInvitedValue`
- `Cancel`: returns non-applied by policy

Row targeting:

- employee/delivery rows keyed by `userId`
- self-order rows keyed by (`userId`, `salesPointId`)

Delivery bucket behavior:

- `deliveryDailySalesReport` is a single object bucket in the report

---

## 5) Finalization Flows That Feed DSR

### 5.1 Paid Flow (`Open -> Paid`)

File: `backend/src/orders/closeOrders.ts`

High level:

1. Load only `Open` orders for provided IDs and `salesInstanceId`.
2. Validate total paid >= total net order amount.
3. Distribute payment methods across orders and assign tips.
4. Bulk update orders with filter `{ _id, billingStatus: "Open" }` for idempotency.
5. Resolve actor bucket with canonical resolver.
6. Apply per-order delta to DSR actor bucket.
7. Close `SalesInstance` when all grouped orders are paid.

Idempotency and telemetry:

- skipped updates are counted via rollout telemetry
- actor update success/failure telemetry is emitted per order

### 5.2 Non-Paid Finalization (`Open -> Void` or `Open -> Invitation`)

File: `backend/src/orders/finalizeOrdersBillingStatus.ts`

High level:

1. Load only `Open` orders for provided IDs and `salesInstanceId`.
2. Bulk set billing status to `Void` or `Invitation` with `Open` filter.
3. Resolve actor bucket with the same canonical resolver.
4. Apply per-order delta using shared delta applier.

Same protections:

- idempotent filter against `Open`
- telemetry for idempotency/success/failure

---

## 6) SalesInstance API Interactions

Primary route: `backend/src/routes/v1/salesInstances.ts`

### 6.1 Employee operations via `PATCH /api/v1/salesInstances/:salesInstanceId`

The route performs transactional operations with strict guards:

- validates IDs and session requirements
- enforces employee-open instance restrictions for sensitive operations
- validates all targeted orders belong to expected source/receiver instance
- requires `billingStatus: "Open"` for close/cancel/transfer/finalize paths

Operations affecting DSR:

- close with payment -> calls `closeOrders` (paid incremental updates)
- finalize void/invitation -> calls `finalizeOrdersBillingStatus`
- cancel/transfer do not use paid/void/invitation DSR deltas

Authorization details:

- cancel requires management roles
- void/invitation finalization requires management roles

### 6.2 Customer delivery flow (`POST /api/v1/salesInstances/delivery`)

Behavior:

- payment-first validation (server pricing, then payment total check)
- idempotency via `paymentId` (returns existing processed instance when retried)
- creates customer-open sales instance on delivery sales point
- creates orders and calls `closeOrders` in same transaction

DSR impact:

- final `closeOrders` call drives immediate actor updates
- attribution resolves to delivery bucket when user is not on-duty employee

### 6.3 Customer self-order flow (`POST /api/v1/salesInstances/selfOrderingLocation/:id`)

Behavior:

- enforces self-order eligibility and business open checks
- blocks on-duty employees from customer self-order flow
- payment-first validation and idempotent `paymentId` handling
- creates customer sales instance/orders and calls `closeOrders`

DSR impact:

- immediate actor update via paid finalization
- attribution resolves to self-order bucket for non-delivery customer context

---

## 7) DailySalesReports Manager APIs

Route file: `backend/src/routes/v1/dailySalesReports.ts`

### Access model

All management endpoints:

- require authenticated user session
- resolve manager business by employee roles
- enforce tenant isolation (`businessId` must match manager context)

### Endpoint responsibilities

- `GET /api/v1/dailySalesReports/`
  - list all reports for manager business
- `GET /api/v1/dailySalesReports/:dailySalesReportId`
  - get one report, tenant-checked
- `GET /api/v1/dailySalesReports/business/:businessId`
  - list by business with optional filters
- `PATCH /:id/calculateBusinessReport`
  - recompute top-level totals from actor rows
- `PATCH /:id/close`
  - blocks if open orders exist, recomputes top-level totals, sets `isDailyReportOpen=false`
- `PATCH /:id/calculateUsersReport`
  - reconciliation-only per-user rebuild path
- `PATCH /:id/reconcile`
  - full manual/admin rebuild from source orders

Filter semantics (`GET /business/:businessId`):

- `dailyReferenceNumber` exact
- `dailyReferenceNumberFrom` / `dailyReferenceNumberTo` range
- optional `startDate` / `endDate` on `createdAt`
- validation for integer inputs and range sanity

---

## 8) Reconciliation Pattern

Shared core: `backend/src/dailySalesReports/reconciliationCore.ts`

What it centralizes:

- payment method merge
- goods merge
- actor-row rebuild from orders
- top-level totals rebuild from actor rows
- commission calculation by subscription tier

Where used:

- manual reconcile endpoint (`PATCH /:dailySalesReportId/reconcile`)
- one-time script (`backend/scripts/reconcileOpenDailyReports.ts`)

Design split:

- runtime path = incremental order finalization (`closeOrders`, `finalizeOrdersBillingStatus`)
- admin safety path = full recomputation (`reconciliationCore`)

---

## 9) Rollout Controls and Observability

Files:

- `backend/src/dailySalesReports/rolloutControls.ts`
- `backend/src/dailySalesReports/rolloutTelemetry.ts`

Controls:

- `DAILY_SALES_INCREMENTAL_ENGINE_MODE` = `on` | `off` | `business-list`
- `DAILY_SALES_INCREMENTAL_BUSINESS_IDS` for allow-list mode
- `DAILY_SALES_AGGREGATE_MISMATCH_CHECK` toggle

Telemetry counters/logs:

- actor update success/failure
- idempotency skips
- aggregate mismatch checks and mismatch count

---

## 10) User Interaction Map

### Employee (front-of-house / manager)

- opens and manages sales instances
- closes orders with payment, or finalizes as void/invitation
- can calculate/close/reconcile daily reports (management-scoped)

### Customer (delivery/self-order)

- submits payment-backed orders through dedicated endpoints
- idempotency key (`paymentId`) protects against duplicate payment acceptance
- successful flows finalize orders and immediately reflect in actor buckets

### Business Manager

- queries daily reports by operational day and date filters
- triggers aggregate recalculation and close
- uses reconcile endpoint as corrective safety net

---

## 11) Invariants and Guarantees

- one open day report identity per business day key (`dailyReferenceNumber`)
- actor attribution uses one canonical resolver everywhere
- finalization writes are guarded by `billingStatus: "Open"` for idempotency
- sensitive mutations are transaction-based in sales instance route flows
- manager report APIs are tenant-scoped by authenticated business context

