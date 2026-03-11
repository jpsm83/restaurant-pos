# Orders API — `app/api/v1/orders`

This folder contains the **REST API for the Order entity**: the **billable items** (menu items / business goods) placed in a **SalesInstance** (open table/session). Orders are created by employees (POST /orders) or by customers via the self-ordering flow (POST salesInstance/selfOrderingLocation). Each order references **businessGoodId** (main product) and optional **addOns** (the items sold); when orders are **created**, the app **decrements inventory** for the ingredients of those business goods (via **SupplierGood** → inventory dynamic count). When orders are **cancelled**, inventory is **incremented** back. Orders are **not** directly “related to the supplier”; they are the **sales side** that **consumes** what suppliers and purchases stock — so they are the link between **menu (business goods)**, **inventory (supplier goods)**, and **billing**.

This document describes how the order routes and utils work, how they interact with sales instances, inventory, business goods, promotions, and the rest of the app, and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **Order** = one billable line in a **SalesInstance**: dailyReferenceNumber, salesInstanceId, businessId, **businessGoodId** (required, main product), **addOns** (optional array of BusinessGood refs), orderGrossPrice, orderNetPrice, orderCostPrice, billingStatus (Open, Paid, Void, Cancel, Invitation), orderStatus (Sent, Done, Delivered, Dont Make), optional employeeId/customerId, paymentMethod, allergens, promotionApplyed, discountPercentage, comments. One order = one main product; quantity is expressed as multiple orders. **Promotions apply only to the main product (businessGoodId), not to addOns.**
- **Creation and inventory:** When orders are created (**createOrders**), the flow builds a flattened list of business good IDs (main + addOns per order) and calls **updateDynamicCountSupplierGood(businessGoodsIds, "remove", session)** so that the **ingredients** of those business goods have their inventory **dynamicSystemCount** decreased. When orders are **cancelled** (**cancelOrders**), the same helper is called with **"add"** to restore stock. Purchases **add** stock; orders **remove** it.
- **Sales instance coupling:** Orders are pushed into the sales instance’s **salesGroup** (orderCode + ordersIds). When orders are closed (paid), **closeOrders** can set the sales instance to **Closed** if all its orders are paid. **cancelOrders** removes orders from the sales instance’s salesGroup and deletes the order documents. **transferOrdersBetweenSalesInstances** moves orders from one instance to another (salesGroup and order.salesInstanceId).
- **Promotions:** Promotion pricing is first calculated on the **front end** for real-time UX and sent to the backend. The backend runs the **same** promotion rules to **validate**; if the client payload matches the backend calculation, it is saved; otherwise an error is returned. No overwriting. The promotion engine applies rules based on the **main product (businessGoodId) only**; addOns are not considered. One business good cannot have more than one promotion at a time; if multiple rules target the same item, the backend chooses the effective promotion (e.g. lowest net price).

So: **Orders are the “what was sold” layer: they drive inventory consumption (and restoration on cancel), tie to sales instances and daily reporting, and support billing, payment, and transfers.**

---

## 2. File structure

```
app/api/v1/orders/
├── README.md                                    # This file — context for flow, patterns, and app integration
├── route.ts                                     # GET all orders | POST create orders (employee)
├── [orderId]/
│   └── route.ts                                 # GET by orderId | DELETE (cancel single order via cancelOrders)
├── salesInstance/
│   └── [salesInstanceId]/
│       └── route.ts                             # GET orders by salesInstanceId
├── user/
│   └── [userId]/
│       └── route.ts                             # GET orders by employeeId (path param may be userId/employeeId)
└── utils/
    ├── createOrders.ts                          # Bulk insert orders, update inventory (remove), push to salesInstance salesGroup
    ├── cancelOrders.ts                         # Restore inventory (add), remove from salesGroup, delete orders
    ├── closeOrders.ts                           # Set payment on orders, set billingStatus Paid; close sales instance if all paid
    ├── addDiscountToOrders.ts                  # Apply discount % to open orders (no promotion)
    ├── changeOrdersBillingStatus.ts            # Manually set billing status (not Paid/Cancel)
    ├── changeOrdersStatus.ts                    # Set orderStatus (e.g. Sent, Done, Delivered)
    ├── transferOrdersBetweenSalesInstances.ts   # Move open orders to another sales instance
    ├── validateOrdersArr.ts                    # Validate orders array (businessGoodId, addOns, prices, keys)
    └── validatePaymentMethodArray.ts            # Validate payment method array (type, branch, totals)
```

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/orders` | Returns all orders (populated: salesInstance→salesPoint, employee, customer, businessGoodId, addOns). 404 if none. |
| POST | `/api/v1/orders` | Creates orders (employee flow). Body: **JSON** (ordersArr, employeeId, salesInstanceId, businessId, dailyReferenceNumber). Validates, then createOrders (transaction). |
| GET | `/api/v1/orders/:orderId` | Returns one order by ID (same populates). |
| DELETE | `/api/v1/orders/:orderId` | Cancels and deletes one order: cancelOrders([orderId], session). Transaction. |
| GET | `/api/v1/orders/salesInstance/:salesInstanceId` | Returns orders for the sales instance. |
| GET | `/api/v1/orders/user/:userId` | Returns orders where employeeId matches path param (path is userId; used as employeeId for filter). |

**Note:** Order **updates** (discount, cancel, billing status, order status, payment/close, transfer) are invoked from the **Sales Instance PATCH** route, not from an order PATCH. The orders API provides GET, POST (create), and DELETE (cancel one); the rest is done via order utils called by sales instances.

All responses are JSON. Errors use `handleApiError` (500) or explicit NextResponse with 400/404.

---

## 4. Request/response patterns and validation

### 4.1 GET (list, by id, by sales instance, by user/employee)

- **DB:** `connectDb()` before first query.
- **Populate:** salesInstanceId → salesPointId (salesPointName); employeeId (employeeName, allEmployeeRoles, currentShiftRole); customerId (same select — may be Customer model); businessGoodId and addOns (name, mainCategory, subCategory, productionTime, sellingPrice, allergens).
- **By sales instance:** `Order.find({ salesInstanceId })`.
- **By employee:** `Order.find({ employeeId: employeeId })` (path param is userId in folder name; handler uses employeeId — ensure param matches).
- **By id:** Validate orderId; `Order.findById(orderId)`.

### 4.2 POST (create orders — employee) — JSON body + transaction

**Required:** `ordersArr`, `employeeId`, `salesInstanceId`, `businessId`, `dailyReferenceNumber`.

- **ordersArr:** Array of objects. Each: orderGrossPrice, orderNetPrice, orderCostPrice, **businessGoodId** (required ObjectId), **addOns** (optional array of ObjectIds). Optional: allergens, promotionApplyed, comments, discountPercentage. Validated by **ordersArrValidation** (required businessGoodId, optional addOns, valid IDs, allowed keys).
- **Validation:** isObjectIdValid for all IDs (businessId, salesInstanceId, employeeId, and each order’s businessGoodId and addOns). Then ordersArrValidation(ordersArr).
- **Transaction:** createOrders(dailyReferenceNumber, ordersArr, employeeId, undefined, salesInstanceId, businessId, session). On string return (error), abort and return 400. Commit on success.

### 4.3 createOrders util

- **Signature:** createOrders(dailyReferenceNumber, ordersArr, employeeId, customerId, salesInstanceId, businessId, session).
- **Behavior:** If employeeId present, check sales instance exists and is not Closed (use salesInstanceStatus, not status). Bulk insert orders (billingStatus: Open, orderStatus: Sent) with businessGoodId and addOns. Build flattened list of IDs (main + addOns per order) and call **updateDynamicCountSupplierGood(businessGoodsIds, "remove", session)** to decrement inventory. Generate orderCode (date + dayOfWeek + random). **SalesInstance.updateOne** push salesGroup { orderCode, ordersIds: ordersIdsCreated, createdAt }. Returns created order documents or error string.
- **Inventory:** The inventory util resolves business goods → ingredients (including set-menu members), converts units, and decrements inventoryGoods.$.dynamicSystemCount. So creating orders **consumes** supplier-good stock.

### 4.4 DELETE (cancel one order)

- **Transaction:** cancelOrders([orderId], session). If result is not true, return 400 with message. Commit.
- **cancelOrders util:** Load orders by ids (select businessGoodId, addOns); if any has orderStatus "Done", return error. Build flattened list (main + addOns per order) and call **updateDynamicCountSupplierGood(businessGoodsIds, "add", session)** to restore inventory. Remove ordersIds from sales instance salesGroup ($pull), remove empty salesGroup entries, delete order documents. Returns true or error string.

### 4.5 Order utils (used by Sales Instance PATCH and/or self-order flow)

- **addDiscountToOrders(ordersIdsArr, discountPercentage, comments, session):** Only for orders with billingStatus Open and no promotionApplyed. Validates 0 ≤ discountPercentage ≤ 100 and comments. The SalesInstance PATCH route enforces that only **on‑duty management roles** (e.g. Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Supervisor) can trigger this action by requiring an `employeeId` with those roles and `onDuty: true`. Sets orderNetPrice = orderGrossPrice - (orderGrossPrice * discountPercentage / 100), discountPercentage, comments. Bulk write. Manual discounts are therefore clearly separated from promotions and controlled by role.
- **changeOrdersBillingStatus(ordersIdsArr, ordersNewBillingStatus, session):** Cannot set Paid or Cancel (system-set). Only orders with Open, Invitation, or Void can be changed. Sets billingStatus and orderNetPrice (Open → gross, else 0). Bulk write.
- **changeOrdersStatus(ordersIdsArr, ordersNewStatus, session):** Orders with "Dont Make" cannot be changed. updateMany orderStatus.
- **closeOrders(ordersIdsArr, paymentMethodArr, session):** Only orders with billingStatus Open. Validates total paid ≥ total order net price. Allocates paymentMethodArr across orders (paymentMethod, billingStatus: Paid), tips on first order. Bulk update orders. Then: if all orders in the sales instance are Paid, set sales instance to Closed (salesInstanceStatus, closedAt, closedById). Stored order net prices from creation are the source of truth; close does not re-validate promotions.
- **transferOrdersBetweenSalesInstances(ordersIdsArr, toSalesInstanceId, session):** Target instance must exist and not be Closed. All orders must be Open. Update order.salesInstanceId; remove from original instance salesGroup; add to target salesGroup (by orderCode or new group). Clean empty groups.

### 4.6 Validation helpers

- **ordersArrValidation(ordersArr):** Array of objects; each has **businessGoodId** (required, valid ObjectId), optional **addOns** (array of valid ObjectIds), orderGrossPrice, orderNetPrice, orderCostPrice; allowed keys include allergens, promotionApplyed, comments, etc. Returns string error or true.
- **validatePaymentMethodArray(paymentMethodArr):** Array of { paymentMethodType, methodBranch, methodSalesTotal }. Types from enums (Cash, Card, Crypto, Other); branch validated per type. methodSalesTotal ≥ 0. Used for closeOrders and self-order.

---

## 5. How other parts of the app use Orders

### 5.1 Inventory and supplier goods

- **Business goods** have ingredients (SupplierGood refs). **createOrders** builds a flattened list of business good IDs (businessGoodId + addOns per order) and passes it to **updateDynamicCountSupplierGood(..., "remove", session)** so inventory’s dynamicSystemCount **decreases** for those ingredients. **cancelOrders** does the same with **"add"** to **increase** count. So orders are the **consumption** side; purchases are the **incoming** side. No direct reference to suppliers in the order document — the link is businessGood → ingredients (supplier goods) → inventory.

### 5.2 Sales instances

- Orders belong to a **SalesInstance** (salesInstanceId). They are pushed into the instance’s **salesGroup** when created. Sales instance PATCH calls the order utils (discount, cancel, billing status, order status, close, transfer). When all orders in an instance are paid, **closeOrders** closes the instance. So orders and sales instances are tightly coupled.

### 5.3 Business goods and promotions

- Orders store **businessGoodId** (main product) and optional **addOns**. **Promotions** apply only to the main product (businessGoodId); the backend validates client-sent price/promotion against the engine result; only matching payloads are persisted. **addDiscountToOrders** does not apply if a promotion is already applied.

### 5.4 Daily report and self-ordering

- **Daily reference number** on the order links to the day’s report. The self-ordering flow (salesInstances/selfOrderingLocation) creates orders and then calls **closeOrders**; it also updates the daily report’s selfOrderingSalesReport. So orders feed into daily/monthly reporting.

### 5.5 Business (tenant and cascade)

- Orders are scoped by **businessId**. When a **Business** is deleted, **Order** is deleted in the same transaction (Order.deleteMany({ businessId }, { session })).

### 5.6 Printers

- Order routing to **printers** (kitchen/bar) is driven by order content (main category, subcategory) and **sales point** (from the sales instance). See Printers README. Orders do not reference printers directly; the print flow uses order and sales instance data.

---

## 6. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response. |
| `@/lib/utils/isObjectIdValid` | Validate orderId, salesInstanceId, businessId, employeeId, businessGoodId, addOns, etc. |
| `../../inventories/utils/updateDynamicCountSupplierGood` | Decrement (create) or increment (cancel) inventory for order ingredients. |
| `./utils/createOrders` | Insert orders, update inventory (remove), push to sales instance salesGroup. |
| `./utils/cancelOrders` | Restore inventory (add), remove from salesGroup, delete orders. |
| `./utils/closeOrders` | Set payment and Paid; close sales instance if all paid. |
| `./utils/addDiscountToOrders` | Apply discount % to open orders without promotion. |
| `./utils/changeOrdersBillingStatus` | Manually set billing status (not Paid/Cancel). |
| `./utils/changeOrdersStatus` | Set orderStatus. |
| `./utils/transferOrdersBetweenSalesInstances` | Move orders to another sales instance. |
| `./utils/validateOrdersArr` | Validate orders array for create. |
| `./utils/validatePaymentMethodArray` | Validate payment methods for close. |
| Order, SalesInstance, Employee, BusinessGood, SalesPoint, Customer | Models and populates. |
| `@/lib/interface/IOrder`, `@/lib/interface/IPaymentMethod` | Types. |
| `@/lib/enums` | billingStatusEnums, orderStatusEnums, paymentMethods, cardTypes, etc. |

---

## 7. Patterns to follow when coding

1. **Always call `connectDb()`** before the first DB operation in each request.
2. **Validate IDs** with isObjectIdValid for all path and body IDs (orderId, salesInstanceId, businessId, employeeId, businessGoodId, addOns, etc.).
3. **Use a transaction** when creating orders (createOrders does inventory + sales instance update) or when cancelling (cancelOrders does inventory + salesGroup + delete). Use the same session for all steps.
4. **Inventory consistency:** Create → updateDynamicCountSupplierGood(..., "remove"). Cancel → updateDynamicCountSupplierGood(..., "add"). Never skip these when creating or cancelling orders.
5. **Sales instance sync:** When creating orders, push to salesGroup. When cancelling, pull from salesGroup and remove empty groups. When closing, check if all orders in the instance are Paid and then close the instance.
6. **Promotions:** Handled on the front end; backend stores orderNetPrice and promotionApplyed. Do not add discount to orders that already have a promotion.
7. **Billing and payment:** Paid and Cancel are set by the system (closeOrders, cancelOrders). Manual billing status changes use changeOrdersBillingStatus with allowed statuses only.
8. **Consistent JSON** responses and error messages.

---

## 8. Data model summary (for context)

- **Order:** dailyReferenceNumber, salesInstanceId, businessId, **businessGoodId** (required), **addOns** (optional array), orderGrossPrice, orderNetPrice, orderCostPrice, billingStatus (default Open), orderStatus (default Sent), optional employeeId, customerId, paymentMethod[], orderTips, allergens[], promotionApplyed, discountPercentage, comments.
- **businessGoodId** is the main product; **addOns** are optional extras (e.g. burger + extra cheese). Promotions apply only to businessGoodId. The flattened list [businessGoodId, ...addOns] per order is passed to updateDynamicCountSupplierGood for inventory.

This README is the main context for how the orders API works and how it ties into inventory (supplier goods consumption), sales instances, business goods, promotions, and the rest of the app.
