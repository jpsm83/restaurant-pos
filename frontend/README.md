# Frontend — Restaurant POS SPA

React 19 + Vite single-page app. It renders the public marketing pages and the
three authenticated shells (business, employee, customer) and talks to the
`backend` API. There is no server-side rendering.

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
| Runtime / language | React 19 + TypeScript (strict, ESM) |
| Build / dev server | Vite 8 |
| Routing | React Router 7 (`src/appRoutes.tsx`) |
| Server state | TanStack Query 5 (`src/services/queryClient.ts`) |
| HTTP | Axios instance with Bearer + cookie interceptors (`src/services/http.ts`) |
| Forms | React Hook Form + `@hookform/resolvers` (zod) |
| Styling | Tailwind CSS 4 + shadcn/ui (`radix-nova`, lucide icons) |
| Tables | TanStack Table 9 (`src/features/advancedTable`) |
| i18n | i18next + react-i18next (`en`, `es`) |
| Maps | Leaflet / react-leaflet |
| Toasts | Sonner |
| Tests | Vitest + Testing Library (jsdom) |
| Shared contracts | `restaurant-pos-packages` (interfaces, zod schemas) |

## Ports

| Value | Default | Source |
|-------|---------|--------|
| Vite dev server | `5173` | `vite.config.ts` |
| API proxy | `/api` → `http://localhost:4000` | `VITE_PROXY_API_TARGET` |
| Direct API base | empty in dev (use proxy) | `VITE_API_BASE_URL` |

In dev the browser calls same-origin `/api/...`; Vite proxies it to the backend,
so CORS and the refresh cookie stay same-origin.

## How to run

Install once at the **repo root** (npm workspace): `npm install`.

### Local

```sh
npm run dev --workspace backend     # API on :4000 (terminal 1)
npm run dev --workspace frontend    # SPA on :5173 (terminal 2)
```

Open `http://localhost:5173`. The backend must be running for API-backed pages.

### Docker

The dev-only compose stack runs both services against the same Atlas database.

```sh
docker compose up          # build (first run) and start
docker compose up --build  # rebuild after dependency/Dockerfile changes
docker compose down        # stop and remove
```

Frontend is published on `5173`; `VITE_PROXY_API_TARGET` is overridden to
`http://backend:4000` via the compose network. See
[ADR-0002](../docs/adr/0002-dev-only-docker-against-atlas.md).

## Environment

Vite loads env from the **repo root** (`envDir: ".."`), so all variables live in
the root `.env`:

- `VITE_API_BASE_URL` — API base; leave empty in dev to use the proxy.
- `VITE_PROXY_API_TARGET` — dev proxy target (default `http://localhost:4000`).

Only `VITE_`-prefixed variables are exposed to client code.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev --workspace frontend` | Vite dev server with HMR |
| `npm run build --workspace frontend` | `tsc -b` then `vite build` → `dist/` |
| `npm run preview --workspace frontend` | Serve the production build locally |
| `npm run typecheck --workspace frontend` | `tsc -b` (project references) |
| `npm run lint --workspace frontend` | ESLint |
| `npm run test --workspace frontend` | Vitest run (jsdom) |

## Architecture

```
src/
├── main.tsx             # Providers: QueryClient → AuthProvider → ErrorBoundary → BrowserRouter
├── App.tsx              # High-level app map
├── appRoutes.tsx        # Route tree; shells + guards; all pages lazy-loaded
├── routes/              # AuthRouteGuards, canonicalPaths (dashboard-first URLs)
├── layouts/             # PublicLayout, BusinessLayout, EmployeeLayout, CustomerLayout, RecoveryLayout
├── pages/               # Route screens (business/, customer/, employee/, marketing/)
├── components/          # Shared UI (Navbar, ActorSidebar, ErrorBoundary, components/ui shadcn)
├── features/            # Self-contained features (advancedTable)
├── services/            # http (axios), queryClient, queryKeys, per-domain services
├── auth/                # api (token singleton), AuthContext store, redirects, types
├── i18n/                # i18next setup + locales/en, locales/es
└── test/                # Vitest setup (jest-dom, jsdom polyfills) + i18n test utils
```

Conventions:

- **Path alias `@/` → `src/`** everywhere.
- **Server state via React Query.** UI uses query/mutation hooks that wrap async
  functions calling the `http` axios instance. `queryClient` is provided
  *outside* `AuthProvider` so cached data survives auth transitions.
- **Auth:** the access token lives in the `auth/api.ts` module singleton (not
  Context); `http` reads it per request. The refresh token is an HttpOnly cookie
  sent with `withCredentials: true`. `AuthProvider` exposes session state.
- **Routing:** three authenticated actor shells under `/:userId/customer`,
  `/:userId/employee`, `/business/:businessId`. Guards live in
  `routes/AuthRouteGuards.tsx`. Pages are `React.lazy`-loaded behind a Suspense
  shell; unknown URLs render `NotFoundPage`.
- **UI primitives** are shadcn/ui components generated with the `radix-nova`
  style (`components.json`), aliased to `@/components/ui`.

## Testing

Vitest runs in a `jsdom` environment with `src/test/setup.ts` (jest-dom matchers
plus Radix-required DOM polyfills). Tests live in `__tests__/` next to the code
they cover. Auth tests use `MemoryRouter` with the exported `AppRoutes`.
