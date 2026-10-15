# Building (writing code)

Use the latest stable syntax and best practices for the stack; prefer the framework's built-in solution over a custom one.

## Stack

- **Backend** (`backend/`): Fastify + Mongoose + Zod, TypeScript.
- **Product app** (`apps/web`): React 19 + **React Router v7 framework mode** (Vite), TanStack Query, React Hook Form + Zod, shadcn/ui + Tailwind, i18next.
- **Superadmin** (`apps/admin`): React 19, its own build and auth realm.
- **Shared** (`packages/`): `domain` (enums, interfaces, schemas), `ui`, `api-client`, `auth`, `config`.

## Frontend architecture

See ADR-0004 (surfaces) and ADR-0005 (API contract and multi-client auth).

- **Two apps, split by trust realm.** `apps/web` serves the **Business** (`/business`) and **Customer** (`/client`) surfaces; `apps/admin` is the Superadmin console. Device is a **layout** concern, never an app boundary — the POS is tablet-first and responsive, not a separate app.
- **Surfaces do not import each other.** Code under `surfaces/business/**` and `surfaces/client/**` stays inside its surface; shared code lives in `shared/**` and `packages/*`. Enforced by lint import rules.
- **Rendering per route.** `/client` and marketing routes are server-rendered or prerendered with per-route `meta()`/`links()`; `/business` and POS routes are client-rendered.
- **The app never becomes a backend.** All writes go through `/api/v1`; the SSR server is a thin render layer, never a data layer.

## Workspace

- One `npm install` at the repo root installs all workspaces; root `npm run test|typecheck|build|lint` run each workspace's matching script, and `--workspace <name>` targets one project. See [workspace.md](../engineering/workspace.md).
- Layout is `backend/` + `apps/*` + `packages/*`.

## How to build

- **Thin backend HTTP layer.** Routes validate at the boundary, call domain logic, and return a response; business logic lives in the domain modules, persistence in the models.
- **Validate once, at the boundary, with zod.** Request schemas are strict DTOs limited to client-settable fields; infer types from them.
- **Shared request schemas live in `packages/schemas/`** (frontend-reusable, no Node/Mongoose imports); backend-only ones in `backend/src/schemas/`.
- **Errors** flow through one global handler as RFC 9457 `application/problem+json`; never hand-build an error body.
- **Frontend is declarative** — compose from props, state, hooks, and derived data; follow existing routing, data-fetching, form, and i18n conventions; reuse shared schemas in forms.
- **TypeScript**: strong typing, avoid `any`.
- **UI**: reuse existing shadcn/ui primitives; use `Skeleton` for loading placeholders.
- **Comments**: brief file headers, section headings, and notes on non-obvious rules — skip the obvious.
- **Design for all clients**: `/api/v1` is the contract for every client — web, admin, and native — and must work for clients without a browser (ADR-0005). Web uses a cookie session; native uses a bearer token.
