import { useQuery } from "@tanstack/react-query";
import { http } from "./http";
import { queryKeys } from "./queryKeys";
import type { ScheduleShiftEntry } from "@/lib/employeeModeSchedule";

export type DailyEmployeeScheduleResponse = {
  entries: ScheduleShiftEntry[];
};

/**
 * Authenticated user's shift rows for a calendar day (`dayKey=YYYY-MM-DD`) at the given business.
 * Backend: `GET /api/v1/schedules/business/:businessId/daily`.
 */
export async function fetchDailyEmployeeSchedule(
  businessId: string,
  dayKey: string,
): Promise<DailyEmployeeScheduleResponse> {
  const { data } = await http.get<DailyEmployeeScheduleResponse>(
    `/api/v1/schedules/business/${businessId}/daily`,
    { params: { dayKey } },
  );
  return data;
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
        : ["schedules", "employeeDay", "pending"],
    queryFn: () => fetchDailyEmployeeSchedule(businessId!, dayKey),
    enabled: canRun,
  });
}
