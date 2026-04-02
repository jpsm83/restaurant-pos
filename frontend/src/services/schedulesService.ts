/**
 * **Schedules** API for employee shift windows (Phase 3.4 countdown / eligibility).
 *
 * ## Flow
 * 1. **`fetchDailyEmployeeSchedule`** — `GET /api/v1/schedules/business/:businessId/daily?dayKey=…`
 *    via shared `http`.
 * 2. **`useNextShiftForEmployee`** — `useQuery` keyed by `queryKeys.schedules.employeeDay`; used by
 *    **`SelectUserModePage`** when JWT disallows employee mode until shift; page invalidates this
 *    query when countdown completes.
 *
 * Depends on: `./http`, `./queryKeys`, shared schedule contracts from `@packages/interfaces`.
 */
import { useQuery } from "@tanstack/react-query";
import type { IDailyEmployeeScheduleResponse } from "@packages/interfaces/ISchedule.ts";
import { http } from "./http";
import { queryKeys } from "./queryKeys";
import { toServiceRequestError } from "./serviceErrors";

/**
 * Authenticated user's shift rows for a calendar day (`dayKey=YYYY-MM-DD`) at the given business.
 * Backend: `GET /api/v1/schedules/business/:businessId/daily`.
 */
export async function fetchDailyEmployeeSchedule(
  businessId: string,
  dayKey: string,
  signal?: AbortSignal,
): Promise<IDailyEmployeeScheduleResponse> {
  try {
    const { data } = await http.get<IDailyEmployeeScheduleResponse>(
      `/api/v1/schedules/business/${businessId}/daily`,
      { params: { dayKey }, signal },
    );
    return data;
  } catch (e) {
    throw toServiceRequestError(e, {
      fallback: "Failed to fetch employee schedule",
      byStatus: {
        401: "Please sign in to view employee schedule.",
        403: "You do not have permission to view this employee schedule.",
        404: "Schedule data was not found for this day.",
      },
    });
  }
}

export type UseNextShiftForEmployeeOptions = {
  businessId: string | undefined;
  employeeId: string | undefined;
  dayKey: string;
  /** When false, no request is made (e.g. management already allowed via JWT). */
  enabled?: boolean;
};

/**
 * TanStack Query wrapper for today's employee schedule slice (Phase 3.4.2).
 */
export function useNextShiftForEmployee(options: UseNextShiftForEmployeeOptions) {
  const { businessId, employeeId, dayKey, enabled = true } = options;
  const canRun = Boolean(businessId && employeeId && dayKey && enabled);

  return useQuery({
    queryKey:
      businessId && employeeId
        ? queryKeys.schedules.employeeDay(businessId, employeeId, dayKey)
        : queryKeys.schedules.employeeDayPending(),
    queryFn: ({ signal }) =>
      fetchDailyEmployeeSchedule(businessId!, dayKey, signal),
    enabled: canRun,
  });
}
