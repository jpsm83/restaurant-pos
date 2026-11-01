/**
 * Central query keys for TanStack Query — use in `useQuery` / `invalidateQueries` to avoid typos.
 *
 * ## Wiring
 * - **`auth.me` / `auth.mode`:** `auth/api.ts` invalidates `me`; `authMode.ts` uses `auth.mode` for
 *   `useAuthModeQuery` / `useSetAuthModeMutation` cache updates.
 * - **`auth.config`:** `auth/api.ts` `useAuthConfigQuery` caches public auth-surface availability.
 * - **`auth.venues`:** `authVenues.ts` caches the signed-in User's accessible venue list for the chrome.
 * - **`schedules.employeeDay`:** `schedulesService.useNextShiftForEmployee`; invalidated from
 *   `SelectUserModePage` when countdown completes (refetch eligibility).
 * - **`schedules.byBusiness`:** reserved for broader schedule UIs; keep keys stable when adding hooks.
 * - **`business.detail`:** profile fetch/edit flows for business settings pages.
 * - **`business.access`:** the signed-in User's effective access snapshot for one venue.
 * - **`employees.byBusiness`:** venue membership list for the People page.
 * - **`portfolio.byUser` / `portfolio.all`:** the customer dashboard’s User-scoped Owner portfolio read.
 */
export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
    mode: () => ["auth", "mode"] as const,
    config: () => ["auth", "config"] as const,
    venues: () => ["auth", "venues"] as const,
  },
  business: {
    detail: (businessId: string) => ["business", "detail", businessId] as const,
    detailPending: () => ["business", "detail", "pending"] as const,
    access: (businessId: string) => ["business", "access", businessId] as const,
    accessPending: () => ["business", "access", "pending"] as const,
  },
  portfolio: {
    all: () => ["portfolio"] as const,
    byUser: (userId: string) => ["portfolio", userId] as const,
  },
  employees: {
    managementContacts: (businessId: string) =>
      ["employees", "managementContacts", businessId] as const,
    byBusiness: (businessId: string) =>
      ["employees", "business", businessId] as const,
    byBusinessPending: () => ["employees", "business", "pending"] as const,
  },
  schedules: {
    byBusiness: (businessId: string, dayKey?: string) =>
      ["schedules", "business", businessId, dayKey ?? "current"] as const,
    /** Today's rows for one employee — Phase 3.4 countdown / eligibility UI. */
    employeeDay: (businessId: string, employeeId: string, dayKey: string) =>
      ["schedules", "employeeDay", businessId, employeeId, dayKey] as const,
    employeeDayPending: () => ["schedules", "employeeDay", "pending"] as const,
  },
  advancedTable: {
    businessDashboard: (businessId: string, params: Record<string, unknown>) =>
      ["advancedTable", "businessDashboard", businessId, params] as const,
  },
} as const;
