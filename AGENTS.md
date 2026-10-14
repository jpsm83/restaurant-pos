# POS

npm-workspace monorepo: `backend/` (Fastify + Mongoose), `frontend/` (React 19 + Vite), and `packages/` (`restaurant-pos-packages` — shared enums, interfaces, zod schemas, utils). Install once at the repo root; run workspace scripts from the root.

## Pointers

- [`docs/coding-standards.md`](docs/coding-standards.md) — index of the coding conventions; load the file matching the activity (building, debugging, testing, finishing).
- [`GLOSSARY.md`](GLOSSARY.md) — domain vocabulary.
- [`docs/adr/`](docs/adr/) — architecture decisions.

## Product documentation

Load only the document you need; each is self-contained and links to no other document.

- [`docs/product/overview.md`](docs/product/overview.md) — target-state product overview: what POS is, core vocabulary, surfaces, tenancy, and monetization. Load first for product context.
- [`docs/product/users.md`](docs/product/users.md) — target-state global identity model: the user, owner, employee membership, access layers, job roles, mode chooser, and the account lifecycle.
- [`docs/product/business.md`](docs/product/business.md) — target-state business details: adding a venue, the draft and go-live lifecycle, profile identity, currency, address and derived timezone, opening hours, delivery, discovery, and the subscription pointer.
- [`docs/product/business-metrics.md`](docs/product/business-metrics.md) — target-state business metrics: cost targets, supplier-good waste thresholds by budget impact, the reporting-week start day, and the KPI dictionary with its canonical formulas.
- [`docs/product/business-goods.md`](docs/product/business-goods.md) — target-state business goods: the sellable menu item, simple and recipe-based items and combos with their components, derived cost and allergens, selling price, menu categories, add-ons, on-menu and availability state, preparation time, and deletion.
- [`docs/product/suppliers.md`](docs/product/suppliers.md) — target-state suppliers: the vendor profile, address, contacts, tax number, in-use lifecycle and deletion, the supplier-to-goods relationship, purchase history, and sending a goods request.
- [`docs/product/supplier-goods.md`](docs/product/supplier-goods.md) — target-state supplier goods: the purchasable item and unit of stock, measurement and purchase units with price math, budget impact, allergens, par level and minimum required, in-use state, and deletion.
- [`docs/product/purchases.md`](docs/product/purchases.md) — target-state purchases: recording goods from a supplier, the request-to-receipt lifecycle, purchase lines with requested and delivered quantities, the inventory increment, one-time purchases, and edit-with-reason plus audit.
- [`docs/product/notifications.md`](docs/product/notifications.md) — target-state notifications: the per-user inbox, severities and engagement kinds, the operational event catalogue, venue engagement messaging and events, direct messages, delivery reliability, and the engagement mute.
- [`docs/product/emails.md`](docs/product/emails.md) — target-state emails: the account/security, operational, and engagement message catalogue, one-time links and anti-enumeration, language, and best-effort delivery and retry.
- [`docs/product/_template.md`](docs/product/_template.md) — template and conventions for the per-feature product documents; load before writing or changing a subject document.
