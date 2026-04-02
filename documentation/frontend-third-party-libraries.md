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
| **Server / async state** | `@tanstack/react-query` | Queries and mutations (caching, keys in `frontend/src/services/queryKeys.ts`). |
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

---

## 5. Related documentation

| Document | Relevance |
|----------|-----------|
| [`frontend-authentication-and-navigation.md`](./frontend-authentication-and-navigation.md) | Auth routes; where login, signup, and business register live. |
| [`frontend-i18n.md`](./frontend-i18n.md) | Translating validation and labels used in Zod factories. |
| [`advanced-table-usage.md`](./advanced-table-usage.md) | TanStack Table patterns in dashboards. |
| [`authentication-and-session.md`](./authentication-and-session.md) | Backend contracts for auth (not npm-specific, but pairs with auth client code). |

When the **standard form stack** or a **major dependency category** changes, update **this file** and the **companion row** in [`context.md`](./context.md).
