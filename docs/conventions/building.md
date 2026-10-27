# Building (writing code)

Use the latest stable syntax and best practices for the stack; prefer the framework's built-in solution over a custom one.

## Stack

- **Backend** (`backend/`): Fastify + Mongoose + Zod, TypeScript.
- **Frontend** (`frontend/`): React 19 + Vite, React Router, TanStack Query, React Hook Form + Zod, shadcn/ui + Tailwind, i18next.
- **Shared** (`packages/`): interfaces, enums, schemas.

## Workspace

- One `npm install` at the repo root installs all workspaces; root `npm run test|typecheck|build|lint` run each workspace's matching script, and `--workspace <name>` targets one project. See [workspace.md](../engineering/workspace.md).

## How to build

- **Thin backend HTTP layer.** Routes validate at the boundary, call domain logic, and return a response; business logic lives in the domain modules, persistence in the models.
- **Validate once, at the boundary, with zod.** Request schemas are strict DTOs limited to client-settable fields; infer types from them.
- **Shared request schemas live in `packages/schemas/`** (frontend-reusable, no Node/Mongoose imports); backend-only ones in `backend/src/schemas/`.
- **Errors** flow through one global handler as RFC 9457 `application/problem+json`; never hand-build an error body.
- **Frontend is declarative** — compose from props, state, hooks, and derived data; follow existing routing, data-fetching, form, and i18n conventions; reuse shared schemas in forms.
- **TypeScript**: strong typing, avoid `any`.
- **UI**: reuse existing shadcn/ui primitives; use `Skeleton` for loading placeholders; follow [styling.md](./styling.md) for tokens, shadcn customisation, and themes.
- **User-facing copy**: no hardcoded first-party strings; follow [i18n.md](./i18n.md) for locale files, namespaces, formatting, and system-email language.
- **Comments**: brief file headers, section headings, and notes on non-obvious rules — skip the obvious.
- **Design for all clients**: `/api/v1` must work for clients without a browser.
