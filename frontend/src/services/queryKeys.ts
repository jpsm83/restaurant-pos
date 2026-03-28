/**
 * Central query keys for TanStack Query — use in `useQuery` / `invalidateQueries` to avoid typos.
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
} as const;
