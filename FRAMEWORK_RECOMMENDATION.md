# Framework & tooling recommendation (Restaurant POS)

This document captures the current recommendation for **which frameworks/tools to use** for this project, based on the product described in `context.md` and `user-flow.md`.

## What we’re building (workload summary)

- **Multi-tenant POS + operations platform** (everything scoped by `businessId`)
- **Highly interactive UI** (POS + admin workflows)
- **Constant API calls** + many mutations (orders, inventory deltas, reports recalculation, notifications)
- **Heavy domain logic/calculations** on both sides (promotions, totals, COGS, variance, daily→weekly→monthly aggregation, permissions by role/schedule)
- **Low SEO value** for the core product (most of the app is authenticated/admin/POS)

## Key decision: “Desktop app” means SaaS (**Software as a service**) web app

When we say “desktop app”, we mean **a SaaS web app used on desktops (browser)**, not an Electron/Tauri native desktop runtime.

So the platform target is:

- **Web SaaS** for management/admin (desktop + mobile browsers)
- **Android app** for POS/waiters (React Native, IOS)
- **One backend API** shared by all clients

## Recommendation (high-level)

### Core recommendation

- **Web SaaS (admin + POS web surfaces, if any)**: **Vite + React** (SPA) with:
  - **TanStack Router** for routing/loaders
  - **TanStack Query** for server-state caching, dedupe, invalidation, optimistic updates
- **Backend**: **standalone Node.ts API service** (not coupled to Next route handlers)
  - Prefer **Fastify** for performance + plugin ecosystem (Express is acceptable if already entrenched)
  - Add **real-time** transport (WebSockets or SSE) for live POS updates
- **Android & IOS POS**: **React Native (Expo)** + TanStack Query

### Repo layout recommendation (monorepo)

Use a single repo (monorepo) with separate apps so the backend can serve multiple clients cleanly.

- `frontend/` — Web SaaS (Vite + React)
- `backend/` — Node API (Express now, Fastify later if desired)
- `packages/` (optional, recommended) — shared code across apps
  - `packages/core/` — shared *pure* domain helpers (promotion math, money rounding, parsing/formatting)
  - `packages/api-contract/` — OpenAPI spec + generated types/clients (or shared request/response types)
  - (optional) `packages/ui/` — shared UI primitives for web only (do not share web UI with RN unless you explicitly choose to)

This structure makes it easier to:

- ship coordinated changes across backend + frontend
- reuse shared logic safely
- add more clients later (React Native, kiosk app, etc.)

### What we’re *not* recommending as the “center”

- **Next.ts App Router as the core of the POS/admin**: it can work, but its SSR/RSC/caching strengths don’t align with an interaction-first POS that constantly fetches/mutates state.
- **TanStack Start as a requirement**: we can adopt it later, but we don’t need it to get the biggest gains (router + query + explicit caching patterns).

## Package manager / workspaces (monorepo tooling)

Pick one workspace approach and stick to it.

- **pnpm workspaces** (recommended default for monorepos): fast installs, strict dependency isolation, great for `packages/`
- Alternatives: npm workspaces or yarn workspaces (also fine)

Minimum goal: install dependencies once at repo root and run both apps from one place.

## Local development workflow (target)

In the monorepo, aim for:

- **one command** to run backend + frontend together (concurrently)
- a **dev proxy** from `frontend/` → `backend/` (so the browser app calls `/api/...` locally without CORS pain)
- **shared types** generated/available for both backend and frontend in dev

## Multi-client rules (why we structure it this way)

Because we will have Web + Android (and possibly more clients):

- **The backend is the source of truth** for authorization and final calculations.
- Avoid building “web-only backend behavior” (e.g., server-actions/server-functions) that RN cannot use, unless you are intentionally creating a separate web-only API layer.

## Detailed stack (recommended defaults)

### Backend (shared for Web + RN)

- **Runtime**: Node.ts
- **HTTP framework**: **Fastify**
- **Validation**: **Zod** at API boundaries
- **Realtime**: **WebSockets** (or **SSE** for unidirectional updates)
  - Use realtime for: open tables/sales instances, order status changes, notifications, low-stock alerts
  - This reduces “constant polling” and improves perceived performance
- **Auth**: centralize in backend (token/session) so Web + RN share the same auth model
- **API contract**: **OpenAPI** (recommended with multiple clients)
  - Generate typed clients for Web + RN
  - Keep request/response shapes consistent and versionable

### Web SaaS (management/admin)

- **Build tool**: **Vite**
- **UI**: React
- **Routing**: **TanStack Router**
- **Data**: **TanStack Query**
  - Configure per-screen caching (`staleTime`, refetch triggers, invalidation keys like `businessId`, `salesInstanceId`, `dailyReferenceNumber`)
  - Prefer optimistic updates for high-frequency actions (order create/close/transfer) where safe
- **Forms**: React Hook Form + Zod resolver
- **Component library** (pick one for consistency and speed):
  - MUI or Mantine (or Tailwind + a component kit if fully custom)

### Android (waiter/POS)

- **Framework**: React Native
- **Tooling**: **Expo** (recommended default for speed + OTA updates)
- **Data**: TanStack Query
- **Offline mode** (major product decision):
  - If **offline is required** (Wi‑Fi drops): plan for local persistence + sync/queue from day 1 (e.g., SQLite via Expo + conflict strategy).
  - If **offline is not required**: keep it online-first + realtime, simpler and faster to ship.

## Architecture principles that matter for this POS

### 1) Keep the backend independent

Because we have (or will have) multiple clients (Web + RN), keep domain logic and API behavior **backend-owned**, not framework-owned.

### 2) Avoid duplicating business calculations across clients

Promotions/totals/report logic must not drift between Web and RN.

Recommended approach:

- Create a **shared “core” package** (prefer TypeScript) for:
  - promotion calculation helpers
  - money rounding rules/tax helpers
  - small, deterministic pricing utilities used by multiple clients
- Keep authoritative final calculations/enforcement on the backend.

### 3) Prefer realtime over aggressive polling

POS feels “fast” when state changes appear immediately across screens/devices.

- Use WebSockets/SSE to push changes.
- Use TanStack Query to keep caches consistent (invalidate/refetch on events).

## When Next.ts *does* make sense here

Use Next.ts when you explicitly want:

- **Marketing/public pages with SEO**
- A small set of **public entry points** (e.g., reservation landing pages) that benefit from SSR/edge middleware

If we keep Next.ts, a common pattern is:

- Next.ts for marketing/public pages (optional)
- Vite SPA for the authenticated admin/POS UI (recommended)
- Standalone Node API for all domain operations (recommended)

## Open questions (answering these finalizes the blueprint)

- **Offline requirement** for waiter/POS Android: yes/no?
- Deployment target: Vercel vs containers/VPS vs managed platform?
- Database choice and scaling approach (indexes, transactions, reporting aggregation cadence)

## Migration note: Express → Fastify

If/when you migrate from Express to Fastify, keep risk low by preserving behavior:

- lock down the API contract (OpenAPI) and/or integration tests first
- migrate route-by-route behind the same endpoints
- measure performance after (most latency in POS systems is usually DB + domain logic, not just the HTTP framework)

## Monorepo bootstrap (what we created in this repo)

This repo now contains the **new monorepo skeleton**; the legacy root Next.ts app has been decommissioned, with `backend/` + `frontend/` as the intended core.

### Folders

- `frontend/` — new web app (**Vite + React + TypeScript** scaffold; this is the intended “plain React” frontend)
- `backend/` — new Fastify API service (skeleton only for now)
- (optional later) `packages/` — shared logic/contracts

### Ports (defaults)

- **frontend**: `http://localhost:3000`
- **backend**: `http://localhost:4000` (configurable via `PORT`)

### How to run (local dev)

From the repo root:

- Run both apps together:
  - `npm run dev:monorepo`
- Run frontend only:
  - `npm run dev:frontend`
- Run backend only:
  - `npm run dev:backend`

### Backend health check

Once `backend` is running:

- `GET http://localhost:4000/health` → `{ "ok": true }`

### Frontend → backend configuration (dev)

Option A (recommended): **Vite dev proxy**

- `frontend/vite.config.ts` proxies `/api/*` → `http://localhost:4000`
- In code, call your API as `/api/...` during development

Option B: environment-based base URL

Set the backend base URL via environment:

- Copy `frontend/.env.example` → `frontend/.env.local`
- Update `VITE_API_BASE_URL` as needed


