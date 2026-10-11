# Restaurant POS — overview

Restaurant POS is a **complete, real-time POS and operations platform** for **bars and restaurants**. It is **multi-tenant**: each restaurant or bar is a **Business**, and most domain data is scoped by `businessId`. One business identity per location; the same codebase serves many tenants with isolated data.

It is full-stack: Fastify backend under `backend/`, React frontend under `frontend/`, shared contracts under `packages/`.

## What it covers

- **Business onboarding & configuration** (the restaurant/company profile, subscription plan, currency, KPIs/metrics)
- **Orders and live service flow** (opening a table/session, sending orders, tracking status, billing)
- **Supplies and purchasing** (suppliers, supplier goods, purchases/receipts)
- **Inventories** (monthly snapshots, dynamic stock changes driven by sales/production)
- **Employees and operations** (roles, shifts/on-duty, schedules)
- **Reports** (daily/monthly business reports and other analytics)
- **Notifications** (operational alerts, messages, promotions, etc.)
- **Promotions**
- **Reservations** (booking layer: customer requests + staff approval; links to tables/sales instances)

Everything works **in live time**: the POS state (open tables/sales instances, order status, stock movement, etc.) is continuously updated and reflected across the UI and APIs.

## Why it matters for bars and restaurants

- **One system** for service (tables, orders, payments), **menu** (items, recipes, costing, allergens), **supply** (suppliers, goods, purchases), **stock** (inventory driven by sales and purchases), and **reporting** (daily by employee, monthly by business).
- **Real-time** POS: open tables, send orders, apply promotions, close with payment, and see stock move with sales — all without leaving the app.
- **Multi-location ready**: each **business** is a tenant; the same codebase serves many restaurants or bars with isolated data.
- **Control and visibility**: set **targets** (cost %, waste %); track **actual** in daily and monthly reports; use **inventory** and **purchases** to see what you have and what you spent. Reservations integrate into service flow via sales points and sales instances.

## Where to go next

The day-to-day journey lives in [`user-flow.md`](./user-flow.md); operational mechanics in [`sales-point-sales-instance-orders.md`](../features/sales-point-sales-instance-orders.md); reporting in [`daily-sales-report-feature.md`](../features/daily-sales-report-feature.md) and [`business-metrics-formulas.md`](../features/business-metrics-formulas.md). See [`AGENTS.md`](../../AGENTS.md) for the full index.
