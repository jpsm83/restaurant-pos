# domain — shared contracts

The single source of truth for the domain vocabulary the `backend` and
`frontend` workspaces both depend on: enums, TypeScript interfaces, zod schemas,
and pure utils. It ships **raw TypeScript** (no build step) and is consumed by
package name.

## How the three workspaces fit together

This repo is one npm workspace rooted at `/` — `backend/`, `frontend/`, and
`packages/` (`domain`, `ui`, and `config`). Install once at the root
(`npm install`); there is a single `package-lock.json`.

```
frontend (:5173) --/api proxy--> backend (:4000) --> MongoDB Atlas
         \                              /
          \__________ domain __________/
          enums · interfaces · zod schemas
```

- Both apps import shared contracts from `domain` **by package
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
| `interfaces/` | `IUser`, `IBusiness`, `IOrder`, `IEmployee`, ... | Mongoose-shaped TypeScript interfaces (`I*.ts`) |
| `schemas/` | zod DTOs + primitives | Request/response and form validation |
| `utils/` | `passwordPolicy`, `emailRegex`, `timezoneData`, `timezoneFromAddress` | Pure helpers shared by both sides |

## Package format

- **Name:** `domain`, `"type": "module"`, private, versioned in
  the workspace.
- **No build / no `dist`.** Files are plain `.ts` shipped as-is and resolved
  through the workspace symlink via the `exports` map:

  | Import specifier | Resolves to |
  |------------------|-------------|
  | `domain/enums` | `enums.ts` |
  | `domain/interfaces/*` | `interfaces/*.ts` |
  | `domain/schemas` | `schemas/index.ts` (barrel) |
  | `domain/schemas/primitives` | `schemas/primitives.ts` |
  | `domain/schemas/*` | `schemas/*.ts` |
  | `domain/utils/*` | `utils/*.ts` |

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
- **Names follow the domain:** `IPascalCase.ts` interfaces, `camelCase.ts`
  schemas; `schemas/index.ts` re-exports everything.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm test --workspace domain` | `vitest run --passWithNoTests` (no local tests) |

This package has **no tests of its own**. Its schemas are exercised from the
backend workspace:

- `backend/tests/schemas/*.test.ts` — schema behavior (validation, sanitization,
  multipart).
- `backend/tests/schemas/*Parity.test.ts` — parity between every DTO and its
  Mongoose model (client-settable fields exist on the model; server-owned fields
  stay out of DTOs).

Run them with `npm test --workspace backend` or root `npm test` (all
workspaces).

## Using it

```ts
import { orderStatusEnums } from "domain/enums";
import type { IOrder } from "domain/interfaces/IOrder";
import { loginBodySchema } from "domain/schemas/auth";
```

For more context see [`docs/engineering/workspace.md`](../../docs/engineering/workspace.md)
and the [`GLOSSARY.md`](../../GLOSSARY.md).
