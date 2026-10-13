# POS

npm-workspace monorepo: `backend/` (Fastify + Mongoose), `frontend/` (React 19 + Vite), and `packages/` (`restaurant-pos-packages` — shared enums, interfaces, zod schemas, utils). Install once at the repo root; run workspace scripts from the root.

## Pointers

- [`docs/coding-standards.md`](docs/coding-standards.md) — index of the coding conventions; load the file matching the activity (building, debugging, testing, finishing).
- [`GLOSSARY.md`](GLOSSARY.md) — domain vocabulary.
- [`docs/adr/`](docs/adr/) — architecture decisions.

## Product documentation

Load only the document you need; each is self-contained and links to no other document.

- [`docs/product/overview.md`](docs/product/overview.md) — target-state product overview: what POS is, core vocabulary, surfaces, tenancy, and monetization. Load first for product context.
- [`docs/product/user-flow.md`](docs/product/user-flow.md) — end-to-end user journey from onboarding through service, purchasing, inventory, and reporting.
- [`docs/product/business-metrics-formulas.md`](docs/product/business-metrics-formulas.md) — canonical formulas behind the weekly and monthly metrics.
- [`docs/product/users.md`](docs/product/users.md) — target-state global identity model: the user, owner, employee membership, access layers, job roles, mode chooser, and the account lifecycle.
- [`docs/product/business.md`](docs/product/business.md) — target-state business details: adding a venue, the draft and go-live lifecycle, profile identity, currency, address and derived timezone, opening hours, delivery, discovery, and the subscription pointer.
- [`docs/product/_template.md`](docs/product/_template.md) — template and conventions for the per-feature product documents; load before writing or changing a subject document.
