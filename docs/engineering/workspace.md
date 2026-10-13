# Workspace (monorepo layout)

The repo is a single npm workspace rooted at `/`. There is **one install and one
`package-lock.json`** at the root; the three projects below are workspace
members, not independent npm projects.

## Layout

| Path | Workspace name | What it is |
|------|----------------|------------|
| `backend/` | `backend` | Fastify + Mongoose API (`npm run dev` → :4000). |
| `frontend/` | `frontend` | React 19 + Vite SPA (`npm run dev` → :5173). |
| `packages/` | `restaurant-pos-packages` | Shared enums, interfaces, zod schemas, utils. |

`backend` and `frontend` depend on `restaurant-pos-packages` **by package name**
(`import ... from "restaurant-pos-packages/schemas/..."`), resolved through the
workspace symlink in `node_modules/` — not by relative `../packages` paths or
hand-maintained `@packages/*` aliases. The shared package is ESM and keeps
backend-only libraries (`mongoose`) out of its runtime dependencies so the
frontend bundle never pulls the database driver.

## Install

```sh
npm install        # at the repo root; installs all three workspaces
```

## Run locally (two terminals)

```sh
npm run dev --workspace backend     # API on :4000
npm run dev --workspace frontend    # SPA on :5173 (proxies /api to :4000)
```

## Run with Docker

A dev-only Docker stack runs both services against the **same Atlas database**
the local workflow uses. The two-terminal commands above keep working
unchanged.

```sh
docker compose up          # build (first run) and start both services
docker compose up --build  # rebuild images after Dockerfile/dependency changes
docker compose down        # stop and remove the containers
```

Both services build from the root `Dockerfile` (Node 26, the version pinned in
`.nvmrc` and `engines.node`). With the stack up:

| Service | URL |
|---------|-----|
| Backend | http://localhost:4000 |
| Frontend | http://localhost:5173 (proxies `/api` to the backend service) |

Confirm the stack is up:

```sh
curl http://localhost:4000/health   # {"ok": true}
```

The backend log line `Database connected` confirms it reached Atlas:

```sh
docker compose logs backend
```

The repo root is bind-mounted, so source edits hot-reload in the running
containers, and the root `.env` is read at runtime. There is no database
service. See [ADR-0002](../adr/0002-dev-only-docker-against-atlas.md) for why.

## Test, typecheck, build, lint

Root scripts run the matching script in every workspace that defines it
(`--workspaces --if-present`):

```sh
npm test           # backend, frontend, restaurant-pos-packages
npm run typecheck  # backend, frontend
npm run build      # frontend
npm run lint       # frontend
```

Scope one workspace by appending `--workspace <name>`:

```sh
npm test --workspace backend
npm run build --workspace frontend
```

`restaurant-pos-packages` has no tests of its own; its `test` script runs the
workspace test runner with `--passWithNoTests`, so a root `npm test` does not
fail on it. Shared schemas are covered from `backend/tests/schemas/`.
