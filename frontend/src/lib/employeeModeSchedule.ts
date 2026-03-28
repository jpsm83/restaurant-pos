/**
 * Pure helpers mirroring **non-management** rules in `backend/src/auth/canLogAsEmployee.ts`:
 * employee login is allowed when `now ∈ [shiftStart − 5 min, shiftEnd]`; vacation entries are skipped.
 *
 * **Management bypass** is applied only on the server (JWT `canLogAsEmployee === true`). The UI must
 * enable the employee CTA from the session flag and **not** show a schedule countdown in that case
 * (Phase 3.4.5).
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
