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

## Run

```sh
npm run dev --workspace backend     # API on :4000
npm run dev --workspace frontend    # SPA on :5173 (proxies /api to :4000)
```

## Test, typecheck, build, lint

Root scripts fan out across every workspace (`--workspaces --if-present`):

```sh
npm test           # all workspaces
npm run typecheck  # all workspaces
npm run build      # all workspaces
npm run lint       # all workspaces
```

Scope one workspace by appending `--workspace <name>`:

```sh
npm test --workspace backend
npm run build --workspace frontend
```

`restaurant-pos-packages` has no tests of its own; its `test` script runs the
workspace test runner with `--passWithNoTests`, so a root `npm test` does not
fail on it. Shared schemas are covered from `backend/tests/schemas/`.
