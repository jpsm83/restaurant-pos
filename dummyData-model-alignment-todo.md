# Dummy Data -> Model Alignment TODO

Goal: make every file in `dummyData` match its corresponding schema in `backend/src/models` before moving data to MongoDB and testing endpoints.

Critical rules:
- If a model has no dummy data file yet, create one.
- Dummy data must be valid JSON accepted by MongoDB import/use.
- Keep relationship IDs consistent across all dummy files (same referenced IDs everywhere).
- JSON must include 100% of model properties (required and optional). If any property is missing in dummy data, add it.
- Final target: 100% JSON alignment with model structure and property names.
- `dummyData/customers.json` is dispensable as a separate dataset (user identity is centralized in `users.json`).
- `dummyData/employees.json` is required because employee operations are a separate model linked to user by `employeeDetails` <-> `userId`.
- Employee/customer identity must be represented from `user` model properties + employee link + runtime context (for employee context, schedule linkage).

## How to execute (simple flow)

1. Pick one unchecked item.
2. Open the dummy file and its model.
3. Compare all model fields (required + optional), types, enums, nested objects, and arrays.
4. Update dummy data to match the model exactly, including all optional properties.
5. Mark item as done.
6. Repeat until all items are done.
7. Check every model in `backend/src/models`; if one has no matching dummy file, add a new JSON dummy file for it.
8. Final validation: confirm each dummy file contains every model property (100% alignment).

## Scope to build (full dataset)

- [x] 1 full business document.
- [x] 2 users total (manager user + waiter user) in `user` model style.
- [x] Do not maintain separate `customers.json` dataset as source-of-truth.
- [x] Maintain `employees.json` dataset and keep it linked to `users.json`.
- [x] Represent manager vs waiter vs customer behavior through user-linked properties/context and schedules.
- [x] 7 schedules (one week), both users scheduled every day from 12:00 to 20:00.
- [x] 6 notifications (2 for manager user, 2 for waiter user, 2 for both users).
- [x] 2 full suppliers.
- [x] 13 supplier goods distributed exactly as requested.
- [x] 4 business goods:
- [x] cheeseburger (bun, burger, cheese, tomato, lettuce, salt, pepper)
- [x] pizza margarita (pizza bread, tomato sauce, oregano, shredar cheese, tomato, pepper)
- [x] water bottle 250ml
- [x] coca cola 33ml
- [x] 3 printers (kitchen, bar, office).
- [x] 2 promotions (2x1 lunch burgers; 50% pizzas any time).
- [x] 13 purchases (one per supplier good line set, all linked to supplier goods/suppliers/employees/business).
- [x] 10 sales locations (sales points) with varied types.
- [x] 2 sales instances:
- [x] instance A with 4 orders (2 cheeseburgers, 1 coca cola, 1 water)
- [x] instance B with 2 orders (1 pizza margarita, 1 water)
- [x] 6 orders total, all tied to those sales instances.
- [x] 1 inventory (starting from purchases minus consumed supplier goods from sold business goods).
- [x] 2 reservations with full model properties.
- [x] 2 daily sales reports with full model properties.
- [x] 2 weekly business reports with full model properties.
- [x] 2 monthly business reports with full model properties.
- [x] 4 ratings with full model properties.
- [x] 2 employee records with full model properties, linked to the 2 users.

## Phase plan with subtasks

### Phase 1 - Identity and staff base

- [x] Build `business.json` with 100% model properties.
- [x] Build users in a single user-based dataset (manager + waiter users, full `user` schema shape).
- [x] Remove dependence on separate `customers.json`.
- [x] Create/maintain `employees.json` and link users <-> employees.
- [x] Validate employee role logic:
- [x] manager and waiter are distinguished by user properties + schedules, not separate customer/employee models.

### Phase 2 - Scheduling and communications

- [x] Build `schedules.json` with 7 entries (one per day).
- [x] Each schedule includes both employees from 12:00 to 20:00.
- [x] Build `notifications.json` with 6 entries and recipient split (2 + 2 + 2).
- [x] Mirror notification links on each user `notifications` array in `users.json`.

### Phase 3 - Suppliers and menu chain

- [x] Build `suppliers.json` with 2 suppliers.
- [x] Build `supplierGoods.json` with 13 goods:
- [x] supplier A: bun, burger, water, pizza bread, oregano
- [x] supplier B: cheese, shredar cheese, coca cola, tomato, lettuce, salt, pepper, tomato sauce
- [x] Build `businessGoods.json` with 4 business goods fully populated.
- [x] Ensure ingredient references are by `supplierGoodId` and units/quantities are coherent.

### Phase 4 - Operations setup

- [x] Build `printers.json` with kitchen/bar/office printers and full properties.
- [x] Build `promotions.json` with 2 promotions and correct promotion windows/types.
- [x] Build `salesLocation.json` with 10 varied salesPoint types.

### Phase 5 - Transactions

- [x] Build `purchases.json` with 13 purchases tied to suppliers/supplierGoods/business/employee context.
- [x] Build `salesInstance.json` with exactly 2 instances and full properties.
- [x] Build `orders.json` with exactly 6 orders tied to those sales instances and business goods.
- [x] Confirm order split matches requested composition (4 in first instance, 2 in second).

### Phase 6 - Stock and reports

- [x] Build `inventories.json` with 1 inventory fully populated.
- [x] Inventory math check: purchased qty - consumed qty from ordered goods = current/dynamic counts.
- [x] Build `dailySalesReport.json` with 2 full reports.
- [x] Build `weeklyBusinessReports.json` with 2 full reports.
- [x] Build `monthlyBusinessReports.json` with 2 full reports.

### Phase 7 - Reservations and ratings

- [x] Build `reservations.json` with 2 full reservations tied to users/business/sales points.
- [x] Build `ratings.json` with 4 full ratings tied to users/business/orders.

### Phase 8 - Final 100% alignment validation

- [x] For every file, verify all model properties exist (required + optional).
- [x] Verify enum values are valid against `packages/enums.ts`.
- [x] Verify all ObjectId relations exist in referenced files.
- [x] Verify no orphan IDs and no mixed incompatible id formats.
- [x] Verify counts match requested scope exactly.

### Critical cross-file integrity task

- [x] Connect all IDs among all dummy data files being updated/created (global relation pass).
- [x] Verify every reference points to an existing `_id` in its target file.
- [x] Re-check IDs after each phase to avoid broken links before final validation.

## Notes while updating

- Keep field names identical to model names.
- Remove extra fields not accepted by the model.
- Add missing required fields.
- Add missing optional fields too (no model property should be absent).
- Use realistic values but prioritize schema correctness.
- Use MongoDB-friendly JSON values and structures in every file.
- Preserve relation IDs across files (for example user/business/order references must point to existing dummy documents).
- Treat `user` as the identity source; do not split identity source across `customers.json` and `employees.json`.
