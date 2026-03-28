/**
 * Pure **schedule math** for employee-mode eligibility UI (`src/lib` — no React, no network).
 *
 * ## Domain rules (must stay aligned with backend)
 * Mirrors **non-management** rules from `backend/src/auth/canLogAsEmployee.ts`: employee login is
 * allowed when `now ∈ [shiftStart − 5 min, shiftEnd]`; vacation rows are ignored.
 *
 * **Management bypass** exists only on the server (JWT `canLogAsEmployee === true`). The UI enables
 * the employee CTA from that flag and **skips** schedule countdown when bypass applies (Phase 3.4.5).
 *
 * ## Wiring
 * 1. **`services/schedulesService.ts`** types API rows as `ScheduleShiftEntry` and fetches today’s data.
 * 2. **`pages/SelectUserModePage.tsx`** calls `deriveEmployeeModeFromSchedule` + `formatDayKeyLocal`
 *    with `Date.now()` / poll tick and schedule query results to drive countdown and copy.
 * 3. Backend remains authoritative; this module only previews windows so users see “unlocks in …”
 *    before the next `GET /auth/me` refresh grants `canLogAsEmployee`.
 */
export const EMPLOYEE_LOGIN_EARLY_MS = 5 * 60 * 1000;

export type ScheduleShiftEntry = {
  vacation: boolean;
  startTime: string;
  endTime: string;
};

export type EmployeeModeScheduleDerived = {
  /**
   * Whether today's schedule windows alone would allow employee login right now.
   * Ignores management bypass; compare with JWT `canLogAsEmployee` for the real gate.
   */
  scheduleAllowsEmployeeNow: boolean;
  /**
   * Next `shiftStart − 5 min` (ms) strictly in the future, or `null` if none today.
   */
  countdownTargetMs: number | null;
};

function windowStartMs(shiftStartMs: number): number {
  return shiftStartMs - EMPLOYEE_LOGIN_EARLY_MS;
}

export function isWithinEmployeeLoginWindow(
  nowMs: number,
  shiftStartMs: number,
  shiftEndMs: number,
): boolean {
  const ws = windowStartMs(shiftStartMs);
  return nowMs >= ws && nowMs <= shiftEndMs;
}

/**
 * @param nowMs — typically `Date.now()`
 * @param entries — today's rows for this employee from `GET .../schedules/business/:id/daily`
 */
export function deriveEmployeeModeFromSchedule(
  nowMs: number,
  entries: ScheduleShiftEntry[],
): EmployeeModeScheduleDerived {
  const shifts = entries
    .filter((e) => !e.vacation)
    .map((e) => ({
      start: new Date(e.startTime).getTime(),
      end: new Date(e.endTime).getTime(),
    }))
    .filter((s) => !Number.isNaN(s.start) && !Number.isNaN(s.end));

  let scheduleAllowsEmployeeNow = false;
  let countdownTargetMs: number | null = null;

  for (const { start, end } of shifts) {
    if (isWithinEmployeeLoginWindow(nowMs, start, end)) {
      scheduleAllowsEmployeeNow = true;
    }
    const ws = windowStartMs(start);
    if (nowMs < ws) {
      if (countdownTargetMs === null || ws < countdownTargetMs) {
        countdownTargetMs = ws;
      }
    }
  }

  return { scheduleAllowsEmployeeNow, countdownTargetMs };
}

export function formatDayKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
