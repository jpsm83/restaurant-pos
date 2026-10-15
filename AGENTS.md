# Project Imperium

npm-workspace monorepo: `backend/` (Fastify + Mongoose), `apps/web` (React 19 + React Router v7 framework mode — Business and Customer surfaces), `apps/admin` (Superadmin console), and `packages/` (`domain` — shared enums, interfaces, zod schemas, utils; `ui` — shadcn/radix primitives, design tokens, and `cn`; `config` — shared build tooling). Install once at the repo root; run workspace scripts from the root.

> **Frontend architecture (ADR-0004, ADR-0005).** Two frontend deployables split by trust realm: `apps/web` (Business at `/business`, Customer at `/client`) and `apps/admin` (separate realm). Device is a layout concern, never an app boundary. The API is the contract for every client — web, admin, and a native POS — so writes go through `/api/v1` and the SSR server is never a data layer.

## Pointers

- [`docs/coding-standards.md`](docs/coding-standards.md) — index of the coding conventions; load the file matching the activity (building, debugging, testing, finishing).
- [`GLOSSARY.md`](GLOSSARY.md) — domain vocabulary.
- [`docs/adr/`](docs/adr/) — architecture decisions.

## Product documentation

Load only the document you need; each is self-contained and links to no other document.

- [`docs/product/overview.md`](docs/product/overview.md) — target-state product overview: what Project Imperium is, core vocabulary, surfaces, tenancy, and monetization. Load first for product context.
- [`docs/product/users.md`](docs/product/users.md) — target-state global identity model: the user, owner, employee membership, access layers, job roles, mode chooser, and the account lifecycle.
- [`docs/product/business.md`](docs/product/business.md) — target-state business details: adding a venue, the draft and go-live lifecycle, profile identity, currency, address and derived timezone, opening hours, delivery, discovery, and the subscription pointer.
- [`docs/product/business-metrics.md`](docs/product/business-metrics.md) — target-state business metrics: the financial inputs and cost-category conventions, cost targets, supplier-good waste thresholds by budget impact, the reporting-week start day, the dimension vocabulary, benchmarks, and the full KPI catalogue with canonical formulas.
- [`docs/product/business-reports.md`](docs/product/business-reports.md) — target-state business reports: the daily, weekly, and monthly reports, their buckets, periods and boundaries, dimension breakdowns, the target-vs-actual comparison, closing and reopening, and the report-ready signal.
- [`docs/product/business-goods.md`](docs/product/business-goods.md) — target-state business goods: the sellable menu item, simple and recipe-based items and combos with their components, derived cost and allergens, selling price, menu categories, add-ons, on-menu and availability state, preparation time, and deletion.
- [`docs/product/suppliers.md`](docs/product/suppliers.md) — target-state suppliers: the vendor profile, address, contacts, tax number, in-use lifecycle and deletion, the supplier-to-goods relationship, purchase history, and sending a goods request.
- [`docs/product/supplier-goods.md`](docs/product/supplier-goods.md) — target-state supplier goods: the purchasable item and unit of stock, measurement and purchase units with price math, budget impact, allergens, par level and minimum required, in-use state, and deletion.
- [`docs/product/purchases.md`](docs/product/purchases.md) — target-state purchases: recording goods from a supplier, the request-to-receipt lifecycle, purchase lines with requested and delivered quantities, the inventory increment, one-time purchases, and edit-with-reason plus audit.
- [`docs/product/inventories.md`](docs/product/inventories.md) — target-state inventory: the dynamic system count, on-demand physical counts and count periods, the monthly resume and close, variance and waste, low and negative stock, inventory value, and same-Company transfers valued at cost.
- [`docs/product/sales-points-and-instances.md`](docs/product/sales-points-and-instances.md) — target-state sales points and their instances: point types and channels, QR identity, the reserved hold, the virtual delivery and kiosk points, instance opening and attribution, the one-open rule, self-service instances and order handover, the reservation link, and deletion.
- [`docs/product/orders.md`](docs/product/orders.md) — target-state orders: the billable line of a main good and add-ons, the draft-to-sent batch with its identification code, order pricing and cost, promotions and manual discounts, transfer, void, invitation and cancellation, kitchen status and don't-make, and the bill.
- [`docs/product/gift-cards.md`](docs/product/gift-cards.md) — target-state gift cards: the business-issued bearer budget card, its paid and granted issue, the virtual card emailed to the holder, value and minimum, expiry and forfeiture, and redemption as a payment method at the issuing venue.
- [`docs/product/promotions.md`](docs/product/promotions.md) — target-state promotions: the six discount types, targeting by menu subcategory, the active window and enabled switch, the overlap rule, real-time application to orders, the delivery extension, and deletion.
- [`docs/product/payments-and-tax.md`](docs/product/payments-and-tax.md) — target-state payments and tax: recorded payment methods, third-party providers and direct processing, splits and partial payments, tips, refunds and payouts, and the business-level per-category tax configuration on tax-inclusive prices.
- [`docs/product/notifications.md`](docs/product/notifications.md) — target-state notifications: the per-user inbox, severities and engagement kinds, the operational event catalogue, venue engagement messaging and events, direct messages, delivery reliability, and the engagement mute.
- [`docs/product/emails.md`](docs/product/emails.md) — target-state emails: the account/security, operational, and engagement message catalogue, one-time links and anti-enumeration, language, and best-effort delivery and retry.
- [`docs/product/_template.md`](docs/product/_template.md) — template and conventions for the per-feature product documents; load before writing or changing a subject document.
