# restaurant-pos-packages — shared contracts

The single source of truth for the domain vocabulary the `backend` and
`frontend` workspaces both depend on: enums, TypeScript interfaces, zod schemas,
and pure utils. It ships **raw TypeScript** (no build step) and is consumed by
package name.

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

## What's here

| Path | Exports | Purpose |
|------|---------|---------|
| `enums.ts` | `mainCategoriesEnums`, `paymentMethodsEnums`, `userRolesEnums`, `orderStatusEnums`, ... | Domain value lists (as `string[]`) |
| `featureFlags.ts` | `FEATURE_FLAG_CATALOGUE`, `FEATURE_FLAG_STATES`, `resolveFeatureFlag`, `isFeatureFlagOn`, types | Closed stage-1 flag catalogue and pure effective-flag resolver |
| `operationalReasons.ts` | `OPERATIONAL_REASON_ACTS`, `OPERATIONAL_REASON_CATALOGUES`, `resolveOperationalReason`, types | Closed platform-defined reason catalogues and their selection resolver |
| `interfaces/` | `IUser`, `IBusiness`, `IOrder`, `IEmployee`, ... | Mongoose-shaped TypeScript interfaces (`I*.ts`) |
| `schemas/` | zod DTOs + primitives | Request/response and form validation |
| `utils/` | `passwordPolicy`, `emailRegex`, `timezoneData`, `timezoneFromAddress`, `sentryScrubbing` | Pure helpers shared by both sides |

## Package format

- **Name:** `restaurant-pos-packages`, `"type": "module"`, private, versioned in
  the workspace.
- **No build / no `dist`.** Files are plain `.ts` shipped as-is and resolved
  through the workspace symlink via the `exports` map:

  | Import specifier | Resolves to |
  |------------------|-------------|
  | `restaurant-pos-packages/enums` | `enums.ts` |
  | `restaurant-pos-packages/featureFlags` | `featureFlags.ts` |
  | `restaurant-pos-packages/operationalReasons` | `operationalReasons.ts` |
  | `restaurant-pos-packages/interfaces/*` | `interfaces/*.ts` |
  | `restaurant-pos-packages/schemas` | `schemas/index.ts` (barrel) |
  | `restaurant-pos-packages/schemas/primitives` | `schemas/primitives.ts` |
  | `restaurant-pos-packages/schemas/*` | `schemas/*.ts` |
  | `restaurant-pos-packages/utils/*` | `utils/*.ts` |

- **Import by package name, never by relative path** (no `../packages`, no
  `@packages/*` alias). Vite transpiles it for the browser; `tsx` transpiles it
  for the backend.

## Dependencies

- `zod` is the only **runtime** dependency.
- `mongoose` and `vitest` are **devDependencies**. Mongoose is used only for
  `Types.ObjectId` **types** in `interfaces/`, so it never enters the frontend
  bundle. Keep backend-only libraries out of runtime deps.

## Design rules

- **Zod is the boundary.** All schemas are strict objects (`z.strictObject`), so
  unknown keys are rejected. Server-owned fields (tokens, `emailVerified`,
  `refreshSessionVersion`) never appear in a client DTO.
- **Sanitize at the boundary.** `schemas/primitives.ts` provides
  `trimmedString`, `sanitizedString` (strips control chars + HTML),
  `freeTextString`, `emailSchema`, `objectIdSchema`, calendar date/month
  schemas, multipart coercers (`coercedNumber/Int/Boolean`, `jsonField`), and
  timezone validation. Prefer these over ad-hoc validators.
- **Primitives stay Node/Mongoose-free** so the frontend can reuse them for form
  validation unchanged.
- **Feature flags are closed product data and pure resolution.**
  `featureFlags.ts` owns the thirteen stage-1 flags (each defaulting `on`), the
  `on`/`off` state type, the optional platform-wide/per-Owner scope shape, and
  the effective-flag resolver plus boolean helper. Unset means on; platform
  `off` beats per-Owner `on`; an invalid key or state throws. There is no
  database collection, seed, migration, HTTP route, client DTO, console, audit
  entry, notification, plan/layer composition, or per-venue/per-user scope; a
  product amendment changes the module.
- **Operational reasons are closed product data.** `operationalReasons.ts` owns
  the seven catalogues and the one selection resolver. There is no database
  collection, seed, migration, editor, or HTTP CRUD route; a product amendment
  changes the module.
- **Telemetry scrubbing is pure and shared.** `utils/sentryScrubbing.ts`
  recursively replaces sensitive values, strips URL userinfo and query strings,
  bounds depth and cycles, and never mutates its input. It is the single seam
  both Sentry surfaces are designed to apply to a final event before send; its
  tests live in `backend/tests/utils/sentryScrubbing.test.ts`.
- **Names follow the domain:** `IPascalCase.ts` interfaces, `camelCase.ts`
  schemas; `schemas/index.ts` re-exports everything.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm test --workspace restaurant-pos-packages` | `vitest run --passWithNoTests` (no local tests) |

This package has **no tests of its own**. Its shared modules are exercised from
the backend workspace:

- `backend/tests/schemas/*.test.ts` — schema behavior (validation, sanitization,
  multipart).
- `backend/tests/schemas/*Parity.test.ts` — parity between every DTO and its
  Mongoose model (client-settable fields exist on the model; server-owned fields
  stay out of DTOs).
- `backend/tests/utils/*.test.ts` — pure shared utils, including telemetry
  scrubbing.

Run them with `npm test --workspace backend` or root `npm test` (all
workspaces).

## Using it

```ts
import { orderStatusEnums } from "restaurant-pos-packages/enums";
import type { IOrder } from "restaurant-pos-packages/interfaces/IOrder";
import { loginBodySchema } from "restaurant-pos-packages/schemas/auth";
```

For more context see [`docs/engineering/workspace.md`](../docs/engineering/workspace.md)
and the [`GLOSSARY.md`](../GLOSSARY.md).
