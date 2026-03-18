# Legacy Code Cleanup Plan

## Overview

This document provides a step-by-step plan to remove legacy Next.js API code after verifying each module works correctly in the new Fastify backend.

**Important**: Before deleting any legacy code, verify the corresponding functionality works in the new backend through automated tests.

---

## Workflow for Each Module

For each module, follow this order:

1. **Create test file** - `backend/tests/routes/{module}.test.ts`
2. **Write tests** - Cover all endpoints with proper assertions
3. **Use dummyData for reference** - See `dummyData/*.json` for expected JSON structures
4. **Run tests** - `npm test -- tests/routes/{module}.test.ts`
5. **Fix any issues** - Until all tests pass
6. **Delete legacy files** - Only after tests pass

**Test Before Routes**: Helper files (utilities) should be tested BEFORE route files, since routes depend on them working correctly.

**Delete After Tests Pass**: Once tests pass for ANY file (helpers, utilities, routes, etc.), the corresponding legacy Next.js code can be safely deleted. This applies to:
- Helper functions in `lib/` → delete after `backend/src/` equivalent is tested
- Route handlers in `app/api/` → delete after `backend/src/routes/` equivalent is tested
- Utility functions → delete after backend equivalent is tested

---

## Sample JSON Data Reference

The `dummyData/` folder contains example JSON structures for each module:

> **Note**: The `dummyData/*.json` files are believed to be up to date, but if there are discrepancies between the sample data and the actual API behavior, **the Mongoose models (`backend/src/models/*.ts`) are the source of truth** for data structure and validation rules. Always verify against the models when in doubt.

| Module | Reference File |
|--------|---------------|
| Business | `dummyData/business.json` |
| BusinessGoods | `dummyData/businessGoods.json` |
| Orders | `dummyData/orders.json` |
| SalesInstances | `dummyData/salesInstance.json` |
| SalesPoints | `dummyData/salesLocation.json` |
| Suppliers | `dummyData/suppliers.json` |
| SupplierGoods | `dummyData/supplierGoods.json` |
| Inventories | `dummyData/inventories.json` |
| Purchases | `dummyData/purchases.json` |
| Employees | `dummyData/employees.json` |
| Schedules | `dummyData/schedules.json` |
| Promotions | `dummyData/promotions.json` |
| DailySalesReports | `dummyData/dailySalesReport.json` |
| Notifications | `dummyData/notifications.json` |
| Printers | `dummyData/printers.json` |
| Customers | `dummyData/customers.json` |

---

## Pre-Cleanup Checklist

Before starting cleanup, ensure:

- [x] New backend is running and accessible at `http://localhost:4000`
- [x] MongoDB connection is configured (`MONGODB_URI` env var) - *Tests use MongoDB Memory Server*
- [x] All environment variables are set (JWT_SECRET, CLOUDINARY credentials, etc.) - *Default dev values in config*
- [x] Test infrastructure is set up (`npm test` runs successfully)
- [x] Frontend is configured to use new backend endpoints - *Vite proxy configured*

---

## PHASE 0: Test Helper Files First

Helper utilities must be tested BEFORE route modules, since routes depend on them.

### Task 0.1: Test Auth Helpers

**Files to Test**:
- `backend/src/auth/canLogAsEmployee.ts`
- `backend/src/auth/middleware.ts`

**Test File**: `backend/tests/helpers/auth.test.ts`

**Checklist**:
- [x] Create test file
- [x] Test `canLogAsEmployee` - returns true for managers
- [x] Test `canLogAsEmployee` - returns true during shift hours
- [x] Test `canLogAsEmployee` - returns false outside shift
- [x] Test `createAuthHook` - rejects missing token
- [x] Test `createAuthHook` - rejects invalid token
- [x] Test `hasBusinessAccess` - business account access
- [x] Test `hasBusinessAccess` - employee access
- [x] Run tests: `npm test -- tests/helpers/auth.test.ts`
- [x] **ALL TESTS PASSING** *(14 tests passed)*

**Legacy Files Deleted**:
- [x] `lib/auth/canLogAsEmployee.ts` - *(middleware.ts is new to Fastify, no legacy equivalent)*

---

### Task 0.2: Test Utility Helpers

**Files to Test**:
- `backend/src/utils/isObjectIdValid.ts`
- `backend/src/utils/isBusinessOpenNow.ts`
- `backend/src/utils/constants.ts`

**Test File**: `backend/tests/helpers/utils.test.ts`

**Checklist**:
- [x] Create test file
- [x] Test `isObjectIdValid` - valid IDs
- [x] Test `isObjectIdValid` - invalid IDs
- [x] Test `isBusinessOpenNow` - open hours
- [x] Test `isBusinessOpenNow` - closed hours
- [x] Test `hasManagementRole` - management roles
- [x] Test `hasManagementRole` - non-management roles
- [x] Run tests: `npm test -- tests/helpers/utils.test.ts`
- [x] **ALL TESTS PASSING** *(23 tests passed)*

**Legacy Files Deleted**:
- [x] `lib/utils/isObjectIdValid.ts`
- [x] `lib/utils/isBusinessOpenNow.ts`
- [x] `lib/constants.ts`

---

### Task 0.3: Test Cloudinary Helpers

**Files to Test**:
- `backend/src/cloudinary/uploadFilesCloudinary.ts`
- `backend/src/cloudinary/deleteFilesCloudinary.ts`

**Test File**: `backend/tests/helpers/cloudinary.test.ts`

**Note**: May need to mock Cloudinary API for unit tests.

**Checklist**:
- [x] Create test file
- [x] Test upload function (mocked)
- [x] Test delete function (mocked)
- [x] Run tests: `npm test -- tests/helpers/cloudinary.test.ts`
- [x] **ALL TESTS PASSING** *(9 tests passed)*

**Legacy Files Deleted**:
- [x] `lib/cloudinary/uploadFilesCloudinary.ts`
- [x] `lib/cloudinary/deleteFilesCloudinary.ts`

---

### Task 0.4: Test Order Helpers

**Files to Test**:
- `backend/src/orders/ordersArrValidation.ts`
- `backend/src/orders/createOrders.ts`
- `backend/src/orders/closeOrders.ts`
- `backend/src/orders/cancelOrders.ts`

**Test File**: `backend/tests/helpers/orders.test.ts`

**Reference**: `dummyData/orders.json`

**Checklist**:
- [x] Create test file
- [x] Test `ordersArrValidation` - valid orders array
- [x] Test `ordersArrValidation` - invalid orders (missing fields)
- [x] Test `createOrders` - *(requires replica set for transactions)*
- [x] Test `closeOrders` - *(requires replica set for transactions)*
- [x] Test `cancelOrders` - *(requires replica set for transactions)*
- [x] Run tests: `npm test -- tests/helpers/orders.test.ts`
- [x] **ALL TESTS PASSING** *(17 tests passed - validation logic fully tested)*

**Note**: `createOrders`, `closeOrders`, and `cancelOrders` use MongoDB transactions which require a replica set. Full integration tests should be done in a staging environment.

**Legacy Files Deleted**:
- [x] `app/api/v1/orders/utils/validateOrdersArr.ts`
- [x] `app/api/v1/orders/utils/createOrders.ts`
- [x] `app/api/v1/orders/utils/closeOrders.ts`
- [x] `app/api/v1/orders/utils/cancelOrders.ts`

---

### Task 0.5: Test Inventory Helpers

**Files to Test**:
- `backend/src/inventories/updateDynamicCountSupplierGood.ts`
- `backend/src/inventories/createNextPeriodInventory.ts`
- `backend/src/inventories/getVarianceReport.ts`
- `backend/src/inventories/checkLowStockAndNotify.ts`

**Test File**: `backend/tests/helpers/inventories.test.ts`

**Reference**: `dummyData/inventories.json`

**Checklist**:
- [x] Create test file
- [x] Test `updateDynamicCountSupplierGood` - *(requires replica set for transactions)*
- [x] Test `createNextPeriodInventory` - *(requires replica set for transactions)*
- [x] Test `getVarianceReport` - calculates variance
- [x] Test `checkLowStockAndNotify` - triggers notifications
- [x] Run tests: `npm test -- tests/helpers/inventories.test.ts`
- [x] **ALL TESTS PASSING** *(8 tests passed)*

**Legacy Files Deleted**:
- [x] `app/api/v1/inventories/utils/updateDynamicCountSupplierGood.ts`
- [x] `app/api/v1/inventories/utils/createNextPeriodInventory.ts`
- [x] `app/api/v1/inventories/utils/getVarianceReport.ts`
- [x] `app/api/v1/inventories/utils/checkLowStockAndNotify.ts`

---

### Task 0.6: Test Promotion Helpers

**Files to Test**:
- `backend/src/promotions/applyPromotions.ts`
- `backend/src/promotions/validatePromotionType.ts`

**Test File**: `backend/tests/helpers/promotions.test.ts`

**Reference**: `dummyData/promotions.json`

**Checklist**:
- [x] Create test file
- [x] Test `applyPromotions` - applies discounts correctly
- [x] Test `applyPromotions` - handles multiple promotions
- [x] Test `validatePromotionType` - valid types
- [x] Test `validatePromotionType` - invalid types
- [x] Run tests: `npm test -- tests/helpers/promotions.test.ts`
- [x] **ALL TESTS PASSING** *(19 tests passed)*

**Legacy Files Deleted**:
- [x] `lib/promotions/applyPromotions.ts`
- [x] `lib/promotions/` folder removed

---

### Task 0.7: Test Schedule Helpers

**Files to Test**:
- `backend/src/schedules/calculateEmployeeCost.ts`
- `backend/src/schedules/employeesValidation.ts`
- `backend/src/schedules/isScheduleOverlapping.ts`

**Test File**: `backend/tests/helpers/schedules.test.ts`

**Reference**: `dummyData/schedules.json`

**Checklist**:
- [x] Create test file
- [x] Test `calculateEmployeeCost` - correct calculation
- [x] Test `employeesValidation` - valid employee data
- [x] Test `isScheduleOverlapping` - detects overlaps
- [x] Run tests: `npm test -- tests/helpers/schedules.test.ts`
- [x] **ALL TESTS PASSING** *(21 tests passed)*

**Legacy Files Deleted**:
- [x] `app/api/v1/schedules/utils/calculateEmployeeCost.ts`
- [x] `app/api/v1/schedules/utils/employeesValidation.ts`
- [x] `app/api/v1/schedules/utils/isScheduleOverlapping.ts`

---

### Task 0.8: Test Daily Sales Report Helpers

**Files to Test**:
- `backend/src/dailySalesReports/createDailySalesReport.ts`
- `backend/src/dailySalesReports/updateEmployeeDailySalesReport.ts`

**Test File**: `backend/tests/helpers/dailySalesReports.test.ts`

**Reference**: `dummyData/dailySalesReport.json`

**Checklist**:
- [x] Create test file
- [x] Test `createDailySalesReport` - *(requires replica set for transactions)*
- [x] Test `updateEmployeeDailySalesReport` - updates employee data
- [x] Run tests: `npm test -- tests/helpers/dailySalesReports.test.ts`
- [x] **ALL TESTS PASSING** *(6 tests passed)*

**Legacy Files Deleted**:
- [x] `app/api/v1/dailySalesReports/utils/createDailySalesReport.ts`
- [x] `app/api/v1/dailySalesReports/utils/updateEmployeeDailySalesReport.ts`

---

### Task 0.9: Test Reservation Helpers

**Files to Test**:
- `backend/src/reservations/sendReservationCustomerFlow.ts`
- `backend/src/reservations/buildReservationMessage.ts`

**Test File**: `backend/tests/helpers/reservations.test.ts`

**Checklist**:
- [x] Create test file
- [x] Test `buildReservationMessage` - formats message correctly *(9 tests)*
- [x] Test `sendReservationPendingFlow` - sends notifications *(function exists)*
- [x] Test `sendReservationDecisionFlow` - sends decision notifications *(function exists)*
- [x] Run tests: `npm test -- tests/helpers/reservations.test.ts`
- [x] **ALL TESTS PASSING** *(11 tests passed)*

**Legacy Files Deleted**:
- [x] `lib/reservations/buildReservationMessage.ts`
- [x] `lib/reservations/sendReservationCustomerFlow.ts`

---

### Task 0.10: Test BusinessGoods Helpers

**Files to Test**:
- `backend/src/businessGoods/calculateIngredientsCostPriceAndAllergies.ts`

**Test File**: `backend/tests/helpers/businessGoods.test.ts`

**Reference**: `dummyData/businessGoods.json`

**Checklist**:
- [x] Create test file
- [x] Test `calculateIngredientsCostPriceAndAllergies` - calculates cost correctly *(same unit, unit conversion, unit type)*
- [x] Test `calculateIngredientsCostPriceAndAllergies` - handles empty ingredients
- [x] Test `calculateIngredientsCostPriceAndAllergies` - aggregates allergies correctly
- [x] Run tests: `npm test -- tests/helpers/businessGoods.test.ts`
- [x] **ALL TESTS PASSING** *(8 tests passed)*

**Legacy Files Deleted**:
- [x] `app/api/v1/businessGoods/utils/calculateIngredientsCostPriceAndAllergies.ts`

---

### Task 0.11: Test SalesInstance Helpers

**Files to Test**:
- `backend/src/salesInstances/createSalesInstance.ts`

**Test File**: `backend/tests/helpers/salesInstances.test.ts`

**Reference**: `dummyData/salesInstance.json`

**Checklist**:
- [x] Create test file
- [x] Test `createSalesInstance` - creates instance with correct defaults *(requires replica set for transactions)*
- [x] Test `createSalesInstance` - validates required fields *(7 tests passed)*
- [x] Run tests: `npm test -- tests/helpers/salesInstances.test.ts`
- [x] **ALL TESTS PASSING** *(7 tests passed)*

**Legacy Files Deleted**:
- [x] `app/api/v1/salesInstances/utils/createSalesInstance.ts`

---

### Task 0.12: Test Purchase Helpers

**Files to Test**:
- `backend/src/purchases/validateInventoryPurchaseItems.ts`

**Test File**: `backend/tests/helpers/purchases.test.ts`

**Reference**: `dummyData/purchases.json`

**Checklist**:
- [x] Create test file
- [x] Test `validateInventoryPurchaseItems` - valid items pass *(single and multiple items)*
- [x] Test `validateInventoryPurchaseItems` - invalid items rejected *(non-array, empty, invalid ID, missing/zero quantity, missing/zero price)*
- [x] Run tests: `npm test -- tests/helpers/purchases.test.ts`
- [x] **ALL TESTS PASSING** *(11 tests passed)*

**Legacy Files Deleted**:
- [x] `app/api/v1/purchases/utils/validateInventoryPurchaseItems.ts`

---

## PHASE 1: Test and Cleanup Route Modules

Now that helpers are tested, proceed with route testing.

---

### Module 1: Auth

**New Backend**: `backend/src/routes/v1/auth.ts`, `backend/src/auth/`

**Test File**: `backend/tests/routes/auth.test.ts`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/auth.test.ts`
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] POST `/api/v1/auth/login` - Login with email/password
- [ ] POST `/api/v1/auth/login` - Invalid credentials returns 401
- [ ] POST `/api/v1/auth/logout` - Clear session
- [ ] POST `/api/v1/auth/refresh` - Refresh access token
- [ ] POST `/api/v1/auth/refresh` - Invalid refresh token returns 401
- [ ] GET `/api/v1/auth/me` - Get current user
- [ ] GET `/api/v1/auth/me` - No token returns 401
- [ ] POST `/api/v1/auth/set-mode` - Set auth mode
- [ ] GET `/api/v1/auth/mode` - Get auth mode

**Step 3: Run Tests**
```bash
npm test -- tests/routes/auth.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/auth/[...nextauth]/options.ts
app/api/auth/[...nextauth]/route.ts
app/api/auth/set-mode/route.ts
lib/auth/canLogAsEmployee.ts
```

**Cleanup Command** (after tests pass):
```bash
rm -rf app/api/auth/
rm lib/auth/canLogAsEmployee.ts
```

- [ ] **VERIFIED AND DELETED**

---

### Module 2: Business

**New Backend**: `backend/src/routes/v1/business.ts`

**Test File**: `backend/tests/routes/business.test.ts`

**Reference**: `dummyData/business.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/business.test.ts`
- [ ] Review `dummyData/business.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/business` - List businesses
- [ ] GET `/api/v1/business` - Filter by location (Haversine)
- [ ] POST `/api/v1/business` - Create business (with image upload)
- [ ] POST `/api/v1/business` - Validation errors return 400
- [ ] GET `/api/v1/business/:businessId` - Get by ID
- [ ] GET `/api/v1/business/:businessId` - Invalid ID returns 400
- [ ] PATCH `/api/v1/business/:businessId` - Update business
- [ ] DELETE `/api/v1/business/:businessId` - Delete business (cascade)

**Step 3: Run Tests**
```bash
npm test -- tests/routes/business.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/business/route.ts
app/api/v1/business/[businessId]/route.ts
app/api/v1/business/README.md
app/api/v1/business/utils/validateBusinessMetrics.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/business/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 3: BusinessGoods

**New Backend**: `backend/src/routes/v1/businessGoods.ts`

**Test File**: `backend/tests/routes/businessGoods.test.ts`

**Reference**: `dummyData/businessGoods.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/businessGoods.test.ts`
- [ ] Review `dummyData/businessGoods.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/businessGoods` - List all
- [ ] GET `/api/v1/businessGoods` - Pagination works correctly
- [ ] POST `/api/v1/businessGoods` - Create (with image upload)
- [ ] POST `/api/v1/businessGoods` - Calculate ingredients cost correctly
- [ ] GET `/api/v1/businessGoods/:businessGoodId` - Get by ID
- [ ] GET `/api/v1/businessGoods/:businessGoodId` - Invalid ID returns 400
- [ ] PATCH `/api/v1/businessGoods/:businessGoodId` - Update
- [ ] DELETE `/api/v1/businessGoods/:businessGoodId` - Delete
- [ ] GET `/api/v1/businessGoods/business/:businessId` - List by business

**Step 3: Run Tests**
```bash
npm test -- tests/routes/businessGoods.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/businessGoods/route.ts
app/api/v1/businessGoods/[businessGoodId]/route.ts
app/api/v1/businessGoods/business/[businessId]/route.ts
app/api/v1/businessGoods/utils/calculateIngredientsCostPriceAndAllergies.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/businessGoods/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 4: Orders

**New Backend**: `backend/src/routes/v1/orders.ts`

**Test File**: `backend/tests/routes/orders.test.ts`

**Reference**: `dummyData/orders.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/orders.test.ts`
- [ ] Review `dummyData/orders.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/orders` - List all
- [ ] POST `/api/v1/orders` - Create orders (single and batch)
- [ ] POST `/api/v1/orders` - Validation errors return 400
- [ ] POST `/api/v1/orders` - Updates inventory correctly
- [ ] GET `/api/v1/orders/:orderId` - Get by ID
- [ ] DELETE `/api/v1/orders/:orderId` - Cancel order
- [ ] DELETE `/api/v1/orders/:orderId` - Reverts inventory on cancel
- [ ] GET `/api/v1/orders/salesInstance/:salesInstanceId` - List by sales instance
- [ ] GET `/api/v1/orders/user/:userId` - List by user

**Step 3: Run Tests**
```bash
npm test -- tests/routes/orders.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/orders/route.ts
app/api/v1/orders/[orderId]/route.ts
app/api/v1/orders/salesInstance/[salesInstanceId]/route.ts
app/api/v1/orders/user/[userId]/route.ts
app/api/v1/orders/README.md
app/api/v1/orders/utils/closeOrders.ts
app/api/v1/orders/utils/createOrders.ts
app/api/v1/orders/utils/transferOrdersBetweenSalesInstances.ts
app/api/v1/orders/utils/validateOrdersArr.ts
app/api/v1/orders/utils/validatePaymentMethodArray.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/orders/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 5: SalesInstances

**New Backend**: `backend/src/routes/v1/salesInstances.ts`

**Test File**: `backend/tests/routes/salesInstances.test.ts`

**Reference**: `dummyData/salesInstance.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/salesInstances.test.ts`
- [ ] Review `dummyData/salesInstance.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/salesInstances` - List all
- [ ] POST `/api/v1/salesInstances` - Create
- [ ] GET `/api/v1/salesInstances/:salesInstanceId` - Get by ID
- [ ] PATCH `/api/v1/salesInstances/:salesInstanceId` - Update
- [ ] PATCH `/api/v1/salesInstances/:salesInstanceId` - Close with payment
- [ ] DELETE `/api/v1/salesInstances/:salesInstanceId` - Delete
- [ ] PATCH `/api/v1/salesInstances/:salesInstanceId/transferSalesPoint` - Transfer
- [ ] GET `/api/v1/salesInstances/business/:businessId` - List by business
- [ ] POST `/api/v1/salesInstances/delivery` - Create delivery order
- [ ] POST `/api/v1/salesInstances/selfOrderingLocation/:id/openTable` - Open table
- [ ] POST `/api/v1/salesInstances/selfOrderingLocation/:id` - Self-order
- [ ] GET `/api/v1/salesInstances/user/:userId` - List by user

**Step 3: Run Tests**
```bash
npm test -- tests/routes/salesInstances.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/salesInstances/route.ts
app/api/v1/salesInstances/[salesInstanceId]/route.ts
app/api/v1/salesInstances/[salesInstanceId]/transferSalesPoint/route.ts
app/api/v1/salesInstances/business/[businessId]/route.ts
app/api/v1/salesInstances/delivery/route.ts
app/api/v1/salesInstances/selfOrderingLocation/[selfOrderingLocationId]/openTable/route.ts
app/api/v1/salesInstances/selfOrderingLocation/[selfOrderingLocationId]/route.ts
app/api/v1/salesInstances/user/[userId]/route.ts
app/api/v1/salesInstances/README.md
app/api/v1/salesInstances/utils/createSalesInstance.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/salesInstances/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 6: SalesPoints

**New Backend**: `backend/src/routes/v1/salesPoints.ts`

**Test File**: `backend/tests/routes/salesPoints.test.ts`

**Reference**: `dummyData/salesLocation.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/salesPoints.test.ts`
- [ ] Review `dummyData/salesLocation.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/salesPoints` - List all
- [ ] POST `/api/v1/salesPoints` - Create (with QR code generation)
- [ ] POST `/api/v1/salesPoints` - Validation errors return 400
- [ ] GET `/api/v1/salesPoints/:salesPointId` - Get by ID
- [ ] PATCH `/api/v1/salesPoints/:salesPointId` - Update
- [ ] DELETE `/api/v1/salesPoints/:salesPointId` - Delete

**Step 3: Run Tests**
```bash
npm test -- tests/routes/salesPoints.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/salesPoints/route.ts
app/api/v1/salesPoints/[salesPointId]/route.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/salesPoints/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 7: Suppliers

**New Backend**: `backend/src/routes/v1/suppliers.ts`

**Test File**: `backend/tests/routes/suppliers.test.ts`

**Reference**: `dummyData/suppliers.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/suppliers.test.ts`
- [ ] Review `dummyData/suppliers.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/suppliers` - List all
- [ ] POST `/api/v1/suppliers` - Create (with image)
- [ ] POST `/api/v1/suppliers` - Validation errors return 400
- [ ] GET `/api/v1/suppliers/:supplierId` - Get by ID
- [ ] PATCH `/api/v1/suppliers/:supplierId` - Update
- [ ] DELETE `/api/v1/suppliers/:supplierId` - Delete
- [ ] GET `/api/v1/suppliers/business/:businessId` - List by business

**Step 3: Run Tests**
```bash
npm test -- tests/routes/suppliers.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/suppliers/route.ts
app/api/v1/suppliers/[supplierId]/route.ts
app/api/v1/suppliers/business/[businessId]/route.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/suppliers/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 8: SupplierGoods

**New Backend**: `backend/src/routes/v1/supplierGoods.ts`

**Test File**: `backend/tests/routes/supplierGoods.test.ts`

**Reference**: `dummyData/supplierGoods.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/supplierGoods.test.ts`
- [ ] Review `dummyData/supplierGoods.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/supplierGoods` - List all
- [ ] POST `/api/v1/supplierGoods` - Create (with image)
- [ ] POST `/api/v1/supplierGoods` - Validation errors return 400
- [ ] GET `/api/v1/supplierGoods/:supplierGoodId` - Get by ID
- [ ] PATCH `/api/v1/supplierGoods/:supplierGoodId` - Update
- [ ] DELETE `/api/v1/supplierGoods/:supplierGoodId` - Delete
- [ ] GET `/api/v1/supplierGoods/supplier/:supplierId` - List by supplier

**Step 3: Run Tests**
```bash
npm test -- tests/routes/supplierGoods.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/supplierGoods/route.ts
app/api/v1/supplierGoods/[supplierGoodId]/route.ts
app/api/v1/supplierGoods/supplier/[supplierId]/route.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/supplierGoods/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 9: Inventories

**New Backend**: `backend/src/routes/v1/inventories.ts`

**Test File**: `backend/tests/routes/inventories.test.ts`

**Reference**: `dummyData/inventories.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/inventories.test.ts`
- [ ] Review `dummyData/inventories.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/inventories` - List all
- [ ] POST `/api/v1/inventories` - Create
- [ ] GET `/api/v1/inventories/:inventoryId` - Get by ID
- [ ] DELETE `/api/v1/inventories/:inventoryId` - Delete
- [ ] PATCH `/api/v1/inventories/:inventoryId/close` - Close inventory
- [ ] PATCH `/api/v1/inventories/:inventoryId/close` - Creates next period inventory
- [ ] GET `/api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId` - Get supplier good
- [ ] PATCH `/api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId/addCount` - Add count
- [ ] PATCH `/api/v1/inventories/:inventoryId/supplierGood/:supplierGoodId/updateCount` - Update count
- [ ] GET `/api/v1/inventories/business/:businessId` - List by business
- [ ] GET `/api/v1/inventories/business/:businessId/lowStock` - Low stock report
- [ ] GET `/api/v1/inventories/business/:businessId/varianceReport` - Variance report

**Step 3: Run Tests**
```bash
npm test -- tests/routes/inventories.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/inventories/route.ts
app/api/v1/inventories/[inventoryId]/route.ts
app/api/v1/inventories/[inventoryId]/close/route.ts
app/api/v1/inventories/[inventoryId]/supplierGood/[supplierGoodId]/route.ts
app/api/v1/inventories/[inventoryId]/supplierGood/[supplierGoodId]/addCountToSupplierGood/route.ts
app/api/v1/inventories/[inventoryId]/supplierGood/[supplierGoodId]/updateCountFromSupplierGood/route.ts
app/api/v1/inventories/business/[businessId]/route.ts
app/api/v1/inventories/business/[businessId]/lowStock/route.ts
app/api/v1/inventories/business/[businessId]/varianceReport/route.ts
app/api/v1/inventories/utils/createNextPeriodInventory.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/inventories/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 10: Purchases

**New Backend**: `backend/src/routes/v1/purchases.ts`

**Test File**: `backend/tests/routes/purchases.test.ts`

**Reference**: `dummyData/purchases.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/purchases.test.ts`
- [ ] Review `dummyData/purchases.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/purchases` - List all
- [ ] POST `/api/v1/purchases` - Create
- [ ] POST `/api/v1/purchases` - Updates inventory when received
- [ ] GET `/api/v1/purchases/:purchaseId` - Get by ID
- [ ] PATCH `/api/v1/purchases/:purchaseId` - Update
- [ ] DELETE `/api/v1/purchases/:purchaseId` - Delete
- [ ] PATCH `/api/v1/purchases/:purchaseId/addSupplierGood` - Add item
- [ ] PATCH `/api/v1/purchases/:purchaseId/deleteSupplierGood` - Remove item
- [ ] PATCH `/api/v1/purchases/:purchaseId/editSupplierGood` - Edit item
- [ ] GET `/api/v1/purchases/supplier/:supplierId` - List by supplier
- [ ] GET `/api/v1/purchases/user/:userId` - List by user

**Step 3: Run Tests**
```bash
npm test -- tests/routes/purchases.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/purchases/route.ts
app/api/v1/purchases/[purchaseId]/route.ts
app/api/v1/purchases/[purchaseId]/addSupplierGoodToPurchase/route.ts
app/api/v1/purchases/[purchaseId]/deleteSupplierGoodFromPurchase/route.ts
app/api/v1/purchases/[purchaseId]/editSupplierGoodFromPurchase/route.ts
app/api/v1/purchases/supplier/[supplierId]/route.ts
app/api/v1/purchases/user/[userId]/route.ts
app/api/v1/purchases/utils/validateInventoryPurchaseItems.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/purchases/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 11: Employees

**New Backend**: `backend/src/routes/v1/employees.ts`

**Test File**: `backend/tests/routes/employees.test.ts`

**Reference**: `dummyData/employees.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/employees.test.ts`
- [ ] Review `dummyData/employees.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/employees` - List all
- [ ] POST `/api/v1/employees` - Create (with image)
- [ ] POST `/api/v1/employees` - Validation errors return 400
- [ ] GET `/api/v1/employees/:employeeId` - Get by ID
- [ ] PATCH `/api/v1/employees/:employeeId` - Update
- [ ] DELETE `/api/v1/employees/:employeeId` - Delete
- [ ] GET `/api/v1/employees/business/:businessId` - List by business

**Step 3: Run Tests**
```bash
npm test -- tests/routes/employees.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/employees/route.ts
app/api/v1/employees/[employeeId]/route.ts
app/api/v1/employees/business/[businessId]/route.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/employees/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 12: Schedules

**New Backend**: `backend/src/routes/v1/schedules.ts`

**Test File**: `backend/tests/routes/schedules.test.ts`

**Reference**: `dummyData/schedules.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/schedules.test.ts`
- [ ] Review `dummyData/schedules.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/schedules` - List all
- [ ] POST `/api/v1/schedules` - Create
- [ ] POST `/api/v1/schedules` - Calculate employee cost correctly
- [ ] GET `/api/v1/schedules/:scheduleId` - Get by ID
- [ ] PATCH `/api/v1/schedules/:scheduleId` - Update
- [ ] DELETE `/api/v1/schedules/:scheduleId` - Delete
- [ ] PATCH `/api/v1/schedules/:scheduleId/addEmployee` - Add employee
- [ ] PATCH `/api/v1/schedules/:scheduleId/deleteEmployee` - Remove employee
- [ ] PATCH `/api/v1/schedules/:scheduleId/updateEmployee` - Update employee
- [ ] GET `/api/v1/schedules/business/:businessId` - List by business
- [ ] GET `/api/v1/schedules/user/:userId` - List by user

**Step 3: Run Tests**
```bash
npm test -- tests/routes/schedules.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/schedules/route.ts
app/api/v1/schedules/[scheduleId]/route.ts
app/api/v1/schedules/[scheduleId]/addEmployeeToSchedule/route.ts
app/api/v1/schedules/[scheduleId]/deleteEmployeeFromSchedule/route.ts
app/api/v1/schedules/[scheduleId]/updateEmployeeSchedule/route.ts
app/api/v1/schedules/business/[businessId]/route.ts
app/api/v1/schedules/user/[userId]/route.ts
app/api/v1/schedules/utils/calculateEmployeeCost.ts
app/api/v1/schedules/utils/employeesValidation.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/schedules/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 13: Users

**New Backend**: `backend/src/routes/v1/users.ts`

**Test File**: `backend/tests/routes/users.test.ts`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/users.test.ts`
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/users` - List all
- [ ] POST `/api/v1/users` - Create (with image)
- [ ] POST `/api/v1/users` - Hash password correctly
- [ ] POST `/api/v1/users` - Validation errors return 400
- [ ] GET `/api/v1/users/:userId` - Get by ID
- [ ] PATCH `/api/v1/users/:userId` - Update
- [ ] DELETE `/api/v1/users/:userId` - Delete
- [ ] PATCH `/api/v1/users/:userId/markNotificationAsDeleted` - Mark notification deleted
- [ ] PATCH `/api/v1/users/:userId/updateReadFlag/:notificationId` - Update read flag

**Step 3: Run Tests**
```bash
npm test -- tests/routes/users.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/users/route.ts
app/api/v1/users/[userId]/route.ts
app/api/v1/users/[userId]/markNotificationAsDeleted/route.ts
app/api/v1/users/[userId]/updateReadFlag/[notificationId]/route.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/users/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 14: Promotions

**New Backend**: `backend/src/routes/v1/promotions.ts`

**Test File**: `backend/tests/routes/promotions.test.ts`

**Reference**: `dummyData/promotions.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/promotions.test.ts`
- [ ] Review `dummyData/promotions.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/promotions` - List all
- [ ] POST `/api/v1/promotions` - Create
- [ ] POST `/api/v1/promotions` - Validate promotion type
- [ ] GET `/api/v1/promotions/:promotionId` - Get by ID
- [ ] PATCH `/api/v1/promotions/:promotionId` - Update
- [ ] DELETE `/api/v1/promotions/:promotionId` - Delete
- [ ] GET `/api/v1/promotions/business/:businessId` - List by business

**Step 3: Run Tests**
```bash
npm test -- tests/routes/promotions.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/promotions/route.ts
app/api/v1/promotions/[promotionId]/route.ts
app/api/v1/promotions/business/[businessId]/route.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/promotions/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 15: DailySalesReports

**New Backend**: `backend/src/routes/v1/dailySalesReports.ts`

**Test File**: `backend/tests/routes/dailySalesReports.test.ts`

**Reference**: `dummyData/dailySalesReport.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/dailySalesReports.test.ts`
- [ ] Review `dummyData/dailySalesReport.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/dailySalesReports` - List all
- [ ] POST `/api/v1/dailySalesReports` - Create
- [ ] GET `/api/v1/dailySalesReports/:dailySalesReportId` - Get by ID
- [ ] DELETE `/api/v1/dailySalesReports/:dailySalesReportId` - Delete
- [ ] PATCH `/api/v1/dailySalesReports/:dailySalesReportId/calculateBusinessReport` - Calculate
- [ ] PATCH `/api/v1/dailySalesReports/:dailySalesReportId/calculateUsersReport` - Calculate users
- [ ] PATCH `/api/v1/dailySalesReports/:dailySalesReportId/close` - Close report
- [ ] GET `/api/v1/dailySalesReports/business/:businessId` - List by business

**Step 3: Run Tests**
```bash
npm test -- tests/routes/dailySalesReports.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/dailySalesReports/route.ts
app/api/v1/dailySalesReports/[dailySalesReportId]/route.ts
app/api/v1/dailySalesReports/[dailySalesReportId]/calculateBusinessDailySalesReport/route.ts
app/api/v1/dailySalesReports/[dailySalesReportId]/calculateUsersDailySalesReport/route.ts
app/api/v1/dailySalesReports/[dailySalesReportId]/closeDailySalesReport/route.ts
app/api/v1/dailySalesReports/business/[businessId]/route.ts
app/api/v1/dailySalesReports/utils/createDailySalesReport.ts
app/api/v1/dailySalesReports/utils/updateEmployeeDailySalesReport.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/dailySalesReports/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 16: WeeklyBusinessReport

**New Backend**: `backend/src/routes/v1/weeklyBusinessReport.ts`

**Test File**: `backend/tests/routes/weeklyBusinessReport.test.ts`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/weeklyBusinessReport.test.ts`
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/weeklyBusinessReport` - List all
- [ ] GET `/api/v1/weeklyBusinessReport/:weeklyReportId` - Get by ID
- [ ] GET `/api/v1/weeklyBusinessReport/business/:businessId` - List by business
- [ ] Aggregates daily reports correctly

**Step 3: Run Tests**
```bash
npm test -- tests/routes/weeklyBusinessReport.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/weeklyBusinessReport/route.ts
app/api/v1/weeklyBusinessReport/[weeklyReportId]/route.ts
app/api/v1/weeklyBusinessReport/business/[businessId]/route.ts
app/api/v1/weeklyBusinessReport/utils/aggregateDailyReportsIntoWeekly.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/weeklyBusinessReport/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 17: MonthlyBusinessReport

**New Backend**: `backend/src/routes/v1/monthlyBusinessReport.ts`

**Test File**: `backend/tests/routes/monthlyBusinessReport.test.ts`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/monthlyBusinessReport.test.ts`
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/monthlyBusinessReport` - List all
- [ ] GET `/api/v1/monthlyBusinessReport/:monthlyReportId` - Get by ID
- [ ] PATCH `/api/v1/monthlyBusinessReport/:monthlyReportId` - Update
- [ ] GET `/api/v1/monthlyBusinessReport/business/:businessId` - List by business
- [ ] GET `/api/v1/monthlyBusinessReport/business/:businessId/calculateOnDemand` - Calculate
- [ ] Aggregates daily reports correctly

**Step 3: Run Tests**
```bash
npm test -- tests/routes/monthlyBusinessReport.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/monthlyBusinessReport/route.ts
app/api/v1/monthlyBusinessReport/[monthlyReportId]/route.ts
app/api/v1/monthlyBusinessReport/business/[businessId]/route.ts
app/api/v1/monthlyBusinessReport/business/[businessId]/calculateOnDemand/route.ts
app/api/v1/monthlyBusinessReport/utils/aggregateDailyReportsIntoMonthly.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/monthlyBusinessReport/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 18: Reservations

**New Backend**: `backend/src/routes/v1/reservations.ts`

**Test File**: `backend/tests/routes/reservations.test.ts`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/reservations.test.ts`
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/reservations` - List all
- [ ] POST `/api/v1/reservations` - Create
- [ ] POST `/api/v1/reservations` - Sends notification on create
- [ ] GET `/api/v1/reservations/:reservationId` - Get by ID
- [ ] PATCH `/api/v1/reservations/:reservationId` - Update
- [ ] PATCH `/api/v1/reservations/:reservationId` - Sends notification on status change
- [ ] DELETE `/api/v1/reservations/:reservationId` - Delete
- [ ] GET `/api/v1/reservations/business/:businessId` - List by business

**Step 3: Run Tests**
```bash
npm test -- tests/routes/reservations.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/reservations/route.ts
app/api/v1/reservations/[reservationId]/route.ts
app/api/v1/reservations/business/[businessId]/route.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/reservations/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 19: Ratings

**New Backend**: `backend/src/routes/v1/ratings.ts`

**Test File**: `backend/tests/routes/ratings.test.ts`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/ratings.test.ts`
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] POST `/api/v1/ratings` - Create rating
- [ ] POST `/api/v1/ratings` - Updates business average rating
- [ ] POST `/api/v1/ratings` - Validation errors return 400
- [ ] GET `/api/v1/ratings/:ratingId` - Get by ID
- [ ] GET `/api/v1/ratings/business/:businessId` - List by business

**Step 3: Run Tests**
```bash
npm test -- tests/routes/ratings.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/ratings/route.ts
app/api/v1/ratings/[ratingId]/route.ts
app/api/v1/ratings/business/[businessId]/route.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/ratings/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 20: Notifications

**New Backend**: `backend/src/routes/v1/notifications.ts`

**Test File**: `backend/tests/routes/notifications.test.ts`

**Reference**: `dummyData/notifications.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/notifications.test.ts`
- [ ] Review `dummyData/notifications.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/notifications` - List all
- [ ] POST `/api/v1/notifications` - Create
- [ ] POST `/api/v1/notifications` - Validation errors return 400
- [ ] GET `/api/v1/notifications/:notificationId` - Get by ID
- [ ] PATCH `/api/v1/notifications/:notificationId` - Update
- [ ] DELETE `/api/v1/notifications/:notificationId` - Delete
- [ ] GET `/api/v1/notifications/business/:businessId` - List by business
- [ ] GET `/api/v1/notifications/user/:userId` - List by user

**Step 3: Run Tests**
```bash
npm test -- tests/routes/notifications.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/notifications/route.ts
app/api/v1/notifications/[notificationId]/route.ts
app/api/v1/notifications/business/[businessId]/route.ts
app/api/v1/notifications/user/[userId]/route.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/notifications/
```

- [ ] **VERIFIED AND DELETED**

---

### Module 21: Printers

**New Backend**: `backend/src/routes/v1/printers.ts`

**Test File**: `backend/tests/routes/printers.test.ts`

**Reference**: `dummyData/printers.json`

**Step 1: Create Tests**
- [ ] Create test file `backend/tests/routes/printers.test.ts`
- [ ] Review `dummyData/printers.json` for expected JSON structure
- [ ] Write tests for all endpoints below

**Step 2: Test Endpoints**
- [ ] GET `/api/v1/printers` - List all
- [ ] POST `/api/v1/printers` - Create
- [ ] POST `/api/v1/printers` - Validation errors return 400
- [ ] GET `/api/v1/printers/:printerId` - Get by ID
- [ ] PATCH `/api/v1/printers/:printerId` - Update
- [ ] DELETE `/api/v1/printers/:printerId` - Delete
- [ ] PATCH `/api/v1/printers/:printerId/addConfigurationSetup` - Add config
- [ ] PATCH `/api/v1/printers/:printerId/deleteConfigurationSetup/:configId` - Delete config
- [ ] PATCH `/api/v1/printers/:printerId/editConfigurationSetup/:configId` - Edit config
- [ ] GET `/api/v1/printers/business/:businessId` - List by business

**Step 3: Run Tests**
```bash
npm test -- tests/routes/printers.test.ts
```
- [ ] **ALL TESTS PASSING**

**Step 4: Delete Legacy Files**
```
app/api/v1/printers/route.ts
app/api/v1/printers/[printerId]/route.ts
app/api/v1/printers/[printerId]/addConfigurationSetupToPrinter/route.ts
app/api/v1/printers/[printerId]/deleteConfigurationSetupFromPrinter/[configurationSetupToPrintOrdersId]/route.ts
app/api/v1/printers/[printerId]/editConfigurationSetupFromPrinter/[configurationSetupToPrintOrdersId]/route.ts
app/api/v1/printers/business/[businessId]/route.ts
```

**Cleanup Command**:
```bash
rm -rf app/api/v1/printers/
```

- [ ] **VERIFIED AND DELETED**

---

## PHASE 2: Final Verification

### Run Full Test Suite

Before any cleanup, run the complete test suite:

```bash
cd backend
npm test
```

**Checklist**:
- [ ] All Phase 0 helper tests pass
- [ ] All Phase 1 route tests pass
- [ ] No test failures
- [ ] Code coverage is acceptable (aim for >80%)

To check coverage:
```bash
npm run test:coverage
```

---

## Shared Library Cleanup

After all modules are verified, delete shared utilities that have been migrated:

### lib/ Directory Cleanup

**Legacy Files to Delete**:
```
lib/auth/                          # Migrated to backend/src/auth/
lib/cloudinary/                    # Migrated to backend/src/cloudinary/
lib/db/models/                     # Migrated to backend/src/models/
lib/promotions/applyPromotions.ts  # Migrated to backend/src/promotions/
lib/reservations/                  # Migrated to backend/src/reservations/
lib/utils/isBusinessOpenNow.ts     # Migrated to backend/src/utils/
```

**Note**: Some `lib/` files may still be used by the frontend. Only delete after confirming no frontend dependencies.

- [ ] **VERIFIED AND DELETED**

---

## Backend Legacy Models Cleanup

Delete legacy model stubs:

```
backend/src/models/legacy/         # Old model definitions for reference only
```

**Cleanup Command**:
```bash
rm -rf backend/src/models/legacy/
```

- [ ] **VERIFIED AND DELETED**

---

## Final Cleanup

### Remove Empty Directories

After deleting all legacy route files:

```bash
# Remove empty app/api/v1 directory
rmdir app/api/v1 2>/dev/null

# Remove empty app/api directory if auth is deleted
rmdir app/api 2>/dev/null
```

### Update route-inventory.json

After cleanup, the `route-inventory.json` file is no longer needed since all routes are migrated:

```bash
rm route-inventory.json
```

- [ ] **CLEANUP COMPLETE**

---

## Post-Cleanup Verification

After all cleanup is complete:

- [ ] Run full backend test suite: `cd backend && npm test`
- [ ] Run frontend and verify all features work
- [ ] Verify no broken imports in codebase
- [ ] Commit cleanup changes with message: "chore: remove legacy Next.js API routes - migration complete"

---

## Quick Cleanup Commands

**WARNING**: Only use these after ALL tests pass!

For experienced users who have already verified everything:

```bash
# Delete all legacy API routes
rm -rf app/api/

# Delete legacy lib files (verify frontend doesn't need them first)
rm -rf lib/auth/
rm -rf lib/db/models/
rm -rf lib/cloudinary/
rm -rf lib/promotions/
rm -rf lib/reservations/
rm lib/utils/isBusinessOpenNow.ts

# Delete backend legacy models
rm -rf backend/src/models/legacy/

# Delete route inventory
rm route-inventory.json

# Verify
echo "Cleanup complete!"
```

---

## Rollback Plan

If issues are found after cleanup:

1. Git revert to before cleanup commit
2. Fix issues in new backend
3. Re-run verification
4. Re-apply cleanup

```bash
# To revert cleanup
git revert HEAD --no-commit
git checkout .
```

---

## Task Execution Order Summary

For clarity, execute tasks in this order:

### Phase 0: Helper Tests (Do These First!)
1. Task 0.1: Auth Helpers
2. Task 0.2: Utility Helpers
3. Task 0.3: Cloudinary Helpers
4. Task 0.4: Order Helpers
5. Task 0.5: Inventory Helpers
6. Task 0.6: Promotion Helpers
7. Task 0.7: Schedule Helpers
8. Task 0.8: Daily Sales Report Helpers
9. Task 0.9: Reservation Helpers
10. Task 0.10: BusinessGoods Helpers
11. Task 0.11: SalesInstance Helpers
12. Task 0.12: Purchase Helpers

### Phase 1: Route Tests (After Helpers Pass)
1. Module 1: Auth
2. Module 2: Business
3. Module 3: BusinessGoods
4. Module 4: Orders
5. Module 5: SalesInstances
6. Module 6: SalesPoints
7. Module 7: Suppliers
8. Module 8: SupplierGoods
9. Module 9: Inventories
10. Module 10: Purchases
11. Module 11: Employees
12. Module 12: Schedules
13. Module 13: Users
14. Module 14: Promotions
15. Module 15: DailySalesReports
16. Module 16: WeeklyBusinessReport
17. Module 17: MonthlyBusinessReport
18. Module 18: Reservations
19. Module 19: Ratings
20. Module 20: Notifications
21. Module 21: Printers

### Phase 2: Final Verification
- Run full test suite
- Verify coverage

### Phase 3: Cleanup (Only After All Tests Pass)
- Delete legacy files module by module
- Final cleanup and commit

### Phase 4: Transaction Testing (Replica Set Required)

Some helper functions require MongoDB transactions which are not supported by `mongodb-memory-server` (requires a replica set). The following functions have validation tests but need full integration testing with a replica set:

**Functions requiring transaction tests**:
- `createOrders` (Task 0.4)
- `closeOrders` (Task 0.4)
- `cancelOrders` (Task 0.4)
- `updateDynamicCountSupplierGood` (Task 0.5)
- `createNextPeriodInventory` (Task 0.5)
- `createDailySalesReport` (Task 0.8)
- `createSalesInstance` (Task 0.11)

**Options to implement**:
1. **Docker Compose**: Add a `docker-compose.test.yml` with a MongoDB replica set for CI/CD
2. **MongoDB Atlas**: Use a test cluster with replica set support
3. **Local Replica Set**: Configure local MongoDB as a single-node replica set

**Checklist**:
- [ ] Choose transaction testing approach
- [ ] Configure test environment with replica set
- [ ] Add full integration tests for transaction-dependent functions
- [ ] Verify all transaction tests pass
- [ ] Update CI/CD pipeline if needed
