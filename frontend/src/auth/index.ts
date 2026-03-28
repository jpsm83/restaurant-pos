/**
 * **`src/auth`** — session identity, tokens, and navigation helpers for the SPA.
 *
 * ## Pieces
 * | File | Role |
 * |------|------|
 * | **`types.ts`** | `AuthSession` / `AuthUser` / `AuthBusiness` / `AuthState` — mirrors backend JWT payloads. |
 * | **`api.ts`** | `fetch` to `/api/v1/auth/*`; module-level **`accessToken`** + `sessionStorage` bootstrap; **`getAccessToken`/`setAccessToken`** used by **`services/http.ts`** interceptor. |
 * | **`store/AuthContext.tsx`** | `AuthProvider` + `useAuth` + reducer; bootstraps session on load (`/me` or refresh cookie). Mounted in **`main.tsx`** (inside `QueryClientProvider`). |
 * | **`postLoginRedirect.ts`** | `getPostLoginDestination` — first URL after login; uses **`routes/canonicalPaths`**. |
 * | **Re-export** | `AuthModeProvider` / `useAuthMode` from **`context/AuthModeContext`** (cookie workspace mode, not JWT identity). |
 *
 * ## Typical flow
 * 1. **Bootstrap:** `AuthProvider` restores token from `sessionStorage`, or `POST /refresh`, then `GET /me` → `AUTH_SUCCESS` / `AUTH_CLEAR`.
 * 2. **Login/signup pages** call `login`/`signup` from **`api`**, `dispatch(AUTH_SUCCESS)`, `navigate(getPostLoginDestination(user))`.
 * 3. **Guards** (`routes/AuthRouteGuards.tsx`) read **`useAuth().state`**; **Navbar** / **AccountMenuPopover** use **`useAuth`** for UI.
 * 4. **Logout:** `logout()` clears token and removes auth-mode query cache; UI dispatches **`AUTH_CLEAR`**.
 *
 * Import **`@/auth`** for the barrel, or **`@/auth/store/AuthContext`** when only `useAuth` is needed to avoid pulling the whole surface.
 */
export * from "./types";
export * from "./api";
export * from "./postLoginRedirect";
export * from "./store/AuthContext";
export { AuthModeProvider, useAuthMode, type AuthMode } from "@/context/AuthModeContext";
