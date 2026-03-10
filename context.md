## Source of truth — Restaurant POS context

This file (`context.md`) is the **source of truth** for understanding **what this app is** and **how it works end-to-end**.

For a **detailed, user-level walkthrough of the full operational flow** (from business onboarding to live service, purchasing, inventory, and reporting), see:

- `docs/user-flow.md`

It is also the **entrypoint context for AI-assisted coding** in this repo:

- Start here to understand the product and high-level flow.
- Then jump into the relevant READMEs listed below to understand specific subsystems (API domains, models, validation patterns, transactions, etc.).
- As the app grows, **every major area should have its own README**, and this file should link to it.

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
- **Reservations** (and other service workflows as the app expands)

Everything is designed to work **in live time**, where the POS state (open tables/sales instances, order status, stock movement, etc.) is continuously updated and reflected across the UI and APIs.

---

## What the app can do — Solution for bars and restaurants

This section summarizes **what the app can do** and **what solution it offers** to bars and restaurants, based on the subsystems documented in the READMEs below.

**The product is a full-stack, multi-tenant POS and operations platform** that lets a restaurant or bar run day-to-day service, manage its menu and supply chain, track stock and costs, and see daily and (planned) monthly performance — all from one place, with one business identity per location.

### Service and sales

- **Open and manage tables/sessions** — Define **sales points** (tables, bar, rooms), then open a **sales instance** (check/tab) per point. One open instance per table per day; staff or customers (via QR) can start a session and attach all orders to it until close.
- **Take and bill orders** — Create **orders** (menu items / business goods) on a sales instance; support **discounts**, **promotions** (happy hour, % off, 2x1, etc., calculated in real time on the front end), **payment methods**, **tips**, and **void** or **invitation** (complimentary) status. **Transfer** open orders between tables; **cancel** orders (stock is restored). **Close** orders with payment and optionally close the table when everything is paid.
- **Self-ordering** — Sales points can have **QR codes** for self-ordering. One flow: customer scans → opens session → places order → pays; the app creates the sales instance, orders, closes them, and records the sale in the **daily report** self-ordering section.
- **Printing** — **Printers** are configured per business; orders can be routed by **category** and **sales point** (e.g. kitchen printer for table X).

### Menu, costing, and inventory

- **Menu (business goods)** — Define **business goods** (items you sell): simple items, **ingredient-based** items (linked to **supplier goods** and quantities/units), or **set menus** (combos). The app computes **cost price** and **allergens** from ingredients; optional **gross margin** helper suggests selling price. **Promotions** apply to business goods; the front end applies rules at order time.
- **Stock that follows sales** — When an **order** is created, the app **decrements inventory** for the ingredients (supplier goods) of the ordered items. When an order is **cancelled**, stock is **restored**. So **what you sell** automatically reduces **what you have**.
- **Monthly inventory** — **Inventories** are created **once per month** per business (e.g. first day of month). Each inventory holds **dynamic system count** per supplier good (updated by orders and purchases) and **physical count** events (who counted, when, deviation, re-edits). Add or update counts per good; close the month when done. New supplier goods “in use” are added to the open inventory; removed goods are taken off.

### Supply chain and purchasing

- **Suppliers and catalog** — Register **suppliers** (vendors) per business. For each supplier, define **supplier goods** (products): name, category, measurement unit, price, budget impact, optional images. Supplier goods are the **ingredients** in business goods and the **lines** on purchases and inventory.
- **Purchases (incoming stock)** — Record **purchases** (one per receipt): supplier, date, employee, and **lines** (supplier good, quantity, price). Each line **increases** inventory. Add, edit, or remove lines (inventory stays in sync). **One-time purchase** flow exists for ad-hoc buys when no supplier good is set up.
- **Waste and targets** — Business can set **metrics**: target **food/labor/fixed cost** percentages and **supplier good waste** by budget impact. Inventory and (planned) **monthly business report** tie actual performance to these targets (e.g. waste % by impact level).

### People and operations

- **Employees** — **Employees** per business: name, role, documents, optional link to a **user** account. **Current shift role** and **on duty** drive who can close daily reports or perform manager actions. Employees are attached to sales instances (opened by / responsible for) and to daily reports (who served, tips, goods sold/void/invited).
- **Schedules** — **Schedules** provide **day-level** shift planning: which employees work when, **labour cost**, vacation, overlap validation. Labour cost feeds (or will feed) **monthly business report** cost breakdown.
- **Users and notifications** — **Users** are app identities (e.g. linked to an employee). **Notifications** are business-scoped messages/events; users have an inbox with read/deleted state so the business can push alerts, promotions, or operational messages.

### Reporting and analytics

- **Daily sales report** — Created automatically when the **first sales instance of the day** is opened. Tracks **per-employee** totals (sales, tips, cost of goods, payment methods, goods sold/void/invited) and **business** totals. **Calculate** runs off **sales instances** and **orders** (by responsible employee and daily reference). **Close** the day (manager/admin, no open orders) to lock the report. Self-ordering sales are recorded in a separate section.
- **Monthly business report (planned)** — One report per **month** per business: **financial summary** (sales, COGS, net revenue, gross profit, void/invited, tips, percentages), **cost breakdown** (food, beverage, labour, fixed, extra), **goods sold/voided/complimentary**, **supplier waste by budget impact**, **payment methods**, **POS commission**. Intended to **update daily** from closed/calculated daily reports and **close at end of month**, with comparison to business **metrics** (food cost %, labour cost %, waste targets) for break-even and KPI tracking.

### Why it matters for bars and restaurants

- **One system** for service (tables, orders, payments), **menu** (items, recipes, costing, allergens), **supply** (suppliers, goods, purchases), **stock** (inventory driven by sales and purchases), and **reporting** (daily by employee, monthly by business).
- **Real-time** POS: open tables, send orders, apply promotions, close with payment, and see stock move with sales — all without leaving the app.
- **Multi-location ready**: each **business** is a tenant; the same codebase serves many restaurants or bars with isolated data.
- **Control and visibility**: set **targets** (cost %, waste %); track **actual** in daily and monthly reports; use **inventory** and **purchases** to see what you have and what you spent. Reservations and further workflows are planned.

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

At the moment, there are **18 READMEs** in the app. This list will grow over time and should be kept up to date.

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
- **Orders (billable items per sales instance, inventory consumption via business-good ingredients, create/cancel/close/transfer, promotions and payment)**  
  - `app/api/v1/orders/README.md`
- **Daily sales reports (day-level report per business, created by first sales instance, employee/business totals, calculate and close flow)**  
  - `app/api/v1/dailySalesReports/README.md`
- **Monthly business reports (month-level KPIs per business, aggregate from daily reports, cost and supplier waste, break-even; API to be implemented)**  
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
- **Reservations (planned: table/booking per business, link to sales points and service flow; API to be implemented)**  
  - `app/api/v1/reservations/README.md`

---

## How to keep this file useful (rule)

When you add a new subsystem or make a meaningful change to an existing one:

- Create or update the subsystem’s README close to the code (example: `app/api/v1/<domain>/README.md`).
- Add it to the list above.
- Keep READMEs focused on **flow**, **boundaries**, **patterns**, and **why it matters**, not just endpoint lists.