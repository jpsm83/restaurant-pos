/**
 * Central query keys for TanStack Query — use in `useQuery` / `invalidateQueries` to avoid typos.
 *
 * ## Wiring
 * - **`auth.me` / `auth.mode`:** `auth/api.ts` invalidates `me`; `authMode.ts` uses `auth.mode` for
 *   `useAuthModeQuery` / `useSetAuthModeMutation` cache updates.
 * - **`schedules.employeeDay`:** `schedulesService.useNextShiftForEmployee`; invalidated from
 *   `SelectUserModePage` when countdown completes (refetch eligibility).
 * - **`schedules.byBusiness`:** reserved for broader schedule UIs; keep keys stable when adding hooks.
 */
export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
    mode: () => ["auth", "mode"] as const,
  },
  schedules: {
    byBusiness: (businessId: string, dayKey?: string) =>
      ["schedules", "business", businessId, dayKey ?? "current"] as const,
    /** Today's rows for one employee — Phase 3.4 countdown / eligibility UI. */
    employeeDay: (businessId: string, employeeId: string, dayKey: string) =>
      ["schedules", "employeeDay", businessId, employeeId, dayKey] as const,
  },
  advancedTable: {
    businessDashboard: (businessId: string, params: Record<string, unknown>) =>
      ["advancedTable", "businessDashboard", businessId, params] as const,
  },
} as const;
