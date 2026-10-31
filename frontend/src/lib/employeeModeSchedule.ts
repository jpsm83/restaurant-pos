import type { IScheduleShiftEntry } from "restaurant-pos-packages/interfaces/ISchedule";

/**
 * Pure **schedule math** for employee-mode eligibility UI (`src/lib` — no React, no network).
 *
 * ## Domain rules (must stay aligned with backend)
 * Mirrors **non-management** rules from `backend/src/access/resolveEffectiveAccess.ts` (via
 * `backend/src/auth/canLogAsEmployee.ts`): employee login is allowed when
 * `now ∈ [shiftStart − 10 min, shiftStart + 2 h]`; shift end is irrelevant and vacation rows are
 * ignored.
 *
 * **Management bypass** exists only on the server (JWT `canLogAsEmployee === true`). The UI enables
 * the employee CTA from that flag and **skips** schedule countdown when bypass applies (Phase 3.4.5).
 *
 * ## Wiring
 * 1. **`services/schedulesService.ts`** types API rows as `IScheduleShiftEntry` and fetches today’s data.
 * 2. **`pages/SelectUserModePage.tsx`** calls `deriveEmployeeModeFromSchedule` + `formatDayKeyLocal`
 *    with `Date.now()` / poll tick and schedule query results to drive countdown and copy.
 * 3. Backend remains authoritative; this module only previews windows so users see “unlocks in …”
 *    before the next `GET /auth/me` refresh grants `canLogAsEmployee`.
 */
export const EMPLOYEE_LOGIN_EARLY_MS = 10 * 60 * 1000;
export const EMPLOYEE_LOGIN_LATE_MS = 2 * 60 * 60 * 1000;

export type EmployeeModeScheduleDerived = {
  /**
   * Whether today's schedule windows alone would allow employee login right now.
   * Ignores management bypass; compare with JWT `canLogAsEmployee` for the real gate.
   */
  scheduleAllowsEmployeeNow: boolean;
  /**
   * Next `shiftStart − 10 min` (ms) strictly in the future, or `null` if none today.
   */
  countdownTargetMs: number | null;
};

function windowStartMs(shiftStartMs: number): number {
  return shiftStartMs - EMPLOYEE_LOGIN_EARLY_MS;
}

function windowEndMs(shiftStartMs: number): number {
  return shiftStartMs + EMPLOYEE_LOGIN_LATE_MS;
}

export function isWithinEmployeeLoginWindow(
  nowMs: number,
  shiftStartMs: number,
): boolean {
  return nowMs >= windowStartMs(shiftStartMs) && nowMs <= windowEndMs(shiftStartMs);
}

/**
 * @param nowMs — typically `Date.now()`
 * @param entries — today's rows for this employee from `GET .../schedules/business/:id/daily`
 */
export function deriveEmployeeModeFromSchedule(
  nowMs: number,
  entries: IScheduleShiftEntry[],
): EmployeeModeScheduleDerived {
  const shiftStarts = entries
    .filter((e) => !e.vacation)
    .map((e) => new Date(e.startTime).getTime())
    .filter((start) => !Number.isNaN(start));

  let scheduleAllowsEmployeeNow = false;
  let countdownTargetMs: number | null = null;

  for (const start of shiftStarts) {
    if (isWithinEmployeeLoginWindow(nowMs, start)) {
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
