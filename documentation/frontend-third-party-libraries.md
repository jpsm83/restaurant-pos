# Frontend third-party libraries

This document explains **how the Restaurant POS web app (`frontend/`) relies on external npm packages**, where each major concern lives in the stack, and **conventions for adding or extending** that stack. It complements [`context.md`](./context.md) (product bridge) and feature-specific docs such as [`frontend-i18n.md`](./frontend-i18n.md) and [`frontend-authentication-and-navigation.md`](./frontend-authentication-and-navigation.md).

**Source of truth for versions:** `frontend/package.json` (and the lockfile). Prefer **pinning compatible ranges** (`^`) and running **`npm install`** from `frontend/` when adding dependencies.

---

## 1. Why this document exists

- **Onboarding:** New contributors see which libraries own routing, server state, forms, styling, and i18n without spelunking every import.
- **Consistency:** When we add UI or behavior, we reuse the same families of tools (for example, **React Hook Form + Zod** for forms) instead of introducing parallel patterns.
- **Change control:** Larger or security-sensitive additions (auth helpers, HTTP clients, date/math) should be **named here** when they become part of the standard stack.

---

## 2. Layered overview

| Layer | Libraries (representative) | Role in this repo |
|-------|---------------------------|-------------------|
| **Runtime** | `react`, `react-dom` | UI and concurrent rendering (React 19). |
| **Routing** | `react-router-dom` | URL-driven layouts, lazy routes, `Navigate` redirects. |
| **Server / async state** | `@tanstack/react-query` | Queries and mutations (caching, keys in `frontend/src/services/queryKeys.ts`, busy-time defaults in `frontend/src/services/queryClient.ts`). |
| **HTTP** | `axios` | Authenticated API calls via `frontend/src/services/http.ts` (Bearer from auth module). |
| **Auth (browser)** | `fetch` in `frontend/src/auth/api.ts` | Login, signup, refresh, `me`, logout; cookies + token; see [`authentication-and-session.md`](./authentication-and-session.md). |
| **Forms + validation** | `react-hook-form`, `zod`, `@hookform/resolvers` | All **interactive forms** use RHF for state and Zod for schema validation; see **section 3**. |
| **UI primitives** | `radix-ui` / `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge` | Accessible primitives and **shadcn-style** components under `frontend/src/components/ui/`. |
| **Styling** | `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css` | Utility-first layout and motion tokens. |
| **i18n** | `i18next`, `react-i18next` | Namespaces, `useTranslation`, parity checks; see [`frontend-i18n.md`](./frontend-i18n.md). |
| **Dates** | `date-fns`, `react-day-picker` | Formatting and calendar UI where used. |
| **Tables / export** | `@tanstack/react-table`, `exceljs` | Data tables and spreadsheet export in business dashboards. |
| **Notifications** | `sonner` | Toasts / non-blocking feedback where wired. |
| **OAuth (optional)** | `@react-oauth/google` | Google sign-in integration when enabled in app config. |
| **Icons / assets** | `lucide-react`, `country-flag-icons` | Icons and language switcher flags. |
| **Maps / geocoding** | `leaflet`, `react-leaflet`, `leaflet-control-geocoder` | Tenant **address** settings: OSM tiles + Nominatim geocode for the location preview (**`BusinessAddressLocationMap`**). Types: `@types/leaflet`. |

Auth **password rules** for **setting** passwords are shared with the monorepo via `@packages/utils/passwordPolicy.ts`; Zod schemas in the frontend should stay aligned with that helper (see below).

---

## 3. Forms: React Hook Form + Zod (standard)

**Rule:** User-facing **forms** (multi-field `submit`, validation, error display) should be built with:

1. **`useForm`** from `react-hook-form`.
2. **`zodResolver`** from `@hookform/resolvers/zod` wired to a **Zod schema**.
3. **`register`** for native inputs and shadcn **`Input`**; **`Controller`** when the control is not register-friendly (for example, a raw **`<select>`**).
4. **`Label`** + **`Input`** (and **`Button`**, **`Alert`**, etc.) from `frontend/src/components/ui/`. For repeated one-line field errors, use the small **`FieldError`** helper in `frontend/src/components/forms/FieldError.tsx`.

**Schemas:** Define the Zod schema **next to the screen or component** that owns the form (for example, a `buildLoginSchema(t("…"))` factory in `LoginPage.tsx`). Use **`useMemo`** when the schema depends on **`t`**. Avoid a shared “god” schema module unless several screens truly share the **same** shape and rules.

**Server or auth errors** that are not field-level validation (failed login, session expired banner, mutation failures) may still use **local state** plus **`Alert`**, alongside **`formState.errors`** / **`FieldError`** for client-side field errors.

**Password policy:** Use `isValidPassword` from `@packages/utils/passwordPolicy.ts` inside Zod **refinements** on signup / business registration so client rules match backend expectations.

---

## 4. Adding or upgrading a dependency

1. **Prefer existing stack:** Check sections 2–3 before introducing a second form library, a second HTTP client for the same surface, or ad hoc validation.
2. **Install from `frontend/`:** `npm install <package>` (or `npm install -D` for build/test-only tools).
3. **Verify:** `npm run build` and `npm run test` (and `npm run lint` if you touch ESLint-affected areas).
4. **Document:** For **cross-cutting** or **non-obvious** packages, add a row or bullet in **section 2** or **3** of this file and, if relevant, link from [`context.md`](./context.md) companion table.

**Maps stack (address preview):** Geocoding runs in the browser through **`leaflet-control-geocoder`**’s Nominatim integration; do not hammer the public endpoint. For production-scale traffic, plan a **self-hosted Nominatim** or another geocoder with proper licensing and quotas. Behavior (immediate first geocode, **3s** debounce on later edits, query field rules) is documented under **Shared physical address** in [`context.md`](./context.md).

---

## 4.1 TanStack baseline defaults (high-load policy)

Project baseline defaults live in `frontend/src/services/queryClient.ts` and should be treated as the standard unless a feature has a clear reason to override:

- `staleTime`: `60_000` (1 minute)
- `gcTime`: `600_000` (10 minutes)
- `refetchOnWindowFocus`: `false` (prevents focus storms in busy operations)
- `refetchOnReconnect`: `true`
- status-aware retries (network/`408`/`429`/`5xx` only)
- bounded retries with exponential backoff
- `throwOnError: false` by default (screen-level explicit handling preferred)

When adding new hooks, prefer these defaults and override intentionally at hook level only when product behavior requires it.

---

## 4.2 Request shaping rules (busy-time)

For high-frequency screens, apply these defaults before introducing custom patterns:

- use one primary entity query per screen whenever possible (avoid unbounded `useQueries` fan-out)
- wire query cancellation through the `signal` provided by TanStack query functions
- prevent duplicate writes for the same entity (single-flight or explicit submit lock)
- include operation identifiers (`X-Idempotency-Key`, `X-Correlation-Id`) on critical mutations where backend side effects may be dispatched
- debounce user-driven filter/search requests before triggering network calls

Keep these rules in service hooks so behavior stays consistent across pages.

---

## 4.3 Profile fetch/save diagnostics (busy-time baseline)

For **business profile** fetch/save operations (split settings pages that share **`useBusinessProfileQuery`** / **`useUpdateBusinessProfileMutation`**, e.g. **`BusinessProfileSettingsPage`** at **`/settings/profile`**, **`BusinessCredentialsSettingsPage`** at **`/settings/credentials`**, **`BusinessAddressSettingsPage`** at **`/settings/address`**; HTTP + logs live in **`frontend/src/services/business/businessProfileApi.ts`**, re-exported from the **`businessService`** barrel), keep diagnostics lightweight and structured:

- emit one structured log object per request outcome with:
  - `scope` (`services.businessProfile`)
  - `action` (`fetch` or `save`)
  - `stage` (`success`, `error`, `coalesced`)
  - `businessId`
  - `durationMs` (for success/error)
  - `status` (for error)
  - `operationId` (for save)
- classify save failures by HTTP status (`400`, `401`, `403`, `409`, `5xx`) to speed up triage routing
- keep operation identifiers aligned (`X-Idempotency-Key` == `X-Correlation-Id`) so backend dispatch logs and side effects can be traced to one logical save
- rely on query/mutation retries from `queryClient.ts`; failed attempts and retry outcomes are visible through repeated `error/success` diagnostics events with measured latency

### Busy-time triage runbook (first checks)

1. Inspect frontend diagnostics for latest `services.businessProfile` error events and confirm status-class pattern (`4xx` validation/auth vs `5xx` transient).
2. Correlate by `operationId` / `X-Idempotency-Key` in backend logs with `communications.dispatch` entries for **`BUSINESS_PROFILE_UPDATED`** to verify one logical save maps to one side-effect dispatch (manager in-app + email when enabled).
3. Check retry behavior and latency trend:
   - repeated short failures with `5xx/429` usually indicates transient load pressure
   - increasing `durationMs` with eventual success suggests saturation before recovery
4. If coalesced saves are high, confirm UI is not dispatching redundant submit intents (single-flight should still keep one active PATCH per business).

---

## 5. Related documentation

| Document | Relevance |
|----------|-----------|
| [`frontend-authentication-and-navigation.md`](./frontend-authentication-and-navigation.md) | Auth routes; where login, signup, and business register live. |
| [`frontend-i18n.md`](./frontend-i18n.md) | Translating validation and labels used in Zod factories. |
| [`advanced-table-usage.md`](./advanced-table-usage.md) | TanStack Table patterns in dashboards. |
| [`authentication-and-session.md`](./authentication-and-session.md) | Backend contracts for auth (not npm-specific, but pairs with auth client code). |
| [`../frontend/src/services/business/README.md`](../frontend/src/services/business/README.md) | Tenant **business profile/register** frontend services (multipart PATCH, React Query, mappers); pairs with **§4.3** diagnostics. |

When the **standard form stack** or a **major dependency category** changes, update **this file** and the **companion row** in [`context.md`](./context.md).
