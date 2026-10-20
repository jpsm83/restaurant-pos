# Time control

> **About this document.** This is the **target-state source of truth** for time control in Project Imperium — plan-versus-actual attendance, the daily attendance QR, the time-clock ledger and shift session, late lock, breaks, sign-out rules, worked hours and actual labour cost, no-shows, and overtime alerts. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes time control as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **attendance** — the **actual** side of the plan-versus-actual labour model. This subject owns:

- the **daily attendance QR** and scan-in that create **on duty**;
- the **time-clock ledger** and the **shift session** projected from it;
- **late lock** and manager unlock;
- **breaks** (pause and resume), attendance reasons, and the venue setting for whether paused time counts toward worked hours;
- **manager sign-out**, early-leave reasons, and the blockers for open sales instances and **uncashed activity**;
- **worked hours**, **actual labour cost**, and **overtime** detection;
- **absence (no-show)** when the business-mode entry window closes without a sign-in;
- the attendance events that notify managers (sign-out request, overtime), including **overtime mute** for a session.

It deliberately does **not** cover:

- the **schedule** (day schedules, working shifts, vacation and other leave, time-off requests, planned labour aggregates) — the schedules subject owns the plan. This subject compares actuals against that plan and never writes schedule punches.
- **business-mode eligibility** as a platform rule — the users subject owns when a person may enter business mode; the access-and-permissions subject owns effective layer (including that supervisors are schedule-gated). This subject states the attendance facts and the entry window those rules read; schedules supply the planned working shift. Service / Manage / Me left-menu navigation inside business mode belongs to the user-navigation subject.
- the **Employee** membership, pay, and vacation allowance — the employees subject owns those. This subject consumes gross pay and pay frequency for actual labour cost.
- **open sales instances** and responsible-staff attribution — the sales-points-and-instances subject owns those. This subject enforces that duty sign-out is blocked while the employee still holds open instances.
- **employee cash-out** and what counts as **uncashed activity** — the employee cash-out subject owns the wallet, cash-out approval, and financial obligation. This subject enforces that duty sign-out is also blocked while uncashed activity remains.
- **notification delivery** — inbox, live push, cooldown mechanics — the notifications subject owns how events are delivered. This subject defines which attendance events exist, when they fire, and the overtime session mute.
- **labour KPI formulas** and report roll-ups — the business-metrics and business-reports subjects own those. This subject supplies worked hours, overtime hours, and actual labour cost.
- **payroll preparation and export** — pay periods, tip pooling into a pay run, release, and accountant CSV — the payroll subject owns those. This subject supplies the closed sessions and hours that subject consumes.
- **staff sessions** (personal or venue-provided device, one User per browser session, concurrent multi-session) and the exclusion of shared login / PIN / quick-switch identity — the staff-sessions subject. Presenting and scanning the attendance QR always happens on each person's **own** signed-in session.

---

## 2. Domain model and vocabulary

### Entities

- **Time-clock ledger** — the append-only record of attendance events for a business (sign-in, break start, break end, late unlock, sign-out, correction). Wrong data is fixed by appending further events, never by silent rewrite.
- **Shift session** — the projection of ledger events for one employee engagement: planned window (when bound to a working shift), actual sign-in and sign-out, breaks, worked hours, labour cost, and status. At most **one open session** (including on break) per employee at a time.
- **Daily attendance QR** — the venue's one attendance QR for a calendar day in the business timezone. Scanning it is how a person becomes on duty.

```
Business ──< Daily attendance QR >── calendar day
Business ──< Time-clock ledger event >── Employee
                └── projects → Shift session ── optional Working shift (schedules subject)
```

### Terms this subject introduces

- **On duty** — the actual attendance fact that the person has signed in and has not yet been signed out. Distinct from being in **business mode** and from being scheduled.
- **Late lock** — after an employee- or supervisor-layer person's planned start, if they have not signed in, they cannot scan until a manager unlocks them. Unlock does not change the eventual scan timestamp.
- **Entry window** — for a planned working shift, the interval from **10 minutes before** planned start until **2 hours after** planned start, during which an employee- or supervisor-layer person may enter **business mode** to attempt duty. Outside that window with no open session, they cannot enter business mode and need a manager to reschedule.
- **Attendance reason** — a value from the fixed platform list: **lunch**, **rest**, **personal**, or **other** (optional short free-text note when other). Required when starting a break and when signing out more than 10 minutes before planned end; optional on late unlock.
- **Break hours setting** — venue setting: whether paused time **counts toward worked hours** (default **include**) or is **excluded**. Managers and above edit it; changes apply to new pauses; already-closed sessions keep the math they closed with.
- **Worked hours** — duration from sign-in to sign-out after applying the break hours setting to pause intervals.
- **Actual labour cost** — money cost of a session from the employee's **gross pay** and **pay frequency** over worked hours, using the same frequency rules as planned labour on the schedules subject. Incomplete gross omits that session's cost (treated as zero in totals) until pay is complete.
- **Overtime** — time an employee other than an admin or owner remains on duty past the session's **planned end**. Unscheduled management sessions have no planned end and never raise overtime.
- **Overtime mute** — a manager-layer action that stops further overtime alert repeats for one employee's **current open session** only. It does not sign them off and does not hide the session.
- **Absent (no-show)** — status of a planned working shift when the entry window ends with no sign-in.
- **Correction** — a manager-layer ledger event that adjusts sign-in, sign-out, or break bounds after the fact, with a **required** reason. Reports read the corrected projection.

Terms reused rather than redefined here: **Employee**, **Business**, **Working shift**, **Vacation entry**, **Other leave**, **gross pay**, **pay frequency**, **business currency**, **business timezone**, **base access layer**, **sales instance**, and **managers on duty**.

### Session status

A shift session (or the plan-vs-actual row for a working shift with no session) is exactly one of:

| Status | Meaning |
| --- | --- |
| **Open** | On duty, not paused |
| **On break** | On duty, paused |
| **Closed** | Signed out |
| **Absent** | Planned working shift with no session after the entry window |

---

## 3. Capabilities

### 3.1 Plan versus actual

- The **schedule** is the plan; **on duty** is the actual. Being scheduled is never on duty.
- Time control records real entry and exit times. A late scan records a late time; Project Imperium never backdates a punch to the planned start.
- All times are stored in UTC and interpreted in the **business timezone**.
- Actual worked hours and labour cost feed reporting (business-reports and business-metrics subjects).

### 3.2 Daily attendance QR

- Each business has **one** attendance QR per calendar day in the business timezone. The next day issues a new QR; presenting another day's QR fails.
- Any **manager-layer** user (manager, admin, owner) in business mode may **present** that day's QR from **their own signed-in session** (personal or venue-provided device). They need **not** already be on duty — presenting the QR is how managers themselves become on duty when they scan on their own session. There is **no** shared staff login for attendance.
- Ordinary employees become on duty only by scanning a QR a manager-layer user is presenting, from **their own** signed-in Business session (staff-sessions subject).
- Scan-in requires the person to be in **business mode** (users subject). Opening business mode alone is not on duty.

### 3.3 Business-mode entry window

For an employee- or supervisor-layer person with a **planned working shift**:

- Business mode is available from **10 minutes before** planned start until **2 hours after** planned start.
- Outside that window, if they have **no open session**, they cannot enter business mode and must be **rescheduled** by a manager before they can attempt duty.
- The window gates **entering** business mode to start (or attempt) a session. An **already open** session continues past planned start + 2 hours.
- **Vacation** or **other leave** on a day (no working shift) grants no entry window and no clock-in.
- **Managers, admins, and owners** are never blocked from business mode by the schedule or this window (Suspended or Terminated membership still blocks Business). **Supervisors** follow the employee/supervisor entry-window rule above — they are not excused from the schedule.
- **Suspended** or **Terminated** memberships cannot enter business mode or open a session.

There is **no** late-unlock step on the schedule itself. Lateness honesty is late lock and real scan times in this subject; the two-hour end of the entry window is schedule-side eligibility, not a manager unlock.

### 3.4 Sign-in and shift binding

- Scanning the valid daily attendance QR while eligible opens a **shift session** and appends a sign-in event at the **exact scan moment**.
- For **employee- or supervisor-layer** people, the session binds to the **planned working shift** that currently makes them eligible. If more than one planned interval could apply, bind to the **earliest-starting** working shift that still has no completed session.
- **One open session** per employee at a time. A later working shift the same day requires the first session closed first.
- Managers, admins, and owners may sign in **without** a matching working shift; that session may carry an empty planned window for plan-vs-actual and never raises overtime. Supervisors may not — they need a planned working shift like employees.

### 3.5 Late lock

- Before planned start, an employee- or supervisor-layer person inside the entry window may scan freely.
- From **planned start** onward, if they have not signed in, they are **late-locked**: they may still be in business mode until the window ends, but **scan-in is rejected** until a manager unlocks them.
- Unlock is a manager-layer action, optional **attendance reason**. The unlock is ledgered (who, when). It only permits the next scan; the sign-in timestamp remains the real scan time.
- Managers, admins, and owners are never late-locked.

### 3.6 Breaks

- Once on duty, the **employee** may **pause** and **resume** duty in the app. A manager-layer user may also start or end a break for them.
- Every pause requires an **attendance reason** (§2).
- The employee remains signed in while on break. Being on break is allowed even if they still hold open sales instances.
- Whether paused time counts in **worked hours** follows the venue **break hours setting** (default **include**).

### 3.7 Leaving the app versus ending duty

- **Leaving business mode** (switching to customer mode via the mode toggle, navigating away, or closing the app) does **not** end the shift session. On-duty continues; work already attributed on open sales instances remains. During an open session the employee may **re-enter business mode without scanning again and without a manager**.
- **Ending duty (sign-out)** is a separate action (§3.8).

### 3.8 Sign-out

- Only a **manager-layer** user in business mode may sign someone out. They need not be on duty.
- The employee may optionally **request sign-out** in the app; that notifies **managers on duty**. A manager may sign them out with or without a prior request.
- Sign-out appends a ledger event at the real action time and sets the session to **closed**.
- For **employee- or supervisor-layer** staff, duty sign-out also **ends business mode** for that visit (they return to customer mode). Managers, admins, and owners may be signed out of duty without being kicked out of business mode.
- **Early leave.** If sign-out is **more than 10 minutes before** the session's planned end, an **attendance reason** is required. Within 10 minutes of planned end, or after planned end, no reason is required. Unscheduled management sessions have no early-leave reason rule.
- **Open sales instances.** Sign-out is **rejected** while the employee is the responsible staff on any **open sales instance** (any point type, not only tables). The warning lists those open points. Sign-out becomes possible only after those instances are **closed** or **transferred**.
- **Uncashed activity.** Sign-out is **rejected** while the employee still has **uncashed activity** in their employee cash session (employee cash-out subject) — including receive-only obligation from peer cash-in or house paid-out with no sales. They must complete an approved **cash-out** (or have no uncashed activity) before sign-out. Personal float alone does not block sign-out.
- There is **no** force-sign-out override for either blocker.

### 3.9 Absence (no-show)

- When the entry window ends with **no sign-in**, that planned working shift is **absent (no-show)** automatically. Managers need not confirm.
- Vacation and other leave are not no-shows.
- A later reschedule creates a new plan; it does not erase the absence on the original working shift.

### 3.10 Corrections

- Managers and above may append **correction** events (adjust sign-in, sign-out, or break bounds) with a **required** reason.
- Ordinary employees cannot edit the ledger.
- Sessions and ledger events are **retained** for reporting. There is no delete of a session; corrections are the only fix path.

### 3.11 Worked hours and actual labour cost

- **Worked hours** are derived from sign-in, sign-out, and pauses under the break hours setting.
- **Actual labour cost** uses the same gross-and-frequency rules as planned labour on the schedules subject, applied to worked hours in the business currency.
- Incomplete or missing gross does not block attendance; that session's cost is omitted until pay is complete.

### 3.12 Overtime

- Overtime starts when a person who is **not** an admin or owner is still **on duty** (including on break) past that session's **planned end**.
- Detection belongs to this subject. Delivery belongs to the notifications subject: **managers on duty** are notified **every 5 minutes** until sign-off; if none are on duty, the alert **falls back** to all manager-layer users at that venue. The schedules subject requires a manager-layer working shift on every day that plans work, so someone is always in charge on the plan; the fallback covers the gap before that person has signed in.
- A manager-layer user may **mute** further repeats for that employee's **current open session**. A new session can alert again. Mute is not the engagement mute; it is specific to this overtime thread.

### 3.13 Overnight working shifts

- Eligibility window, no-show deadline, planned start and end, daily attendance QR day, and session day-belonging all follow the **start day** of the working shift (same rule as the schedules subject).

### 3.14 Visibility

- An ordinary employee sees **their own** sessions and ledger.
- Managers and above see **all** attendance for the venue (sessions, ledger, plan-vs-actual, no-shows).

### 3.15 Notifications this subject owns as events

Attendance events are **in-app only**. Delivery mechanics belong to the notifications subject.

| Event | Who is notified | When |
| --- | --- | --- |
| Sign-out request | Managers on duty | When an employee requests sign-out |
| Overtime alert | Managers on duty; if none, all manager-layer users at the venue | Every 5 minutes while a non-admin/owner remains on duty past planned end, until sign-off or overtime mute for that session |

---

## 4. Roles and entitlements

### Base access layers

| Layer | Powers on this subject |
| --- | --- |
| **Customer** | No attendance access. |
| **Employee** | Enter business mode inside their entry window; open Attendance to scan in when not late-locked; pause and resume own breaks with reason; request sign-out; re-enter business mode during an open session; read own sessions and ledger. Does **not** present the daily attendance QR. |
| **Supervisor** | Same attendance powers as employee (schedule-gated; own scan-in via Attendance; sign-out ends Business). Full Service may include Attendance for self scan-in. Does **not** present the QR, late-unlock, sign others out, or see venue-wide attendance. |
| **Manager** | Everything an employee can do, plus present the daily attendance QR, late-unlock, sign anyone out, correct the ledger, mute overtime for a session, edit the break hours setting, and see venue-wide attendance. Always Business-eligible when membership allows. |
| **Admin** | Everything a manager can do. |

### Job roles

Job role on the bound working shift is owned by the schedules and employees subjects. This subject records which planned shift the session bound to; it does not assign roles.

### Per-user capabilities

No per-user capability gates attendance actions on this subject. Those actions follow the **base access layer** table above.

### Who can do what

| Activity | Who |
| --- | --- |
| Present the daily attendance QR | Manager-layer users in business mode (not supervisors) |
| Scan in (become on duty) | Eligible employee- or supervisor-layer person in business mode (planned working shift; must clear late lock when applicable); managers and admins may scan without a matching shift |
| Late-unlock | Manager-layer users in business mode |
| Pause / resume own break | The on-duty person; also any manager-layer user for that person |
| Request sign-out | The on-duty person |
| Sign out (end duty) | Manager-layer users in business mode, and only when the person holds no open sales instances and has no uncashed activity |
| Append corrections | Managers and above |
| Edit break hours setting | Managers and above |
| Mute overtime for an open session | Manager-layer users in business mode |
| View own attendance | The person themself |
| View venue-wide attendance | Managers and above |
