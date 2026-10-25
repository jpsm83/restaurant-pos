# Backend — Restaurant POS API

Fastify + Mongoose REST API for the restaurant/bar management system. It owns all
business logic and persistence; the `frontend` workspace is a pure consumer of
these endpoints.

## How the three workspaces fit together

This repo is one npm workspace rooted at `/` — `backend/`, `frontend/`, and
`packages/` (`restaurant-pos-packages`). Install once at the root
(`npm install`); there is a single `package-lock.json`.

```
frontend (:5173) --/api proxy--> backend (:4000) --> MongoDB Atlas
         \                              /
          \_ restaurant-pos-packages __/
          enums · interfaces · zod schemas
```

- Both apps import shared contracts from `restaurant-pos-packages` **by package
  name** (never a relative `../packages` path); the workspace symlink resolves
  them.
- The shared **zod schemas are the request contract**: backend routes validate
  with them and frontend forms validate the same fields — one definition.
- In dev the frontend calls same-origin `/api`; Vite proxies it to the backend
  (`:4000`), so there is no CORS and the refresh cookie stays same-origin.
- Both load the **same root `.env`**; Docker Compose runs both services from one
  root `Dockerfile` against the same Atlas database.
- Ports: backend `4000`, frontend `5173`; there is no database container.

## Tech stack

| Concern | Choice |
|---------|--------|
| Runtime | Node.js 26 (see root `.nvmrc`) |
| Language | TypeScript (strict, ESM, `.ts` imports via `tsx`) |
| HTTP framework | Fastify 5 |
| Validation / serialization | Zod 4 through `@fastify/type-provider-zod` |
| Database | MongoDB Atlas via Mongoose 9 |
| Auth | JWT access token + refresh cookie (`@fastify/jwt`, `@fastify/cookie`), bcrypt |
| Realtime | WebSockets (`@fastify/websocket`) for live in-app notifications |
| Files | `@fastify/multipart` + Cloudinary |
| Email | Nodemailer. Account one-time links and the sign-in email-change notice use the SMTP rail. |
| Tests | Vitest + `mongodb-memory-server` (in-memory replica set) |
| Shared contracts | `restaurant-pos-packages` (enums, interfaces, zod schemas) |

## Ports

| Value | Default | Source |
|-------|---------|--------|
| Backend HTTP | `4000` | `PORT` |
| Bind host | `0.0.0.0` | `HOST` |
| Health check | `GET /health` → `{ "ok": true }` | — |
| API prefix | `/api/v1` | `src/routes/v1/index.ts` |

## How to run

Install once at the **repo root** (npm workspace): `npm install`.

### Local (two terminals)

```sh
npm run dev --workspace backend     # tsx watch, reloads on change
```

The server loads the root `.env` (resolved as `../../.env` from `src/server.ts`),
connects to Atlas, and listens on `http://localhost:4000`.

### Docker

A dev-only stack runs the backend (and frontend) against the **same Atlas
database** — there is no database container. Both services build from the root
`Dockerfile`.

```sh
docker compose up          # build (first run) and start
docker compose up --build  # rebuild after dependency/Dockerfile changes
docker compose down        # stop and remove
```

Repo root is bind-mounted for hot reload; the root `.env` is read at runtime.
See [ADR-0002](../docs/adr/0002-dev-only-docker-against-atlas.md).

## Environment

All variables live in the **root `.env`** (never commit secrets; no `.env` is
baked into images). Key groups:

- **Core**: `NODE_ENV`, `PORT`, `HOST`
- **Database (required)**: `MONGODB_URI` (Atlas)
- **Auth (required)**: `JWT_SECRET`, `REFRESH_SECRET` (dev fallbacks exist)
- **CORS**: `CORS_ORIGINS` (comma-separated browser origins)
- **Cloudinary (required for uploads)**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **Email**: `SMTP_*` for the delivery rail, including account one-time links and the sign-in email-change notice. `EMAIL_USER` and `EMAIL_PASSWORD` remain on the unused Gmail sender. `COMMUNICATIONS_EMAIL_ENABLED=false` skips operational email and does not stop account mail.
- **Communications toggles**: `COMMUNICATIONS_EMAIL_ENABLED`, `COMMUNICATIONS_INAPP_ENABLED`, `COMMUNICATIONS_INAPP_LIVE_ENABLED`
- **Frontend link targets**: `APP_BASE_URL` / `PUBLIC_APP_URL` / `FRONTEND_URL`, `BASE_URL`

`src/server.ts` fails fast if `JWT_SECRET` or `REFRESH_SECRET` is missing.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev --workspace backend` | Watch-mode dev server (`tsx watch`) |
| `npm run start --workspace backend` | Run once without watch |
| `npm run seed:dummy --workspace backend` | Wipe DB and import `dummyData/*.json` |
| `npm run typecheck --workspace backend` | `tsc --noEmit` |
| `npm run test --workspace backend` | Run all Vitest tests |
| `npm run test:watch --workspace backend` | Vitest watch mode |
| `npm run test:coverage --workspace backend` | Vitest with V8 coverage |
| `npm run test:routes --workspace backend` | Run only `tests/routes` |

Tests boot `buildApp({ skipDb: true })` and use a `MongoMemoryReplSet`, so they
never touch Atlas. Run them from `backend/` (or via root `npm test`).

## Architecture

```
src/
├── server.ts            # buildApp(): plugins, zod compilers, error handler, routes, DB, listen
├── routes/v1/           # one Fastify plugin per resource, mounted under /api/v1
├── models/              # Mongoose schemas (23: business, user, employee, order, ...)
├── auth/                # JWT session issue/refresh, email confirmation, password reset
├── errors/              # AppError helpers + RFC 9457 application/problem+json handler
├── communications/      # notifications: channels, providers, dispatch, live WS bridge
├── orders/              # order lifecycle (create, close, cancel, transfer, billing)
├── db/connectDb.ts      # idempotent mongoose connection (dbName: "pos")
├── config/cors.ts       # CORS origin policy
└── <domain>/            # business logic per domain (inventories, salesInstances, purchases, ...)
```

Conventions:

- **Zod is the single boundary validator.** Route bodies use strict DTO schemas
  from `restaurant-pos-packages/schemas/*`; the same schemas compile to Fastify
  validators and serializers.
- **Errors are `AppError`s** thrown from handlers; the global handler serializes
  them as RFC 9457 problem details.
- **Shared contracts** are imported by package name
  (`restaurant-pos-packages/schemas/auth`), never by relative `../packages`
  paths — resolved through the workspace symlink.
- **Domain modules** (`orders/`, `inventories/`, ...) hold business logic;
  routes stay thin.

### API resources

Mounted under `/api/v1`: `auth`, `business`, `businessGoods`, `orders`,
`salesInstances`, `salesPoints`, `suppliers`, `supplierGoods`, `inventories`,
`purchases`, `employees`, `schedules`, `users`, `promotions`,
`dailySalesReports`, `reservations`, `ratings`, `notifications` (REST + live
WS), `printers`, `weeklyBusinessReport`, `monthlyBusinessReport`.

## Dummy data

`dummyData/` holds one JSON array per collection (EJSON format). `seed:dummy`
clears all collections (reverse dependency order) then upserts by `_id` with
model validation on. Use it to reset a dev database.

## More

- Workspace layout and cross-workspace commands: [`docs/engineering/workspace.md`](../docs/engineering/workspace.md)
- Domain vocabulary: [`GLOSSARY.md`](../GLOSSARY.md)
- Architecture decisions: [`docs/adr/`](../docs/adr/)
