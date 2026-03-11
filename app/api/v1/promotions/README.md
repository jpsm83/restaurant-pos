# Promotions API — `app/api/v1/promotions`

This folder contains the **REST API for the Promotion entity**: time-bound discount/offer rules a **Business** can run (happy hour fixed price, percentage discounts, 2x1, 3x2, etc.). Promotions are scoped by `businessId` and can optionally target a subset of **BusinessGoods** (menu items).

Promotion rules are applied in **two stages**:

- The **front end** calculates promotion effects in real time so staff and customers see discounted prices while ordering.
- The **backend** uses a shared promotion engine to **run the same rules to validate** promotions at order creation (employee and self-ordering flows); if client payload matches backend calculation, it is saved; otherwise an error is returned. No overwriting. Close/billing does not re-validate promotions.
This document explains how the promotion routes work, their validation logic, how they integrate with orders and billing, and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **Business-scoped pricing rules:** Promotions belong to a business (`businessId`) and define when/where an offer applies.
- **Real-time UX requirement:** The order creation flow lets the client calculate the promotion price live (so the user sees the discounted price immediately) and sends that result to the backend.
- **Backend validation:** A shared promotion engine (`lib/promotions/applyPromotions.ts`) runs the same rules: it loads active promotions for the business, checks time windows (`promotionPeriod`, `weekDays`, `activePromotion`) and targeting (`businessGoodsToApplyIds`). **Promotions apply only to the main product (order.businessGoodId), not to addOns.** The backend **compares** its computed `orderNetPrice`, `promotionApplyed`, and `discountPercentage` to what the client sent; only when they match is the order saved. If they do not match, the API returns an error and does not persist. At close/billing, stored order data is trusted; there is no second validation.
- **Operational coupling:** Promotions affect:
  - order net price
  - promotion identification (`promotionApplyed` field on orders)
  - reporting/analytics (knowing which orders were discounted)
  - eligibility for additional manual discounts (discounts are blocked when a promotion is applied)

So: **Promotions are the canonical rules; the UI applies them during ordering for UX, and the backend recomputes and validates them so Orders and reports remain authoritative.**

---

## 2. File structure

```
app/api/v1/promotions/
├── README.md                      # This file — context for flow, patterns, and app integration
├── route.ts                       # GET all promotions | POST create promotion
├── [promotionId]/
│   └── route.ts                   # GET | PATCH | DELETE by promotionId
├── business/
│   └── [businessId]/
│       └── route.ts               # GET promotions for a business (optional date range query)
└── utils/
    ├── validateDateAndTime.ts     # Validates promotionPeriod.start/end ordering
    ├── validateDaysOfTheWeek.ts   # Validates weekDays array
    └── validatePromotionType.ts   # Enforces exactly one promotion type key/value
```

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/promotions` | Returns all promotions (populated business goods). 404 if none. |
| POST | `/api/v1/promotions` | Creates a new promotion. Body: **JSON**. |
| GET | `/api/v1/promotions/:promotionId` | Returns one promotion by ID. 404 if not found. |
| PATCH | `/api/v1/promotions/:promotionId` | Updates a promotion. Body: **JSON**. |
| DELETE | `/api/v1/promotions/:promotionId` | Deletes a promotion. 404 if not found. |
| GET | `/api/v1/promotions/business/:businessId?startDate=<date>&endDate=<date>` | Returns promotions for business, optionally filtered by date range. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404.

---

## 4. Promotion model (what gets stored)

Promotion documents are defined in `lib/db/models/promotion.ts` and include:

- `promotionName` (string, required)
- `promotionPeriod` (required object `{ start: Date, end: Date }`)
- `weekDays` (required string array, enum `weekDaysEnums`)
- `activePromotion` (boolean)
- `promotionType` (required object with one key):\n  - `fixedPrice: number`\n  - `discountPercent: number`\n  - `twoForOne: boolean`\n  - `threeForTwo: boolean`\n  - `secondHalfPrice: boolean`\n  - `fullComplimentary: boolean`
- `businessId` (required ObjectId)
- optional `businessGoodsToApplyIds` (ObjectId[] → BusinessGood)
- optional `description`

The API populates `businessGoodsToApplyIds` with `BusinessGood.name` for readability on GETs.

---

## 5. Request/response patterns and validation logic

### 5.1 Common patterns

- **DB:** `connectDb()` before the first MongoDB operation.
- **ID validation:** `isObjectIdValid` for `promotionId`, `businessId`, and `businessGoodsToApplyIds[]`.
- **Duplicate rules:** Promotion names are unique per business.\n  - Create: `(businessId, promotionName)` must be unique.\n  - Update: same constraint, excluding the current promotion document.

### 5.2 POST (create promotion) — JSON body

**Required fields:**

- `promotionName`
- `promotionPeriod` (`{ start, end }`)
- `weekDays` (non-empty array)
- `activePromotion` (boolean)
- `promotionType` (exactly one type)
- `businessId`

**Optional:**

- `businessGoodsToApplyIds` (array of BusinessGood ids)
- `description`

**Validation helpers:**

- `validateDateAndTime(promotionPeriod)` ensures `start < end`.
- `validateDaysOfTheWeek(weekDays)` ensures all entries are valid weekdays.
- `validatePromotionType(promotionType)` enforces exactly one key and correct value type.

### 5.3 PATCH (update promotion) — JSON body

PATCH is partially updatable; it re-validates only provided fields:

- Re-validates `promotionPeriod` if present
- Re-validates `weekDays` if present
- Re-validates `promotionType` if present
- Re-validates `businessGoodsToApplyIds` if present

Then it checks:

- Promotion exists
- No duplicate `(businessId, promotionName)` conflict

Then updates only provided fields.

### 5.4 GET by business with date range

`GET /promotions/business/:businessId` supports optional `startDate` and `endDate` query params.

- If both are provided, it validates `startDate <= endDate` and builds a query:\n  - `promotionPeriod.start >= startDate`\n  - `promotionPeriod.end <= endDate`\n- If not provided, it returns all promotions for the business.

This endpoint is how the UI can load “current promotions” for a business and optionally slice them for reporting/admin views.

---

## 6. How other parts of the app use Promotions

### 6.1 Orders and real-time pricing

Orders integrate with promotions via a **backend promotion engine**:

- The front end still calculates promotion prices live so the user sees discounts as they build the order.
- On POST `/orders` (employee flow) and in the self-ordering flow, the backend calls `applyPromotionsToOrders({ businessId, ordersArr })` from `lib/promotions/applyPromotions.ts` **before** creating orders.
  - This helper:
    - loads active promotions for the business,
    - filters them by time window and weekday using an `atDateTime` (order creation moment),
    - filters them by targeted goods (`businessGoodsToApplyIds`),
    - enforces “one promotion per business good” (no stacking),
    - chooses, when multiple promotions could apply, the one that yields the lowest net price,
    - returns authoritative `orderNetPrice`, `promotionApplyed`, and `discountPercentage` per order.
  - The backend compares the result to the client-sent payload; if they match, the client payload is persisted; if not, an error is returned. There is no validation at close.

So the Promotions API is used to **fetch and manage definitions**, and the shared promotion engine uses those definitions to validate (and only then persist) the client's order price and promotion data.

### 6.2 BusinessGoods targeting

Promotions can target specific business goods via `businessGoodsToApplyIds`.

- If this array is omitted/undefined, a promotion can be interpreted as “global” (business-wide) depending on UI logic.\n- If present, UI should only apply the promotion to matching goods.

### 6.3 Billing / printing / analytics

Comments in the promotions routes mention checking promotions “when bill is printed” and applying them to orders if needed. Even if the primary application is on the front end, promotions remain important because:

- orders store promotion metadata for auditability
- reports can group sales by promotion
- receipts/bills can display promotion details

---

## 7. Shared utilities and dependencies

Used by promotion routes:

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response helper. |
| `@/lib/utils/isObjectIdValid` | Validate ids (businessId, promotionId, goods arrays). |
| `./utils/validateDateAndTime` | Validate `promotionPeriod.start/end`. |
| `./utils/validateDaysOfTheWeek` | Validate `weekDays` values. |
| `./utils/validatePromotionType` | Enforce exactly one type with correct value type. |
| `@/lib/db/models/promotion` | Promotion model. |
| `@/lib/db/models/businessGood` | Populate targeted goods. |
| `@/lib/interface/IPromotion` | Types for promotion payloads. |

---

## 8. Patterns to follow when coding

1. **Always call `connectDb()`** before DB work.
2. **Validate IDs** with `isObjectIdValid` (promotionId, businessId, goods arrays).
3. **Keep promotion type exclusive**: only one promotion rule per promotion (`validatePromotionType`).
4. **Validate time windows** (`promotionPeriod.start < end`) and **weekdays**.
5. **Enforce uniqueness per business** for `promotionName`.
6. **Keep the real-time pricing contract**: UI calculates and stores order pricing; backend stores definitions and supports querying/admin workflows.
7. **Return consistent JSON** success/error responses.

---

## 9. Data model summary (for context)

- **Promotion**:\n  `promotionName`, `promotionPeriod{start,end}`, `weekDays[]`, `activePromotion`, `promotionType`, `businessId`, optional `businessGoodsToApplyIds[]`, optional `description`.

This README is the main context for how the promotions API works, how it fits into the app (business goods, orders, billing), and how to extend it consistently.

