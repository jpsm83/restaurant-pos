# Schedules API — `app/api/v1/schedules`

This folder contains the **REST API for the Schedule entity**: **day-level shift planning** for a **Business**. A schedule is one **date** (no time) per business, with a list of **employeesSchedules** (who works, role, time range, vacation flag) and aggregated totals (head count, vacation count, labour cost). Schedules are **not** related to suppliers; they belong to **employees and operations**: who is working when, labour cost per day, and vacation deduction from the employee’s balance.

This document describes how the routes and utils work, how they interact with Employees and the rest of the app, and the patterns to follow when extending them.

---

## 1. Purpose and role in the application

- **Schedule** = one calendar day for one **Business**: `date`, `weekNumber` (ISO week), `businessId`, optional `comments`, and an array **employeesSchedules** (each: employeeId, role, timeRange start/end, vacation, computed shiftHours and employeeCost).
- **One day, one schedule per business:** Uniqueness is (businessId, date as year/month/day). Creating a schedule for a date that already exists for that business returns 409.
- **Employee shifts and vacation:** The same employee can appear **more than once** on the same day (e.g. split shift). Adding a shift with `vacation: true` decrements the employee’s `vacationDaysLeft`; removing or updating that entry can increment it back. Overlapping time ranges for the **same** employee are not allowed (validated via `isScheduleOverlapping`).
- **Labour cost:** Each shift has `employeeCost` (from `calculateEmployeeCost`: employee salary, shift duration, pay frequency, weekdays in month). The schedule keeps `totalDayEmployeesCost`, `totalEmployeesScheduled`, and `totalEmployeesVacation` for analytics and reporting.

So: **Schedules are the daily roster and labour-cost layer: they tie employees to dates, enforce no overlapping shifts per employee, and drive vacation balance and day-level cost.** For **non-admin employees**, schedules are also **required for employee login**: without a schedule for today covering the current time window, they cannot continue as employee at login. Schedules remain optional only if the business never uses employee mode.

- **Schedule check at login:** The helper `canLogAsEmployee(employeeId)` (in `lib/auth/canLogAsEmployee.ts`) is used by NextAuth **authorize** when a user with `employeeDetails` signs in. For **non-admin employees**, it returns whether that employee is scheduled **today** and the current time is within the allowed window: **from 5 minutes before shift start** until shift end (non-vacation shifts only). Employees whose `allEmployeeRoles` includes the **Admin** role can log in as employee at any time (the helper returns `true` for them regardless of schedule). The result is stored in the session as `canLogAsEmployee` and controls whether the "Continue as employee" button is enabled on the mode-selection page.

---

## 2. File structure

```
app/api/v1/schedules/
├── README.md                                    # This file — context for flow, patterns, and app integration
├── route.ts                                     # GET all schedules | POST create schedule (empty day)
├── [scheduleId]/
│   └── route.ts                                 # GET | PATCH (comments only) | DELETE by scheduleId
│   ├── addEmployeeToSchedule/
│   │   └── route.ts                             # PATCH — add one employee shift (or vacation) to the day
│   ├── deleteEmployeeFromSchedule/
│   │   └── route.ts                             # PATCH — remove one shift by employeeScheduleId (+ optional vacation refund)
│   └── updateEmployeeSchedule/
│       └── route.ts                             # PATCH — update one shift (time, role, vacation) and aggregates
├── business/
│   └── [businessId]/
│       └── route.ts                             # GET schedules for a business
├── user/
│   └── [userId]/
│       └── route.ts                             # GET schedules where this (employee) id appears
└── utils/
    ├── getWeekNumber.ts                         # ISO week number (year + week as single number, e.g. 202421)
    ├── getWeekDaysInMonth.ts                    # Weekday count in a month (for cost calculation)
    ├── isScheduleOverlapping.ts                 # Whether a new time range overlaps any in a list
    ├── employeesValidation.ts                   # Validates IEmployeeSchedule (employeeId, role, timeRange, optional vacation)
    └── calculateEmployeeCost.ts                 # Shift cost from salary, duration, pay frequency, weekdays
```

---

## 3. Route reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/schedules` | Returns all schedules (employeesSchedules populated with employee name/roles). 404 if none. |
| POST | `/api/v1/schedules` | Creates an empty schedule for a date. Body: **JSON** `{ date, businessId, comments? }`. Duplicate (businessId + same calendar day) → 409. |
| GET | `/api/v1/schedules/business/:businessId` | Returns schedules for the business. |
| GET | `/api/v1/schedules/user/:userId` | Returns schedules where this **user** (as employee) appears. Path param is `userId`; the handler resolves **User** by `userId`, then uses `user.employeeDetails` as `employeeId` and queries `Schedule.find({ "employeesSchedules.employeeId": employeeId })`. 404 if user not found or not linked to an employee. |
| GET | `/api/v1/schedules/:scheduleId` | Returns one schedule by ID. |
| PATCH | `/api/v1/schedules/:scheduleId` | Updates schedule **comments** only. Body: **JSON** `{ comments? }`. |
| DELETE | `/api/v1/schedules/:scheduleId` | Deletes schedule only if **date is in the future** (not today or past). 400 otherwise. |
| PATCH | `/api/v1/schedules/:scheduleId/addEmployeeToSchedule` | Adds one employee shift (or vacation slot). Body: **JSON** `{ employeeSchedule }`. Transaction: schedule update + optional Employee.vacationDaysLeft. |
| PATCH | `/api/v1/schedules/:scheduleId/deleteEmployeeFromSchedule` | Removes one shift by `employeeScheduleId`. Body: **JSON** `{ employeeId, employeeScheduleId }`. Optional vacation refund. |
| PATCH | `/api/v1/schedules/:scheduleId/updateEmployeeSchedule` | Updates one shift. Body: **JSON** `{ employeeScheduleId, employeeSchedule }`. Transaction: schedule + vacation balance. |

All responses are JSON. Errors use `handleApiError` (500) or explicit `NextResponse` with 400/404/409.

---

## 4. Request/response patterns and validation

### 4.1 GET (list, by id, by business, by user/employee)

- **DB:** `connectDb()` before first query.
- **Populate:** `employeesSchedules.employeeId` with `employeeName`, `allEmployeeRoles`.
- **By business:** `Schedule.find({ businessId })`.
- **By user:** Route path is `user/[userId]`. The handler uses `context.params.userId`, loads **User** by `userId`, reads `user.employeeDetails` (employeeId); if missing, returns 404. Then `Schedule.find({ "employeesSchedules.employeeId": employeeId })`. Returns all schedules where that employee appears (not limited to today).
- **Validation:** `isObjectIdValid` for scheduleId, businessId, userId (and employeeId where applicable).

### 4.2 POST (create schedule) — JSON body

**Required:** `date`, `businessId`.  
**Optional:** `comments`.

- **Validation:** `businessId` with `isObjectIdValid`. Date required.
- **Uniqueness:** One schedule per (businessId, calendar day). Use `$expr` with `$year`, `$month`, `$dayOfMonth` on `date` to detect duplicate; 409 if exists.
- **weekNumber:** Set via `getWeekNumber(new Date(date))` (ISO week, year+week as number e.g. 202421).
- **Result:** Schedule document with empty or default `employeesSchedules`, no shifts yet. Shifts are added with `addEmployeeToSchedule`.

### 4.3 PATCH (update schedule) — comments only

- Only **comments** are updated. Shift changes use add/delete/update employee routes.

### 4.4 DELETE (delete schedule) — future dates only

- Load schedule; compare `schedule.date` (at midnight) to today (at midnight). If `schedule.date <= today`, return 400 “Cannot delete past or current schedules!”. Otherwise delete the document.

### 4.5 Add employee to schedule — JSON body + transaction

**Body:** `{ employeeSchedule: { employeeId, role, timeRange: { startTime, endTime }, vacation? } }`.

- **Validation:** `employeesValidation(employeeSchedule)` (object shape, employeeId, role, timeRange start/end, start &lt; end).
- **Same employee, multiple entries:** Allowed (e.g. two shifts). If the new entry has `vacation: true` and the employee already has a non-vacation shift that day, or is already on vacation that day, the API returns 400.
- **Overlap:** For that employee’s **existing** shifts on this schedule, `isScheduleOverlapping(newStart, newEnd, existingRanges)` must be false; otherwise 400 “Employee scheduled overlaps existing one!”.
- **Cost:** `calculateEmployeeCost(employee.salary, shiftDurationMs, weekdaysInMonth)` → `employeeCost`. `getWeekdaysInMonth(currentYear, currentMonth)` for the month.
- **Update:** `$push` one element into `employeesSchedules` (with shiftHours, employeeCost); `$inc` `totalDayEmployeesCost`, `totalEmployeesScheduled` (if not vacation), `totalEmployeesVacation` (if vacation). If vacation, also `$inc` Employee `vacationDaysLeft: -1`. All in one transaction.

### 4.6 Delete employee from schedule — JSON body

**Body:** `{ employeeId, employeeScheduleId }` (subdocument `_id` of the shift to remove).

- **Validation:** scheduleId, employeeId, employeeScheduleId with `isObjectIdValid`.
- **Find:** Schedule must contain an entry with that `_id` and `employeeId`. Then `$pull` that element and `$inc` `totalDayEmployeesCost` by `-(removed.employeeCost)`, adjust `totalEmployeesScheduled` and `totalEmployeesVacation`. If the removed entry had `vacation: true`, `$inc` Employee `vacationDaysLeft: 1`.

**Note:** The delete route uses a query that references `employeeSchedules` (typo); the schema field is `employeesSchedules`. Use `employeesSchedules` in any fix.

### 4.7 Update employee schedule — JSON body + transaction

**Body:** `{ employeeScheduleId, employeeSchedule }` (same shape as add).

- Same validation and overlap rules as add (overlap checked against **other** shifts of the same employee on that day, excluding the one being updated).
- Recompute shiftHours and employeeCost; `$set` the matching `employeesSchedules.$` element. Adjust `totalDayEmployeesCost` (should reflect delta: new cost − old cost; current implementation may only add new cost — verify for correctness). Adjust `totalEmployeesScheduled` and `totalEmployeesVacation` when toggling vacation, and Employee `vacationDaysLeft` (+1 when removing vacation, −1 when adding). Transaction.

---

## 5. Utilities

### 5.1 `getWeekNumber(date)`

Returns ISO week as a single number: year × 100 + week (e.g. 202421). Used when creating a schedule so the day can be grouped by week.

### 5.2 `getWeekdaysInMonth(year, month)`

Returns the count of weekdays (Mon–Fri) in that month. Used by `calculateEmployeeCost` for monthly salary proration.

### 5.3 `isScheduleOverlapping(newStart, newEnd, existTimeRangeArr)`

Returns true if the new range overlaps any of the existing ranges (start/end inside or overlapping). Used to prevent the same employee having overlapping shifts on one day.

### 5.4 `employeesValidation(employeeSchedule)`

Checks: object, required keys `employeeId`, `role`, `timeRange`; `timeRange` has `startTime` and `endTime` with `startTime <= endTime`. Optional key `vacation`. Returns a string error or `true`.

### 5.5 `calculateEmployeeCost(salary, shiftDurationMs, weekdaysInMonth)`

Uses employee `salary.grossSalary` and `salary.payFrequency`. For **Monthly**, returns `grossSalary / weekdaysInMonth` (per-day cost). For **Weekly**, `grossSalary / 5`. For **Daily**, `grossSalary`. Otherwise (e.g. hourly) uses `grossSalary * (durationInHours)`. Used to set `employeeCost` on each shift and to maintain `totalDayEmployeesCost`.

---

## 6. How other parts of the app use Schedules

### 6.1 Employees

- **Employee** is referenced by `employeesSchedules.employeeId`. Schedule routes read Employee for salary (add/update cost) and update `vacationDaysLeft` when adding/removing/updating vacation entries. Employees README describes vacation and roles; schedules are the place where vacation is “consumed” per day.

### 6.2 Business

- Schedules are scoped by **businessId**. When a **Business** is deleted, **Schedule** is deleted in the same transaction (`Schedule.deleteMany({ businessId }, { session })` in `app/api/v1/business/[businessId]/route.ts`).

### 6.3 Reports and analytics

- `totalDayEmployeesCost`, `totalEmployeesScheduled`, `totalEmployeesVacation` support labour reporting and KPIs (e.g. cost per day, head count). Daily/monthly report flows can aggregate these.

### 6.4 No direct link to suppliers

- Schedules are about **staffing and labour cost**, not supply chain. They do not reference suppliers, purchases, or inventory.

---

## 7. Shared utilities and dependencies

| Dependency | Role |
|------------|------|
| `@/lib/db/connectDb` | Ensure MongoDB connection before first DB call. |
| `@/lib/db/handleApiError` | Central 500 JSON error response. |
| `@/lib/utils/isObjectIdValid` | Validate scheduleId, businessId, employeeId, employeeScheduleId. |
| `./utils/getWeekNumber` | Set weekNumber on create. |
| `./utils/getWeekdaysInMonth` | Weekday count for cost calculation. |
| `./utils/isScheduleOverlapping` | Prevent overlapping shifts per employee. |
| `./utils/employeesValidation` | Validate employeeSchedule payload. |
| `./utils/calculateEmployeeCost` | Compute employeeCost per shift. |
| `@/lib/db/models/schedule` | Schedule model. |
| `@/lib/db/models/employee` | Salary, vacationDaysLeft. |
| `@/lib/interface/ISchedule`, `IEmployeeSchedule`, `ITimeRange` | Types. |
| `@/lib/interface/IEmployee`, `ISalary` | For cost calculation. |

---

## 8. Patterns to follow when coding

1. **Always call `connectDb()`** before the first DB operation in each request.
2. **Validate IDs** with `isObjectIdValid` for scheduleId, businessId, employeeId, employeeScheduleId before queries or updates.
3. **One schedule per business per calendar day:** Enforce with year/month/day comparison; return 409 on duplicate create.
4. **No overlapping shifts** for the same employee on the same day; use `isScheduleOverlapping` when adding or updating a shift.
5. **Vacation and balance:** When adding a vacation slot, decrement Employee `vacationDaysLeft` in the **same transaction** as the schedule update; when removing or switching to non-vacation, increment. Keep Schedule aggregates (`totalEmployeesScheduled`, `totalEmployeesVacation`, `totalDayEmployeesCost`) in sync.
6. **Delete only future schedules:** Compare schedule date to today at midnight; reject delete for today or past.
7. **Use transactions** for add/update employee when both Schedule and Employee are updated.
8. **Consistent JSON** responses and error messages.

---

## 9. Data model summary (for context)

- **Schedule:** `date`, `weekNumber`, `businessId`, optional `comments`, `employeesSchedules[]`, `totalEmployeesScheduled`, `totalEmployeesVacation`, `totalDayEmployeesCost`.
- **employeesSchedules item:** `employeeId` (ref: Employee), `role`, `timeRange: { startTime, endTime }`, `vacation`, `shiftHours`, `employeeCost` (computed).

This README is the main context for how the schedules API works and how it ties into employees, vacation, labour cost, and the rest of the app.
