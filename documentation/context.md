<a id="critical-engineering-rules"></a>

## Critical — engineering rules (entire project)

> **Read this block first.** These rules are **binding for the whole repository**—every contributor and every automated coding pass—**before** any source file is added or edited. They override convenience habits when there is a conflict. If a change must break a rule, document **why** in the PR or task (rare exceptions only).

1. **React.js best practices** — Follow **current, mainstream React** discipline: correct hooks usage, clear component boundaries, predictable state and effects, accessibility, and sensible performance (avoid unnecessary work). Frontend work must stay aligned with how **professional** React applications are structured and reviewed.

2. **Professional-grade patterns** — Prefer patterns and structure seen in **serious, widely maintained** projects (clear separation of concerns without ceremony, consistent error and data boundaries, typing where the repo already uses it). **Do not** invent parallel architectures or novel abstractions when an established pattern already fits.

3. **No overcomplication** — **Absolutely do not** overcomplicate code, APIs, or user-visible flows. Favor **direct, readable, robust** solutions. If a reviewer cannot follow the path from entry to outcome quickly, the design is probably wrong.

4. **Minimal files and layers** — **Do not** create extra files, wrappers, or indirection **unless strictly necessary** for the task. Avoid new “layers” (config cascades, generic helpers used once, shared schema god-files) that exist only to look organized. **Colocate** with the feature that owns the behavior; expand surface area only when reuse or complexity **demands** it.

5. **Use shadcn/ui primitives first** — When building UI, always prefer components from `frontend/src/components/ui` (e.g. `Button`, `Input`, `Select`, `Label`, `Alert`, etc.). Do **not** recreate existing “wheels”. Only create personal components when a suitable shadcn/ui component does not exist or cannot meet the requirement.

6. **Robust code + concise comments** — Code must be **robust and reliable**. Every non-trivial block (complex function logic, validation rules, state transitions, branching decisions) must include **concise comments** explaining the intent and the reasoning behind the implementation.

7. **Forms must match the backend model** — For any form work, ensure the **Zod validation schema** matches the backend form/model rules in `backend/src/models` (field names, required vs optional, types, constraints). When in doubt, reference the backend model in comments and keep the frontend schema synchronized.

8. **Shared types/contracts discipline** — Shared frontend/backend domain or API contracts must live in `packages/interfaces` when they are reused across layers. Keep feature-only UI/form types colocated with the owning frontend feature.

9. **No barrel index centralization** — Do not create `index.ts` files to centralize exports for domains/features. Use direct module imports instead to keep dependencies explicit and avoid “god files”.

10. **Preserve shared interface filenames** — When evolving `packages/interfaces`, do not rename existing interface files unless an explicit migration plan is approved. Add or update types inside existing files to avoid breaking imports.

11. **Comment flow, logic, and patterns** — All source code creation or execution must include concise comments for non-trivial flow, logic, and pattern decisions so any developer can quickly understand the implementation and optimize work time.

12. **Test every touched file before progressing** — Every file created or updated must have relevant tests executed and passing before moving to the next task. If automated coverage is missing for a touched area, add/update tests or explicitly document the temporary gap and mitigation.

13. **Loading UI — centralized skeleton** — Use the shadcn **`Skeleton`** component at `frontend/src/components/ui/skeleton.tsx` as the **single source** for loading-placeholder styling (pulse + fill). Do not recreate one-off pulsing gray boxes. **App-wide** session bootstrap and lazy-route suspense use **`AppPendingShell`**, which composes only that `Skeleton`. **Per-page** loading (e.g. React Query pending) should compose the same `Skeleton` into layouts that mirror the real page structure. Split business settings routes use **`BusinessProfileSettingsFormShell`** with optional **`loadingSlot`** (and shared **`BusinessProfileSettingsLoadingCard`**) so each settings page owns its loading shape while the shell keeps query/error/ready orchestration. **Direction:** every route should show an appropriate skeleton while session or data is loading; roll out incrementally where gaps remain.

---

## Source of truth — Restaurant POS context

This file (`documentation/context.md`) is the **canonical entry point** and **bridge document** for how the Restaurant POS is supposed to work. Treat it as the **first place to read** for product intent and how subsystems connect; then open the focused docs below (or the code-adjacent READMEs) for depth.

### Companion documentation (reference map)

These files sit alongside `context.md` under `documentation/`. They are the **authoritative expansions** for specific slices of behavior. When behavior or implementation changes, update the relevant companion doc **and** keep this bridge section accurate.

| Document | Use it for |
|----------|------------|
| [`user-flow.md`](./user-flow.md) | **End-to-end user perspective**: onboarding, login/mode selection, reservations → service, orders, purchasing, inventory, daily/weekly/monthly reporting, notifications—narrative walkthrough aligned with this file. |
| [`sales-point-sales-instance-orders.md`](./sales-point-sales-instance-orders.md) | **Operational core**: sales points vs sales instances vs orders; `dailyReferenceNumber`; employee vs customer flows; conflict rules; key routes (`salesInstances`, `orders`, self-order/delivery); promotions by flow; inventory hooks on create/cancel/close. |
| [`daily-sales-report-feature.md`](./daily-sales-report-feature.md) | **Daily Sales Report (DSR)**: model and actor buckets; canonical attribution (`resolveFinalizationActorReportTarget`); incremental finalization vs reconcile; manager APIs; rollout/telemetry; link to weekly/monthly rollups. |
| [`business-metrics-formulas.md`](./business-metrics-formulas.md) | **Weekly/monthly KPI math**: profitability, cost mix, break-even targets, operational efficiency; formulas match `backend/src/reports/businessMetrics/calculations.ts`. |
| [`authentication-and-session.md`](./authentication-and-session.md) | **Auth stack (backend)**: Business vs User credentials, JWT access + refresh cookie, login/signup/logout/refresh/me/set-mode, tokens on **business create** and **authenticated business PATCH** / **self user PATCH**, `canLogAsEmployee` vs `getEffectiveUserRoleAtTime`, route middleware. |
| [`../FRONTEND_AUTHENTICATION_AND_NAVIGATION_STRATEGY.md`](../FRONTEND_AUTHENTICATION_AND_NAVIGATION_STRATEGY.md) | **Web app shell (strategy)**: public marketing vs authenticated areas, URL/session partitions (business tenant vs person user), employee mode and navigation — decisions before implementation. |
| [`../FRONTEND_AUTH_NAVIGATION_IMPLEMENTATION_PLAN.md`](../FRONTEND_AUTH_NAVIGATION_IMPLEMENTATION_PLAN.md) | **Web app shell**: public marketing, auth partitions, mode selection — phased tasks, route/guard work, lazy loading/error boundary polish, and tests; companion to the strategy doc above. |
| [`frontend-authentication-and-navigation.md`](./frontend-authentication-and-navigation.md) | **Frontend (implemented)**: detailed **auth + navigation** behavior in `frontend/src` — session types, `getPostLoginDestination`, guards, `auth_mode`, schedule countdown, route map, and file index. |
| [`frontend-i18n.md`](./frontend-i18n.md) | **Frontend i18n (implemented)**: `i18next` + `react-i18next` in `frontend/src/i18n`, **`en` + `es`** namespaces, how to add strings, `renderWithI18n`, language persistence, navbar switcher, **`npm run i18n:check-parity`**. |
| [`frontend-third-party-libraries.md`](./frontend-third-party-libraries.md) | **Frontend npm stack**: major dependencies by layer (routing, Query, RHF+Zod forms, Radix/shadcn UI, i18n, etc.) and **conventions for adding packages**. |
| [`i18n-implementation-plan.md`](./i18n-implementation-plan.md) | **Frontend i18n status/backlog**: completed locale work (Mar 2026), optional next steps (`Intl`, i18next-parser) — companion to `frontend-i18n.md`. |
| [`i18n-locale-coverage-todo.md`](./i18n-locale-coverage-todo.md) | **Presentation × namespace inventory** and completed blocks 0–9 audit (wiring + Spanish for all listed TSX). |

**Reading order suggestion:** skim `context.md` (this file) → `user-flow.md` for the story → [`authentication-and-session.md`](./authentication-and-session.md) when wiring login, cookies, or guards → [`frontend-i18n.md`](./frontend-i18n.md) when changing **web UI copy or locales** → [`frontend-third-party-libraries.md`](./frontend-third-party-libraries.md) when adding **frontend npm dependencies** or **forms (RHF + Zod)** → `sales-point-sales-instance-orders.md` for table/order mechanics → `daily-sales-report-feature.md` when working on reporting → `business-metrics-formulas.md` when interpreting or changing KPI outputs.

### Entry point for AI-assisted coding

- Obey **[Critical — engineering rules](#critical-engineering-rules)** at the top of this file **before** proposing or applying code changes.
- Start here for **product shape** and **cross-cutting rules**.
- Use the **companion docs** above for **how the app is supposed to work** in detail (users, auth sessions, POS/session model, DSR, metrics).
- Use the **READMEs** listed later for **implementation** next to code (API domains, models, validation, transactions).
- As the app grows, **every major area should have its own README** (or documentation file), and this file should **link** to it.

---

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

The tenant **postal address** editor lives at **`/business/:businessId/settings/address`** (**`BusinessAddressSettingsPage`** in `frontend/src/pages/business/BusinessAddressSettingsPage.tsx`). It uses the same split-settings shell as other business profile slices (**`BusinessProfileSettingsFormShell`** + **`useBusinessProfileSettingsController`**) so address fields are part of the full profile form and save with **`PATCH /api/v1/business/:businessId`**.

- **Location preview:** **`BusinessAddressLocationMap`** (`frontend/src/components/BusinessAddressLocationMap.tsx`) shows an **OpenStreetMap** tile layer and geocodes a free-text query with **Nominatim** via **`leaflet-control-geocoder`** (public service; respect OSM usage policy in production).
- **Query string:** Built locally with **`buildAddressGeocodeQuery`** on the address page: **street-first** parts joined with commas (`street`, `buildingNumber`, `city`, `state`, `postCode`, `region`, `country`). **`doorNumber`** and **`complement`** are **omitted** from the geocode string only (they remain on the saved profile); unit-level text often prevents Nominatim from matching.
- **When the map refetches:** The first time a **non-empty** trimmed query reaches the map (length ≥ **3**), geocoding runs **immediately** so the pin appears on load. **Later** changes to the query (after that first scheduled run) are **debounced by 3 seconds** before another Nominatim request. While the query is too short, the map shows the default world view and a short hint.
- **Form vs saved data:** If the user has not dirtied the form, the preview can fall back to the **saved** address from the profile query when live `useWatch` values are still empty (e.g. before `reset` applies on the first tick).

---

## What the app can do — Solution for bars and restaurants

This section summarizes **what the app can do** and **what solution it offers** to bars and restaurants. For the **full user journey** (onboarding through end-of-month), see [`user-flow.md`](./user-flow.md). For **tables, sessions, orders, QR, delivery/self-order mechanics**, see [`sales-point-sales-instance-orders.md`](./sales-point-sales-instance-orders.md). The READMEs below cover implementation next to the code.

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
- **Business** — If the email matches a Business and the password is correct, the session has type `business` and the user is redirected to the business/admin flow (e.g. `/admin`).
- **User** — If the email matches a User (and not a Business), the session has type `user`. The user is an individual identity: they can use the app as a **customer** (e.g. self-ordering, personal orders) or, if linked to an **Employee** record, they may also choose to continue as **employee**. Role (customer vs employee) is dictated by session/context. When a user is linked to an employee, after login they are shown a **mode-selection** page: “Continue as customer” or “Continue as employee”.
  - For **non-admin employees**, the **employee** option is enabled only when the user is **scheduled for that day** and the current time is within the allowed window: **from 5 minutes before the shift start** until the shift end; otherwise the employee button is visible but disabled (e.g. “Available from 5 minutes before your shift”). Schedule configuration is therefore **required for employee login** for non-admin staff (optional only if the business never uses employee mode).
  - Employees whose `allEmployeeRoles` includes the **Admin** role can log in as employee at any time, even when there is no schedule or they are outside any shift window.
  - The chosen mode is stored (e.g. in a cookie) and used by middleware to allow or deny access to the admin/employee area.

### People and operations

- **Employees** — **Employees** per business: name, role, documents, optional link to a **user** account. **Manager roles** (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Supervisor) can close daily/monthly reports and perform manager actions at any time (no on-duty requirement); **non‑manager** employees must be on duty for operational actions like opening tables. Attribution everywhere uses **userId** (ref User): sales instances store **openedByUserId**, **openedAsRole** (employee | customer), **responsibleByUserId**, **closedByUserId**; orders store **createdByUserId** and **createdAsRole**; daily reports store **userId** in employee and self-order sections. The app never uses employeeId for "who did it"; identity comes from session (userId).
- **Schedules** — **Schedules** provide **day-level** shift planning: which employees work when, **labour cost**, vacation, overlap validation. Labour cost feeds **monthly business report** cost breakdown. Schedules are also used at **login** to determine whether a user who is an employee can choose “Continue as employee” (see **Schedule check at login** in `app/api/v1/schedules/README.md`).
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
- **Domain modules** (orders, reservations, inventory alerts, weekly/monthly report-ready, **business profile updates** after authenticated `PATCH /api/v1/business/:businessId`) trigger communication by dispatching typed events, not by calling channels directly. Profile changes emit `BUSINESS_PROFILE_UPDATED` (manager in-app + manager email via `dispatchEvent`; see `backend/src/communications/README.md`). The tenant web editor is **`BusinessProfileSettingsPage`** at **`/business/:businessId/settings/profile`** (see `documentation/frontend-authentication-and-navigation.md`).
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
- The API is organized by domain under `app/api/v1/*`, with consistent patterns for:
  - DB connection initialization
  - ObjectId validation
  - request validation (including FormData when files are involved)
  - transactional writes for multi-step operations
  - consistent JSON error responses

---

## READMEs (subsystem documentation)

At the moment, there are **20 READMEs** in the app. This list will grow over time and should be kept up to date.

- **Business domain (tenant root, onboarding, cascade delete, and app-wide coupling)**  
  - `app/api/v1/business/README.md`
- **Suppliers (vendors per business, supply chain, one-time purchase, and link to supplier goods / purchases / inventory)**  
  - `app/api/v1/suppliers/README.md`
- **Supplier goods (catalog of products per supplier, inventory sync, business-good ingredients, purchases, images)**  
  - `app/api/v1/supplierGoods/README.md`
- **Business goods (menu items, ingredients/set menus, costing+allergens, promotions coupling, and inventory consumption via orders)**  
  - `app/api/v1/businessGoods/README.md`
- **Purchases (receipts from suppliers, one purchase per receipt, inventory updates, add/edit/delete lines, one-time purchase flow)**  
  - `app/api/v1/purchases/README.md`
- **Inventories (monthly stock per business, dynamic counts from orders/purchases, physical counts and re-edits, supplier-good sync)**  
  - `app/api/v1/inventories/README.md`
- **Printers (print destinations per business, order routing by category/sales point, connection check, configuration setups)**  
  - `app/api/v1/printers/README.md`
- **Sales points (tables/rooms/bar per business, QR self-ordering, sales instance and order anchoring, printer routing)**  
  - `app/api/v1/salesPoints/README.md`
- **Sales instances (open table/session per sales point, daily report trigger, order grouping, self-order flow, PATCH order actions)**  
  - `app/api/v1/salesInstances/README.md`
- **Orders (billable items per sales instance: main product businessGoodId + optional addOns; inventory consumption via business-good ingredients; promotions apply to main product only; create/cancel/close/transfer, payment)**  
  - `app/api/v1/orders/README.md`
- **Daily sales reports (day-level report per business, created by first sales instance, employee/business totals, calculate and close flow)**  
  - `app/api/v1/dailySalesReports/README.md`
- **Monthly business reports (month-level KPIs per business, aggregate from daily reports, cost and supplier waste, break-even; API implemented)**  
  - `app/api/v1/monthlyBusinessReport/README.md`
- **Notifications (business-scoped events/messages, recipients inbox linking, read/deleted flags, transactional updates)**  
  - `app/api/v1/notifications/README.md`
- **Employees (staff per business, roles, user linkage, documents, printers coupling, vacation logic)**  
  - `app/api/v1/employees/README.md`
- **Schedules (day-level shift planning per business, employee shifts/vacation, labour cost, overlap validation)**  
  - `app/api/v1/schedules/README.md`
- **Users (app identity, personal details, employee link, notification inbox read/deleted flags)**  
  - `app/api/v1/users/README.md`
- **Promotions (business-scoped discount rules, validation helpers, and real-time pricing integration with orders)**  
  - `app/api/v1/promotions/README.md`
- **Ratings (user reviews 0–5 per business, Business averageRating/ratingCount, discovery filter and future rating emails)**  
  - `app/api/v1/ratings/README.md`
- **Reservations (table/booking per business, linked to sales points and sales instances; API implemented)**  
  - `app/api/v1/reservations/README.md`
- **Communications (unified dispatch orchestration, SMTP email, persisted in-app notifications, and live WebSocket push)**  
  - `backend/src/communications/README.md`

---

## How to keep this file useful (rule)

When you add a new subsystem or make a meaningful change to an existing one:

- Create or update the subsystem’s README close to the code (example: `app/api/v1/<domain>/README.md`).
- Add it to the list above.
- If the change affects **user-visible flow**, **authentication or session behavior**, **POS/session/order behavior**, **DSR**, or **reporting formulas**, update the matching file under `documentation/` ([`user-flow.md`](./user-flow.md), [`authentication-and-session.md`](./authentication-and-session.md), [`frontend-authentication-and-navigation.md`](./frontend-authentication-and-navigation.md) for **frontend** route/guard/auth changes, [`sales-point-sales-instance-orders.md`](./sales-point-sales-instance-orders.md), [`daily-sales-report-feature.md`](./daily-sales-report-feature.md), [`business-metrics-formulas.md`](./business-metrics-formulas.md)) and, if needed, one line in the **Companion documentation** table at the top of this file.
- Keep READMEs and companion docs focused on **flow**, **boundaries**, **patterns**, and **why it matters**, not just endpoint lists.