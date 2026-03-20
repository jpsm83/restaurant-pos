## Goal
Unify the notification, reservation, and order-confirmation flows so that “customer vs employee” is derived from the `User` identity at runtime, and the standalone `Customer` model is removed.

## New rules / invariants (target state)
1. There is no `Customer` model/collection. Any “customer recipient” is a `User` document identified by `userId`.
2. “Employee vs customer at that time” is determined from `User`:
   - If `User.employeeDetails` (or the employee link) does not exist, the user is a `customer` at that time.
   - If `User.employeeDetails` exists, the user is an `employee` only if the schedule/on-duty rule says they are on duty at that time; otherwise they are a `customer`.
3. Notifications are sent by business-scoped `Notification` documents, but recipients are updated on `User.notifications` only (notification inbox state is centralized on `User`; `Employee` does not store notifications).
4. Reservation notifications and order-confirmation notifications must both use the same recipient identity logic (always `User` IDs for customer recipients).

## What you will change (high level)
- Data model updates: remove `Customer` model files; update `Notification` recipient refs and route/service logic to use `User`.
- Runtime role checks: add/centralize a helper that resolves effective role (employee vs customer) based on schedule + onDuty.
- Flow wiring: ensure reservation and order-confirmation creation uses the unified recipient logic.
- Tests + fixtures: update notification-related tests and any fixtures that create `Customer` documents.
- Documentation: update markdown docs that mention the old `Customer` model or old recipient assumptions.

## Execution plan (follow in order)

### Step 1) Inventory the current code paths (no code changes yet)
1. List all places that reference the `Customer` model or `customersRecipientsIds` assumptions.
   - Search terms: `Customer`, `customer`, `customersRecipientsIds`, `populate({ model: Customer`, `ref: "Customer"`.
2. Identify the current producers of notifications:
   - Reservation notification sender(s)
   - Order-confirmation notification sender(s)
   - Any other notification creation route/service
3. Identify the current notification consumers:
   - `backend/src/routes/v1/notifications.ts` (current listing/populate/update logic)
   - Any other route that reads recipients or updates notification read/deleted flags
4. Identify where “employee mode” is computed today:
   - Login/mode-selection flow
   - Schedule checks
   - Any job that updates `Employee.onDuty`

5. Review the *entire* codebase for any other places that distinguish “customer vs employee” and might be impacted by removing `Customer`.
   - Examples: reservations handling, order creation/attribution, daily sales aggregation, auth/middleware gating, and any UI/API decisions based on the current mode.
   - For every discovered branching point, mark it as needing to use the same “effective role at that time” logic described in Step 2 (do not duplicate ad-hoc checks).

Deliverable for Step 1:
- A short list (copy/paste) of the files you must change, grouped by:
  - DB schema
  - Notification model + route
  - Reservation notification sender(s)
  - Order-confirmation sender(s)
  - Schedule/onDuty role resolution logic
  - Tests
  - Docs

Step 1 results (identified files & why they matter):
- DB schema
  - `backend/src/models/customer.ts`: remove entire `Customer` model/collection
  - `backend/src/models/notification.ts`: `customersRecipientsIds` currently references `ref: "Customer"` (must align to `User`)
  - `lib/db/models/notification.ts`: same `customersRecipientsIds` `ref` mismatch (must align to `User`)
- Notification model + route
  - `backend/src/routes/v1/notifications.ts`: currently imports `Customer` and uses `populate(... model: Customer)`, `Customer.exists(...)`, and updates either `Employee` or `Customer` recipients
  - `lib/interface/INotification.ts`: recipient types/comments must reflect that customer recipients are `User` IDs
  - `backend/tests/routes/notifications.test.ts`: currently focuses on employee recipients; add/adjust tests for customer recipients once `Customer` is gone
- Reservation notification sender(s)
  - `backend/src/routes/v1/reservations.ts`: determines `createdByRole` using `Employee.onDuty` (effective-role logic needs unification)
  - `backend/src/reservations/sendReservationCustomerFlow.ts`: sends reservation notifications to the customer `User` plus managers via `getOnDutyManagersUserIds` (ensure it uses the same effective-role resolution everywhere)
  - `backend/src/reservations/sendReservationNotification.ts`: already targets `User.notifications` but still writes `customersRecipientsIds` into the `Notification` document (must align with updated `Notification` schema/ref)
  - `lib/reservations/sendReservationNotification.ts`: mirrors the backend behavior; must align with schema changes
- Order-confirmation sender(s)
  - `backend/src/orderConfirmation/sendOrderConfirmation.ts`: triggers the notification sender
  - `backend/src/orderConfirmation/sendOrderConfirmationNotification.ts`: already targets `User.notifications` but writes `customersRecipientsIds` into `Notification`
  - `lib/orderConfirmation/sendOrderConfirmationNotification.ts`: mirrors backend behavior
- Schedule/onDuty role resolution logic
  - `backend/src/auth/canLogAsEmployee.ts`: schedule window check used to decide `canLogAsEmployee` at login
  - `backend/src/routes/v1/salesInstances.ts`: reads `Employee.onDuty` to allow “open table” as employee from POS/QR
  - `backend/src/routes/v1/reservations.ts`: reads `Employee.onDuty` to set `createdByRole`
  - `backend/src/reservations/getOnDutyManagersUserIds.ts`: reads `Employee.onDuty` + management roles to notify managers
  - `backend/src/inventories/checkLowStockAndNotify.ts`: reads `Employee.onDuty` + `currentShiftRole` to notify managers
  - `backend/src/monthlyBusinessReport/sendMonthlyReportReadyNotification.ts`: notifies on-duty/management recipients when a monthly report is ready
  - `backend/src/weeklyBusinessReport/sendWeeklyReportReadyNotification.ts`: notifies on-duty/management recipients when a weekly report is ready
- Tests
  - `backend/tests/routes/reservations.test.ts`: explicitly creates `Employee` with `onDuty: true` to test employee reservations; will need adjustment once effective-role logic is centralized
  - `backend/tests/helpers/inventories.test.ts`: depends on `Employee.onDuty` for manager notification behavior
  - `backend/tests/routes/notifications.test.ts`: add coverage for customer recipient notifications (after removing `Customer`)
- Docs
  - `context.md`: verify that the “Users and notifications” section matches the final invariant: customer recipients are `User` IDs (no `Customer` model)

### Step 2) Define the single source of truth for “effective role”
1. Create a single helper conceptually (implement later) that answers:
   - Input: `(userId, businessId, now)` (where `now` defaults to `new Date()` if not provided)
   - Output: `"employee"` or `"customer"` for that moment
2. Helper algorithm (must be the only place where this decision is made):
   - Load `User` by `userId` and check `User.employeeDetails`
     - If `User.employeeDetails` is missing/undefined => return `"customer"`
   - Load `Employee` by `User.employeeDetails`
     - If `Employee.businessId` does not match `businessId` => return `"customer"` (wrong tenant)
   - Compute `scheduleAllowed` using the existing schedule/window logic:
     - Reuse `canLogAsEmployee(employeeId)` as the schedule window check (it already:
       - verifies employee is active/not terminated,
       - checks scheduled shift covering `now` (with the 5-minute-before-start window),
       - allows management roles to bypass the schedule window)
   - Apply your on-duty rule:
     - If `scheduleAllowed === true` AND `Employee.onDuty === true` => return `"employee"`
     - Otherwise => return `"customer"`
3. Helper placement/name (keep it consistent across the codebase later):
   - Put it somewhere reusable by routes/services (example: `backend/src/auth/` or `backend/src/utils/`).
   - Use a clear name like `getEffectiveUserRoleAtTime(...)` and return only `"employee" | "customer"`.

Deliverable for Step 2:
- A single, copy/pastable spec for the helper (the algorithm above), explicitly using:
  - `User.employeeDetails` to decide “has employee link”
  - `canLogAsEmployee(...)` to decide “schedule window / management bypass”
  - `Employee.onDuty` to decide “currently employee vs currently customer”

### Step 3) Update DB models and remove the `Customer` model
1. Delete/retire the `Customer` model code and its collection:
   - Backend model(s) file(s) that define the `Customer` schema
   - Any shared/lib `Customer` model(s) if they exist
2. Update `Notification` schema:
   - Ensure `customersRecipientsIds` points to the `User` collection (ref `"User"`) or rename it to something clearer (example: `userRecipientsIds`) if you want that refactor.
3. Update any other schemas that store recipient data:
   - If anything stores “customer notifications” on `Customer`, migrate that to `User.notifications` instead.
4. Update TypeScript types and interfaces:
   - Any `ICustomer` / `Customer`-related types in `lib/` should be removed or adjusted.
   - Update `INotification` to match the new recipient identity type (User ids for customer recipients).

Deliverable for Step 3:
- No runtime references remain to the `Customer` model/collection.

### Step 4) Unify the notification route `GET/PUT/PATCH/DELETE /notifications` behavior
1. Update `backend/src/routes/v1/notifications.ts` so it no longer imports or uses the `Customer` model.
2. Replace populate/update logic:
   - Populate customer recipients using `User` instead of `Customer`
   - Update recipient notification read/deleted flags on `User.notifications` when recipients are customers
3. Ensure employee recipients still work:
   - If employees are stored in `Employee.notifications`, keep logic consistent
   - If you want fully unified behavior, change employee notification state storage to also use `User.notifications`
4. Ensure selects/fields match your UI needs:
   - If you previously used `customerName`, ensure you can derive equivalent fields from `User` (e.g. `personalDetails.firstName/lastName` and/or `username`)

Deliverable for Step 4:
- Notification endpoints return correct recipient info for both employees and customers, without referencing `Customer`.

### Step 5) Update reservation notification creation to target `User` correctly
1. In reservation notification sender(s), ensure `customersRecipientsIds` is populated with `User` ids (not `Customer` ids).
2. Ensure the recipient inbox updates write to `User.notifications`.
3. Confirm recipient identity uses the effective role rules:
   - If reservation notifications should reach only customers (not employees), send to customer recipients only
   - If some reservation notifications go to employees on duty, use employee recipient logic accordingly

Deliverable for Step 5:
- Reservation notifications appear in the correct inboxes for both customer and employee cases.

### Step 6) Update order-confirmation notification creation to target `User` correctly
1. In order-confirmation notification sender(s):
   - Ensure `customersRecipientsIds` stores `User` ids
   - Ensure it updates `User.notifications`
2. Confirm email + in-app notification flows are still consistent:
   - Self-ordering and delivery should both follow the same recipient identity model

Deliverable for Step 6:
- Order confirmation in-app notifications appear for the right user(s) without needing `Customer`.

### Step 7) Remove/replace “mode selection” assumptions in notification context
1. Locate any logic that assumed:
   - “If it’s not employee, it’s Customer model”
2. Replace it so that notification behavior uses effective role (Step 2) to decide which recipient set gets updated.
3. Confirm the mode-selection cookie/session does not accidentally select an outdated concept of “customer object”

Deliverable for Step 7:
- No flow depends on a `Customer` collection anymore.

### Step 8) Update tests and fixtures
1. Update notification route tests:
   - Remove `Customer` fixture creation
   - Use `User` fixtures and verify correct populate/update behavior
2. Update reservation and order confirmation tests (if present):
   - Ensure they validate that `User.notifications` is modified
3. Update any helpers that create “customer” documents.
4. Run the full backend test suite.

Deliverable for Step 8:
- All tests pass with the new `User`-only recipient model.

### Step 9) Update markdown documentation (the “.md files necessary”)
Update docs to reflect:
1. There is no `Customer` model; customers are represented by `User` ids.
2. Effective role rules (employee vs customer at that time) are derived from schedule/onDuty logic.
3. Notification recipients:
   - customer recipients are `User` ids
   - employee recipients are handled consistently with your final design (either `Employee.notifications` or `User.notifications`)

Concrete doc targets to review/update:
1. `context.md` (sections that describe Users and notifications)
2. `backend/README.md` (if it documents notifications behavior)
3. Any subsystem README files that mention `Customer` or `customersRecipientsIds`
   - If you don’t have dedicated subsystem README files, add/update the closest existing ones near the relevant backend domains.

Deliverable for Step 9:
- Docs match the new invariants and no longer mention `Customer` as a persistence layer.

### Step 10) Final verification checklist (before merging)
1. Create a reservation as a user who is currently “customer” and verify the notification goes to the user inbox.
2. Create a reservation as a user who is currently “employee/on duty” and verify the correct employee recipient path.
3. Trigger both self-ordering and delivery order-confirmation flows and verify notification inboxes.
4. List notifications endpoint:
   - Populate shows correct recipient identity without `Customer`
5. Patch/delete notifications:
   - Read/deleted flags update correctly for both roles.

## Tasks (execute in order)
Use this section as the command-ready checklist. Each “Task N” corresponds to the “Step N” content above.

### Task 1) Inventory & identify what depends on `Customer` / customer-recipient branching
1. [x] Find every reference to `Customer` and every assumption about `customersRecipientsIds`
2. [x] Identify all notification producers and consumers
3. [x] Identify all places where customer vs employee is decided today (`auth`, schedule/onDuty, and other branching)
4. [x] Review the full codebase for any remaining customer/employee branching impacted by removing `Customer`
5. [x] Use the listed “Step 1 results” as your file-change shortlist

Acceptance criteria: completed. Shortlist (grouped):
- DB schema
  - `backend/src/models/customer.ts`: `Customer` model will be removed
  - `backend/src/models/notification.ts`: `customersRecipientsIds` currently `ref: "Customer"` (needs alignment to `User`)
  - `lib/db/models/notification.ts`: `customersRecipientsIds` currently `ref: "Customer"` (needs alignment to `User`)
- Notification model + route
  - `backend/src/routes/v1/notifications.ts`: imports/uses `Customer` (populate/exists/update) for customer recipients
  - `backend/tests/routes/notifications.test.ts`: add/adjust tests for customer recipients after removal
- Reservation / order-confirmation producers (writes recipient inbox state)
  - `backend/src/reservations/sendReservationNotification.ts`: notification doc creation + pushes into `User.notifications`
  - `backend/src/orderConfirmation/sendOrderConfirmationNotification.ts`: notification doc creation + pushes into `User.notifications`
  - `lib/reservations/sendReservationNotification.ts`, `lib/orderConfirmation/sendOrderConfirmationNotification.ts`: keep in sync with backend
- Effective-role / onDuty decision points (where “customer vs employee at that time” is determined today)
  - `backend/src/auth/canLogAsEmployee.ts`: schedule window check + management bypass
  - `backend/src/auth/getEffectiveUserRoleAtTime.ts`: centralized helper for “employee vs customer at that time”
  - `backend/src/auth/auth.ts`: login sets `canLogAsEmployee` in session via `canLogAsEmployee(...)`
  - `backend/src/routes/v1/salesInstances.ts`: reads `Employee.onDuty` to allow employee actions
  - `backend/src/routes/v1/reservations.ts`: reads `Employee.onDuty` to set `createdByRole`
  - `backend/src/reservations/getOnDutyManagersUserIds.ts`, `backend/src/inventories/checkLowStockAndNotify.ts`: reads `Employee.onDuty` + management roles
- Customer vs employee role attribution elsewhere (to verify impact during removal)
  - `backend/src/models/salesInstance.ts`, `backend/src/salesInstances/createSalesInstance.ts`
  - `backend/src/models/reservation.ts`
  - `backend/src/models/order.ts`, `backend/src/orders/createOrders.ts`
  - `backend/src/routes/v1/salesInstances.ts`, `backend/src/routes/v1/reservations.ts`
  - `backend/src/dailySalesReports/updateEmployeeDailySalesReport.ts`
- Docs
  - `context.md`: verify customer/inbox semantics match “no `Customer` persistence model”

### Task 2) Effective-role helper spec (single source of truth)
1. [x] Create the helper spec/signature: `(userId, businessId, now) -> "employee" | "customer"`
2. [x] Ensure helper algorithm is exactly: `User.employeeDetails` -> `Employee.businessId` -> `canLogAsEmployee` -> `Employee.onDuty`
3. [x] Decide where to place the helper so all routes/services can reuse it

Acceptance criteria: the spec below is copy/pastable and will be reused everywhere (no duplicated logic).

Copy/pastable helper spec (pseudo-code):
```ts
type EffectiveRole = "employee" | "customer";

// Proposed location: `backend/src/auth/getEffectiveUserRoleAtTime.ts`
// (or `backend/src/utils/` if you prefer; the key is: reuse the same helper everywhere)
export async function getEffectiveUserRoleAtTime(params: {
  userId: import("mongoose").Types.ObjectId | string;
  businessId: import("mongoose").Types.ObjectId | string;
  now?: Date;
}): Promise<EffectiveRole> {
  const { userId, businessId, now = new Date() } = params;

  // 1) Load User and check employee link
  const user = await User.findById(userId)
    .select("employeeDetails")
    .lean<{ employeeDetails?: import("mongoose").Types.ObjectId } | null>();

  if (!user?.employeeDetails) return "customer";

  // 2) Load Employee (for tenant match + onDuty)
  const employee = await Employee.findById(user.employeeDetails)
    .select("businessId onDuty")
    .lean<{ businessId: import("mongoose").Types.ObjectId; onDuty: boolean } | null>();

  if (!employee) return "customer";
  if (String(employee.businessId) !== String(businessId)) return "customer";

  // 3) scheduleAllowed using existing schedule/window logic
  // Note: `canLogAsEmployee` already includes management bypass + shift window checks.
  const { canLogAsEmployee: scheduleAllowed } = await canLogAsEmployee(
    user.employeeDetails,
    now
  );

  // 4) Apply on-duty rule (this is what decides customer vs employee "at this time")
  return scheduleAllowed === true && employee.onDuty === true ? "employee" : "customer";
}
```

Important notes to keep logic consistent:
- Always gate on-duty with `Employee.onDuty` (even if `canLogAsEmployee` is true for management roles).
- Tenant isolation: if `Employee.businessId !== businessId`, treat as `"customer"`.

Code status (already implemented):
- Added `backend/src/auth/getEffectiveUserRoleAtTime.ts`
- Updated `backend/src/auth/canLogAsEmployee.ts` to accept an optional `now?: Date` parameter

### Task 3) Remove `Customer` model and align DB schemas/types
1. [x] Remove `backend/src/models/customer.ts` (and any other `Customer` model)
2. [x] Update `Notification` recipient ref so customer recipients are `User` ids
3. [x] Move/align notification inbox state to `User.notifications` for both:
   - customer recipients (done)
  - employee recipients (done in Task 7.5)
4. [x] Update `lib/` TS types/interfaces (`INotification`, remove `ICustomer` if present)
Acceptance criteria:
- No runtime references remain to `Customer` (model removed + customer recipients point to `User`)
- Centralizing employee inbox state into `User.notifications` is handled by Task 7.5.

### Task 4) Unify `/notifications` route to use `User` for customer recipients
1. [x] Remove `Customer` from `backend/src/routes/v1/notifications.ts`
2. [x] Populate/update customer recipients using `User`
3. [x] Keep employee recipient behavior correct per your chosen inbox storage (`User.notifications` only)
4. [x] Ensure UI-needed fields for employee recipients can be derived from `User` (first/last name + username)
Acceptance criteria:
- Customer recipients branch works without any `Customer` dependency
- Employee recipients branch still needs to be updated to write/read from `User.notifications` (Task 7.5).

### Task 5) Reservation notifications: always target correct `User` inbox
1. [x] Store customer recipients as `User` ids
2. [x] Ensure inbox write is to `User.notifications`
3. [x] Ensure reservation notification recipient selection matches effective-role rules
Acceptance criteria: reservation notifications appear in correct inboxes.

### Task 6) Order-confirmation notifications: always target correct `User` inbox
1. [x] Store customer recipients as `User` ids
2. [x] Ensure inbox write is to `User.notifications`
3. [x] Verify self-ordering and delivery share the same identity model
Acceptance criteria: order confirmations show correct in-app notifications without `Customer`.

### Task 7) Remove “mode selection” assumptions tied to `Customer`
1. [x] Find any remaining “if not employee then Customer” style logic
2. [x] Replace with the effective-role helper decision
3. [x] Validate mode cookie/session doesn’t encode an outdated “customer object”
Acceptance criteria: no flow depends on a `Customer` collection anymore.

### Task 7.0) Re-review tasks 1–7 for consistency with notification inbox centralization
1. [x] Confirm Task 3/4/5/6 remain correct for customer recipients (already use `User.notifications`)
2. [x] Confirm Task 4 employee-recipient logic is re-worked under Task 7.5 (this change invalidates “employee branch” assumptions)
3. [x] Confirm Task 5/6 do not accidentally depend on `Employee.notifications` (they should only target `User.notifications`)
4. [x] Confirm Task 7 (“no Customer dependency”) still holds after Task 7.5 changes

Acceptance criteria:
- Only inbox storage changes; customer-vs-employee determination stays consistent with Tasks 1–2.

### Task 7.5) Centralize notification inbox state into `User.notifications` (remove `Employee.notifications` usage)
1. [x] Inventory all remaining writes/reads to `Employee.notifications` and remove them in favor of `User.notifications`.
   - Verify reservation/order-confirmation writers remain correct (`sendReservationNotification`, `sendOrderConfirmationNotification`).
2. [x] Update writers that still push notification entries to `Employee.notifications`:
   - `backend/src/routes/v1/notifications.ts` (employee recipients branch for POST/PATCH/DELETE)
   - `backend/src/inventories/checkLowStockAndNotify.ts`
   - `backend/src/monthlyBusinessReport/sendMonthlyReportReadyNotification.ts`
   - `backend/src/weeklyBusinessReport/sendWeeklyReportReadyNotification.ts`
3. [x] Update `backend/src/routes/v1/notifications.ts` so **both** branches update inbox state via `User.notifications`:
   - For `customersRecipientsIds` => update `User` (already being done)
   - For `employeesRecipientsIds` => map `Employee -> userId` and update `User.notifications`
4. [x] Update `/notifications` listing/select fields for employee recipients:
   - employee recipients should be displayed via the linked `User` fields (first/last/username)
   - avoid relying on `employeeName` or any non-existent `Employee` inbox fields
5. [x] Update tests that currently assert `Employee.notifications` to assert `User.notifications` instead:
   - `backend/tests/routes/notifications.test.ts`
6. [ ] Update docs/invariants to state that notification inbox state is centralized on `User.notifications` only.

Acceptance criteria:
- No runtime code path writes to `Employee.notifications`.
- Notification CRUD/list endpoints still work for both employee and customer recipients.
- Tests validate `User.notifications` updates for employee recipients.

### Task 8) Update tests & fixtures
1. [x] Update notification tests to cover `User` customer recipients and `User`-inbox updates for employee recipients
2. [x] Update reservation/order-confirmation tests to assert `User.notifications` changes
3. [x] Remove any fixture setup that creates `Customer` documents
4. [ ] Run full backend test suite
Acceptance criteria: all tests pass.

### Task 9) Update docs
1. [ ] Update docs to remove `Customer` persistence layer wording
2. [ ] Document effective-role rule and recipient semantics (customer recipients are `User` ids)
3. [ ] Document that notification inbox state is centralized on `User.notifications` for both customers and employees
Acceptance criteria: docs match the new invariants.

### Task 10) Final verification
1. [ ] Reservation as customer -> notification goes to `User.notifications`
2. [ ] Reservation as employee/on duty -> correct recipient path
3. [ ] Self-ordering + delivery order confirmations -> notifications correct
4. [ ] `/notifications` list works and does not populate `Customer`
5. [ ] Patch/delete updates read/deleted flags correctly
Acceptance criteria: manual scenarios + endpoint behaviors look correct end-to-end.

## How to execute
Run the tasks in order. When you’re ready for a task, ask me to execute “Task N” (including “Task 7.5”).

