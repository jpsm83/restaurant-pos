# Restaurant POS — product context

What the Restaurant POS is, what it does, and how the subsystems connect. This is the product-shape companion to the code and the focused docs listed in [`AGENTS.md`](../AGENTS.md); open those for depth.

## What this app is about

This is a **complete, real-time POS system** for **bars and restaurants**, designed to cover the full operational lifecycle:

- **Business onboarding & configuration** (the restaurant/company profile, subscription plan, currency, KPIs/metrics)
- **Orders and live service flow** (opening a table/session, sending orders, tracking status, billing)
- **Supplies and purchasing** (suppliers, supplier goods, purchases/receipts)
- **Inventories** (monthly snapshots, dynamic stock changes driven by sales/production)
- **Employees and operations** (roles, shifts/on-duty, schedules)
- **Reports** (daily/monthly business reports and other analytics)
- **Notifications** (operational alerts, messages, promotions, etc.)
- **Promotions**
- **Reservations** (booking layer: customer requests + staff approval; links to tables/sales instances)

Everything is designed to work **in live time**, where the POS state (open tables/sales instances, order status, stock movement, etc.) is continuously updated and reflected across the UI and APIs.

### Shared physical address (`IAddress` / `addressSchema`)

Structured addresses are shared across **Business**, **Supplier**, **User `personalDetails`**, and delivery flows. Mongoose shape lives in **`backend/src/models/address.ts`**; the TypeScript contract is **`packages/interfaces/IAddress.ts`**.

- **Required:** `country`, `state`, `city`, `street`, `buildingNumber`, `postCode`.
- **Optional:** `doorNumber` (unit / door / apartment id), `complement` (second line: floor, wing, etc.), `region`, `additionalDetails`, `coordinates` (`[longitude, latitude]`).

Multipart **business** and **user** profile routes validate address JSON with **`objDefaultValidation`** (`reqAddressFields` + `nonReqAddressFields` in the relevant route files). **`packages/utils/addressValidation.ts`** whitelists the same keys for other callers. The business settings **address** page and **business registration** form must stay aligned with this model (RHF + Zod on the frontend).

#### Business address settings — location preview (map)

The tenant **postal address** editor lives at **`/business/:businessId/settings/address`** (**`BusinessAddressSettingsPage`** in `frontend/src/pages/business/BusinessAddressSettingsPage.tsx`). It uses the same split-settings shell as other business profile slices (**`BusinessProfileSettingsFormShell`** + **`useBusinessProfileSettingsController`**) so address fields are part of the full profile form and save with **`PATCH /api/v1/business/:businessId`**. Its **`loadingSlot`** mirrors the loaded layout: **`section`** + **`header`**, address field grid with the same column spans as street/complement full-width rows, and the map column (**`h3`**-style title + map placeholder).

- **Location preview:** **`BusinessAddressLocationMap`** (`frontend/src/components/BusinessAddressLocationMap.tsx`) shows an **OpenStreetMap** tile layer and geocodes a free-text query with **Nominatim** via **`leaflet-control-geocoder`** (public service; respect OSM usage policy in production).
- **Query string:** Built locally with **`buildAddressGeocodeQuery`** on the address page: **street-first** parts joined with commas (`street`, `buildingNumber`, `city`, `state`, `postCode`, `region`, `country`). **`doorNumber`** and **`complement`** are **omitted** from the geocode string only (they remain on the saved profile); unit-level text often prevents Nominatim from matching.
- **When the map refetches:** The first time a **non-empty** trimmed query reaches the map (length ≥ **3**), geocoding runs **immediately** so the pin appears on load. **Later** changes to the query (after that first scheduled run) are **debounced by 3 seconds** before another Nominatim request. While the query is too short, the map shows the default world view and a short hint.
- **Form vs saved data:** If the user has not dirtied the form, the preview can fall back to the **saved** address from the profile query when live `useWatch` values are still empty (e.g. before `reset` applies on the first tick).

#### Business credentials settings (password change by email)

The tenant **sign-in credentials** screen lives at **`/business/:businessId/settings/credentials`** (**`BusinessCredentialsSettingsPage`** in `frontend/src/pages/business/BusinessCredentialsSettingsPage.tsx`). It uses **`BusinessProfileSettingsStaticShell`** + **`useBusinessProfileSettingsGate`** from **`useBusinessProfileSettingsController.ts`** (profile fetch only — no Save/Reset bar, no full RHF **`useBusinessProfileSettingsController()`** form). Tenants change **password** by requesting **`POST /api/v1/auth/request-password-reset`** for their current business sign-in email (same secure flow as forgot password): they receive a link to **`/reset-password?token=…`**, set a new password there, and existing sessions are invalidated via **`refreshSessionVersion`** on success (see [`auth-email-security-flows.md`](./auth-email-security-flows.md)). **Changing the business sign-in email** is done on **`BusinessProfileSettingsPage`** (**`/settings/profile`**) via multipart **`PATCH`** (may force re-login after save).

- **UX:** Explainer copy + optional **email verification** banner with **resend confirmation** (authenticated **`resendEmailConfirmation()`**). A prominent **destructive** CTA sends the reset email; copy lives under **`business.credentialsSettings.*`** (including **`passwordChangeEmail.*`**).
- **Profile PATCH:** Optional inline **`password`** + **`currentPassword`** on **`PATCH /api/v1/business/:id`** remains supported for other clients; the web app’s credentials route no longer collects those fields.

---

## What the app can do — Solution for bars and restaurants

**The product is a full-stack, multi-tenant POS and operations platform** that lets a restaurant or bar run day-to-day service, manage its menu and supply chain, track stock and costs, and see daily and monthly performance — all from one place, with one business identity per location.

### Service and sales

Route-level behavior (open table, PATCH close/transfer/cancel, self-order and delivery transactions, `paymentId` idempotency) is spelled out in [`sales-point-sales-instance-orders.md`](./sales-point-sales-instance-orders.md).

- **Open and manage tables/sessions** — Define **sales points** (tables, bar, rooms), then open a **sales instance** (check/tab) per point. One open instance per table per day. There is **one QR per sales point** (the QR encodes the sales point id). Staff can open a table from the **POS UI** (on-duty employee only) or by **scanning the table’s QR**; customers can start a session via the same QR only when the sales point has **selfOrdering** enabled and **no open session exists at that table** (if an employee has already opened the table, customer self-order is blocked until the table is closed). Who is scanning is identified by login session.
- **Take and bill orders** — Create **orders** (menu items / business goods) on a sales instance: each order has one **main product** (businessGoodId) and optional **addOns**; **promotions** apply only to the main product. Support **discounts**, **promotions** (happy hour, % off, 2x1, etc., calculated in real time on the front end), **payment methods**, **tips**, and **void** or **invitation** (complimentary) status. **Transfer** open orders between tables. **Cancel**, **void**, and **invitation** are restricted to on-duty staff with a management role (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Supervisor); **void** requires a reason (e.g. waste, mistake, refund, other). **Close** orders with payment and optionally close the table when everything is paid.
- **Self-ordering** — The **same QR** at a sales point (one QR per point) can be used by an **employee (on-duty)** to open the table only (no order yet) or by a **customer** to self-order **when the sales point has selfOrdering enabled and the table has no open session**. If a table is already opened by staff, customers cannot use the QR to self-order until the table is closed. Who is scanning is identified by login session. Customer flow: scan → open session → place order → pay; the app creates the sales instance, orders, closes them, and records the sale in the **daily report** self-ordering section. After payment, the system sends an **email** (via nodemailer) and an **in-app notification** with the order confirmation/receipt so the customer can show it to staff when collecting the order. Customer self-ordering via QR is additionally **gated by business opening hours**: the Business document can define `businessOpeningHours` (weekly service windows), and the self-ordering route only allows customer orders when `isBusinessOpenNow(business)` is true. **Payment before orders are sent** (for self-order and delivery) is under study and not yet implemented; third-party payment integration is planned.
- **Printing** — **Printers** are configured per business; orders can be routed by **category** and **sales point** (e.g. kitchen printer for table X).

### Menu, costing, and inventory

- **Menu (business goods)** — Define **business goods** (items you sell): simple items, **ingredient-based** items (linked to **supplier goods** and quantities/units), or **set menus** (combos). The app computes **cost price** and **allergens** from ingredients; optional **gross margin** helper suggests selling price. **Promotions** apply to business goods; the front end applies rules at order time.
- **Stock that follows sales** — When an **order** is created, the app **decrements inventory** for the ingredients (supplier goods) of the ordered items. When an order is **cancelled**, stock is **restored**. So **what you sell** automatically reduces **what you have**.
- **Monthly inventory** — **Inventories** are created **once per month** per business (e.g. first day of month). Each inventory holds **dynamic system count** per supplier good (updated by orders and purchases) and **physical count** events (who counted, when, deviation, re-edits). Add or update counts per good; close the month when done. New supplier goods “in use” are added to the open inventory; removed goods are taken off.

### Supply chain and purchasing

- **Suppliers and catalog** — Register **suppliers** (vendors) per business. For each supplier, define **supplier goods** (products): name, category, measurement unit, price, budget impact, optional images. Supplier goods are the **ingredients** in business goods and the **lines** on purchases and inventory.
- **Purchases (incoming stock)** — Record **purchases** (one per receipt): supplier, date, employee, and **lines** (supplier good, quantity, price). Each line **increases** inventory. Add, edit, or remove lines (inventory stays in sync). **Edits** to purchase lines are manager-only, require a reason, and store re-edit data (original quantity and price) for tracking, similar to inventory physical-count re-edits. **One-time purchase** flow exists for ad-hoc buys when no supplier good is set up.
- **Waste and targets** — Business can set **metrics**: target **food/labor/fixed cost** percentages and **supplier good waste** by budget impact. Inventory and **monthly business report** tie actual performance to these targets (e.g. waste % by impact level).

### Login and flow routing

Technical detail for JWT, cookies, endpoints, and middleware: [`authentication-and-session.md`](./authentication-and-session.md).

- **Single login** — The app uses one sign-in form (email + password). The backend auth validates credentials against **Business** first, then **User**. The same form is used for back-office (business) and for people (users); the redirect after login depends on which entity the email belongs to.
- **Business** — If the email matches a Business and the password is correct, the session has type `business` and the user is redirected to the tenant shell (e.g. `/business/:businessId/dashboard`).
- **User** — If the email matches a User (and not a Business), the session has type `user`. The user is an individual identity: they can use the app as a **customer** (e.g. self-ordering, personal orders) or, if linked to an **Employee** record, they may also choose to continue as **employee**. Role (customer vs employee) is dictated by session/context. When a user is linked to an employee, after login they are shown a **mode-selection** page: “Continue as customer” or “Continue as employee”.
  - For **non-admin employees**, the **employee** option is enabled only when the user is **scheduled for that day** and the current time is within the allowed window: **from 5 minutes before the shift start** until the shift end; otherwise the employee button is visible but disabled (e.g. “Available from 5 minutes before your shift”). Schedule configuration is therefore **required for employee login** for non-admin staff (optional only if the business never uses employee mode).
  - Employees whose `allEmployeeRoles` includes the **Admin** role can log in as employee at any time, even when there is no schedule or they are outside any shift window.
  - The chosen mode is stored (e.g. in a cookie) and used by middleware to allow or deny access to the admin/employee area.

### People and operations

- **Employees** — **Employees** per business: name, role, documents, optional link to a **user** account. **Manager roles** (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Supervisor) can close daily/monthly reports and perform manager actions at any time (no on-duty requirement); **non‑manager** employees must be on duty for operational actions like opening tables. Attribution everywhere uses **userId** (ref User): sales instances store **openedByUserId**, **openedAsRole** (employee | customer), **responsibleByUserId**, **closedByUserId**; orders store **createdByUserId** and **createdAsRole**; daily reports store **userId** in employee and self-order sections. The app never uses employeeId for "who did it"; identity comes from session (userId).
- **Schedules** — **Schedules** provide **day-level** shift planning: which employees work when, **labour cost**, vacation, overlap validation. Labour cost feeds **monthly business report** cost breakdown. Schedules are also used at **login** to determine whether a user who is an employee can choose “Continue as employee” (see **`canLogAsEmployee` (schedule gate for “employee mode”)** in [`authentication-and-session.md`](./authentication-and-session.md)).
- **Users and notifications** — **Users** are app identities (e.g. linked to an employee). **User.employeeDetails** is the single optional reference to **Employee**, set only when the user is linked as staff and kept in sync by the employees API. There is no separate `Customer` persistence model; customer recipients are `User` ids. Effective role at runtime (`employee` vs `customer`) is derived from the user's employee link plus schedule/on-duty checks. Notification inbox state (read/deleted flags) is centralized on `User.notifications` for both customer and employee recipients.

### Reporting and analytics

Implementation detail, DSR attribution, incremental vs reconcile flows, and manager endpoints are documented in [`daily-sales-report-feature.md`](./daily-sales-report-feature.md). **Weekly and monthly KPI formulas** (margins, prime cost, break-even helpers, etc.) are specified in [`business-metrics-formulas.md`](./business-metrics-formulas.md) and implemented in `backend/src/reports/businessMetrics/calculations.ts`.

- **Daily sales report** — Created automatically when the **first sales instance of the day** is opened (see also [`sales-point-sales-instance-orders.md`](./sales-point-sales-instance-orders.md) for `dailyReferenceNumber`). Tracks **per-user** totals (sales, tips, cost of goods, payment methods, goods sold/void/invited) keyed by **userId** in `employeesDailySalesReport` and **userId** in `selfOrderingSalesReport`, plus **delivery** and **self-order** buckets as described in the DSR doc. **Calculate** reconciles top-level totals from actor rows; paid/void/invitation finalization feeds buckets via the canonical resolver. **Close** the day (manager/admin from session userId, no open orders) to lock the report.
- **Weekly business report** — One report per **week** per business, where the **start day of the week** (e.g. Monday or Sunday) is configured on the `Business` (`reportingConfig.weeklyReportStartDay`). It aggregates all **calculated/closed daily sales reports** whose days fall into that week and produces week-level financials (sales, COGS, tips, goods sold/voided/complimentary, payment methods, POS commission) and customer metrics. A week is **automatically aggregated and closed** when a new `dailySalesReport` is opened that belongs to the **next** reporting week. Fixed/extra costs are **not** included at the weekly level.
- **Monthly business report** — One report per **month** per business: **financial summary** (sales, COGS, net revenue, gross profit, void/invited, tips, percentages), **cost breakdown** (food, beverage, labour, fixed, extra), **goods sold/voided/complimentary**, **supplier waste by budget impact**, **payment methods**, **POS commission**. It is **refreshed automatically** after each business daily sales report is calculated (trigger from `calculateBusinessDailySalesReport`) by aggregating all relevant daily reports for that month, and the month is **auto-closed** at the month boundary when all daily reports are closed. A persisted `metricsComparison` section compares actual cost and waste ratios to business **metrics** (food cost %, labour %, fixed %, waste targets) to support break-even and KPI tracking, and managers receive a notification when a monthly report is ready to review.

### Why it matters for bars and restaurants

- **One system** for service (tables, orders, payments), **menu** (items, recipes, costing, allergens), **supply** (suppliers, goods, purchases), **stock** (inventory driven by sales and purchases), and **reporting** (daily by employee, monthly by business).
- **Real-time** POS: open tables, send orders, apply promotions, close with payment, and see stock move with sales — all without leaving the app.
- **Multi-location ready**: each **business** is a tenant; the same codebase serves many restaurants or bars with isolated data.
- **Control and visibility**: set **targets** (cost %, waste %); track **actual** in daily and monthly reports; use **inventory** and **purchases** to see what you have and what you spent. Reservations integrate into service flow via sales points and sales instances.

---

## Unified communications layer (email + in-app + live push)

Communication delivery is centralized in `backend/src/communications` using a single domain orchestration entrypoint (`dispatchEvent`).

- **Email** uses one SMTP provider path (Nodemailer transport singleton).
- **In-app** notifications are persisted first (source of truth) and then fanned out to user inbox state.
- **Live in-app** uses WebSocket push as an acceleration layer; persisted inbox remains the fallback when users are offline.
- **Domain modules** (orders, reservations, inventory alerts, weekly/monthly report-ready, **business profile updates** after authenticated `PATCH /api/v1/business/:businessId`) trigger communication by dispatching typed events, not by calling channels directly. Profile changes emit `BUSINESS_PROFILE_UPDATED` (manager in-app + manager email via `dispatchEvent`; see [`backend/src/communications/README.md`](../backend/src/communications/README.md)). Tenant web editors that PATCH the profile include **`BusinessProfileSettingsPage`** (**`/settings/profile`**), **`BusinessAddressSettingsPage`** (**`/settings/address`**), and other split settings routes that share the profile form shell (**`/settings/credentials`** is read-only for password and does not PATCH). See [`frontend-authentication-and-navigation.md`](./frontend-authentication-and-navigation.md).
- **Reliability** uses fire-and-forget defaults for non-blocking business flows, idempotency/noise controls for repeated events, and retry logic for transient SMTP failures.

Core environment controls:

- SMTP config: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Channel switches: `COMMUNICATIONS_EMAIL_ENABLED`, `COMMUNICATIONS_INAPP_ENABLED`, `COMMUNICATIONS_INAPP_LIVE_ENABLED`
- Reliability tuning: `COMMUNICATIONS_EMAIL_RETRY_ATTEMPTS`, `COMMUNICATIONS_EMAIL_RETRY_BASE_DELAY_MS`, `COMMUNICATIONS_IDEMPOTENCY_WINDOW_MS`
- Event policy overrides: `RESERVATION_PENDING_MANAGER_POLICY`, `LOW_STOCK_MANAGER_POLICY`, `MONTHLY_REPORT_MANAGER_POLICY`, `WEEKLY_REPORT_MANAGER_POLICY`, `BUSINESS_PROFILE_UPDATED_MANAGER_POLICY`

---

## Key architecture idea (how everything fits together)

- The system is **multi-tenant**: each restaurant/location is a **Business**.
- Most domain data is scoped by `businessId`, which is the “thread” connecting orders, employees, sales points, inventories, suppliers, reports, notifications, and more.
- The API is organized by domain under `backend/src/routes/v1/*`, with consistent patterns for:
  - DB connection initialization
  - ObjectId validation
  - request validation (including FormData when files are involved)
  - transactional writes for multi-step operations
  - consistent JSON error responses
