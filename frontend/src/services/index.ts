/**
 * Barrel for `src/services` — HTTP + TanStack Query wiring for the SPA.
 *
 * ## Layers (dependency direction: top → bottom)
 * 1. **`http.ts`** — Axios instance (`VITE_API_BASE_URL`, `withCredentials`, Bearer from
 *    `auth/api.getAccessToken`). All API modules below use this; no direct `fetch` here except
 *    legacy paths noted in `http`’s doc.
 * 2. **`queryClient.ts`** — singleton `QueryClient` mounted in `main.tsx` **outside** `AuthProvider`
 *    so the cache survives login/logout; mutations/queries still read the token via `http`.
 * 3. **`queryKeys.ts`** — stable keys for `useQuery` / `invalidateQueries`; keep in sync with
 *    whichever service owns a resource (`auth.mode`, `schedules.employeeDay`, …).
 * 4. **Feature services** — `authMode.ts`, `businessService.ts`, `schedulesService.ts`: async
 *    functions + optional React Query hooks; they import `http` + `queryKeys` (and sometimes
 *    `queryClient` from `auth/api` for cache invalidation on auth-only flows).
 *
 * ## Who imports from here
 * - `main.tsx` → `queryClient` (provider).
 * - `context/AuthModeContext.tsx` → `authMode` (mode cookie + mutations).
 * - `pages/business/BusinessRegisterPage.tsx` → `businessService` mutation.
 * - `pages/SelectUserModePage.tsx` → `schedulesService` (shift countdown).
 * - `auth/api.ts` → `queryClient` + `queryKeys` (invalidate `me` / related after login refresh).
 *
 * Prefer `import { … } from "@/services"` when using the barrel; deep imports are fine for tests
 * or tree-shaking clarity (`@/services/http`, etc.).
 */
export {
  EMPLOYEE_MODE_NOT_ALLOWED_MESSAGE,
  getAuthMode,
  setAuthMode,
  useAuthModeQuery,
  useSetAuthModeMutation,
  type AuthMode,
} from "./authMode";
export {
  createBusiness,
  useCreateBusinessMutation,
  type CreateBusinessResponseBody,
  type CreateBusinessSuccess,
} from "./businessService";
export { http } from "./http";
export { queryClient } from "./queryClient";
export { queryKeys } from "./queryKeys";
