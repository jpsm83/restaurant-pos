# Schedules

> **About this document.** This is the **target-state source of truth** for schedules in Project Imperium — the daily schedule, shift and leave entries, overlap and vacation rules, time-off requests, planned labour aggregates, and the schedule events that notify staff. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes schedules as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **schedule** — the **plan** of who is expected to work or be away at a venue. This subject owns:

- the **day schedule** — one schedule per business per calendar day in the business timezone;
- **shift entries** on that day — working shifts, vacation, and other leave;
- **overlap**, **overnight**, and **vacation-balance** rules;
- **day comments**, **copy day**, **clear day**, and **multi-day bulk add**;
- **time-off requests** from employees and their approval;
- **daily planned aggregates** (staff, vacation, planned hours, planned labour cost);
- the **schedule-change** and **time-off** notification events (what fires and when they batch).

It deliberately does **not** cover:

- the **Employee** membership, job-role list on the membership, pay, or vacation **allowance** storage — the employees subject owns those. This subject consumes memberships and updates **vacation remaining** when vacation is marked or removed on the schedule.
- **base access layers**, **per-user capabilities**, and assignment — the access-and-permissions subject owns those. **Mode eligibility** (Customer | Business) belongs to the users subject. This subject supplies the planned working shifts and shift job roles those rules read.
- **attendance** — on-duty state, the daily attendance QR, scan-in, manager sign-out, breaks, worked hours, actual labour cost, absence classification, and overtime alerts — the time-control subject owns those. The schedule never writes punches; being scheduled is not being on duty.
- **labour and vacation KPI formulas** and report roll-ups — the business-metrics and business-reports subjects own those. This subject supplies planned figures; actuals come from time-control.
- **notification delivery** — inbox, live push, and reliability — the notifications subject owns how events are delivered. This subject defines which schedule events exist and when they fire.

---

## 2. Domain model and vocabulary

### Entities

- **Day schedule** — the plan for one **Business** on one **calendar day** in the business timezone. It holds that day's shift entries, an optional day comment, and the day's planned aggregates. Week and month presentations are views over day schedules; they are not separate plan objects.
- **Shift entry** — one planned line on a day schedule for one employee. Exactly one **entry kind** applies: **working**, **vacation**, or **other leave**.

```
Business ──< Day schedule >── calendar day
                └──< Shift entry >── Employee
```

### Terms this subject introduces

- **Working shift** — a shift entry with a required **job role** (chosen from that membership's roles), planned **start** and **end**, and planned labour contribution. The person is expected to work that interval.
- **Vacation entry** — a shift entry marked vacation, with start and end for audit, **no job role**, planned labour cost zero. Exclusive with any working shift for that employee on that day. Decrements **vacation remaining** by exactly one day.
- **Other leave** — a shift entry for approved non-vacation absence (for example a doctor appointment), with start and end for audit, **no job role**, planned labour cost zero. Exclusive with any working shift for that employee on that day. Does **not** decrement vacation remaining.
- **Day comment** — optional free-text operational note on the day schedule (for example expecting a large crowd). Not attached to an individual employee.
- **Time-off request** — an employee-initiated ask for vacation or other leave on one or more days, held **pending** until a manager or above approves or rejects it, with an optional decision note.
- **Planned labour cost** — the money cost implied by working shifts on the day, derived from each employee's **gross pay** and **pay frequency** over planned hours. Vacation and other leave contribute zero.
- **Planned working hours** — the sum of planned durations of working shifts on the day (overnight shifts counted on their **start day**).
- **Editing session** — the period a manager spends on the schedules surface before leaving it; schedule-change notifications for staff batch at the end of that session.

Terms reused rather than redefined here: **Employee**, **Business**, **job role**, **gross pay**, **pay frequency**, **vacation allowance**, **vacation remaining**, **business currency**, **business timezone**, **base access layer**, **on duty**, and **soft delete**.

---

## 3. Capabilities

### 3.1 Day schedule is the unit of truth

- Each business has **at most one** day schedule per calendar day in the business timezone.
- Managers and above plan **in advance**. The primary management surface is a **month calendar**; opening a day edits that day's schedule (typically in a day detail). Day, week, and month views all read the same day schedules.
- An empty day (no entries) is a valid plan (for example a closed day with no staff).
- **Manager-in-charge on the plan.** Any day schedule that includes **at least one working shift** must include **at least one working shift whose job role resolves to the manager or admin base layer** (so someone is always in charge on the plan). **Supervisor** does not satisfy manager-in-charge. Saving or publishing a day that has only employee- or supervisor-layer working shifts is **blocked**.

### 3.2 Working shifts

- A working shift requires an **employee**, a **job role** from that membership's roles, and planned **start** and **end**.
- Role is **always required** on a working shift. There is no blank-role fallback on the schedule; the scheduled role is what the access-and-permissions subject uses for effective layer during that shift (subject to any membership layer override).
- One employee may hold **several** working shifts on the same day when their intervals do **not** overlap.
- A working shift may **cross midnight**. It belongs entirely to the **calendar day on which it starts** for placement, aggregates, and eligibility. The following day's schedule does not also own that interval.

### 3.3 Overlap rules

- For one employee on one calendar day, no two **working** intervals may overlap.
- A **vacation** or **other leave** entry on a day is mutually exclusive with any **working** shift for that employee on that day.
- An employee may not hold both vacation and other leave on the same day.
- Violations are rejected; they are not silently shortened.

### 3.4 Vacation and other leave

- **Vacation** and **other leave** both require planned **start** and **end** (audit and display). Neither carries a job role. Neither contributes planned labour cost or planned working hours.
- Marking **vacation** on a day decrements that membership's **vacation remaining** by **exactly one**. Removing the vacation entry restores one day. Balance is day-based, not hour-prorated.
- A change that would drive vacation remaining **below zero** is rejected.
- **Other leave** never changes vacation remaining.
- Managers and above may place vacation or other leave **directly** on the schedule without a prior employee request.

### 3.5 Day comment

- A day schedule may carry one optional **day comment**.
- Anyone who can see the day schedule may **read** the comment.
- Only managers and above may **edit** or clear it.

### 3.6 Copy day, clear day, and multi-day bulk add

- **Copy day.** A manager may copy day A onto day B. B's shift entries and day comment are **replaced** by A's. Aggregates on B are recalculated. Vacation accounting on B is re-applied (effects of B's previous vacation marks are restored, then copied vacation marks decrement remaining). Copy is rejected if any employee's remaining would go negative.
- **Clear day.** Removes all shift entries and the day comment, restores vacation remaining for any vacation marks removed, and zeros planned aggregates. The day is left with no plan.
- **Multi-day bulk add.** A manager may select several days and apply one employee configuration (working shift or leave). That entry is **added** on each selected day **beside** whatever those days already hold. Per-day overlap, exclusivity, and vacation-balance rules still apply. If any selected day would violate a rule, the **whole** bulk operation is rejected and no day is changed.

### 3.7 Planned labour cost and aggregates

Each day schedule exposes:

- count of employees with at least one **working** shift;
- count of employees with a **vacation** entry;
- sum of **planned working hours**;
- sum of **planned labour cost**.

Planned labour cost for a working shift uses that employee's **gross pay** and **pay frequency** in the business currency:

- **Hourly** — gross rate times planned hours;
- **Daily** — full daily gross for a day on which the employee has at least one working shift;
- **Weekly** — gross divided by five, attributed per working day present;
- **Monthly** — gross divided by the count of weekdays in that calendar month (business timezone), attributed per working day present.

Vacation and other leave contribute zero. Incomplete or missing gross does **not** block saving the schedule; that line's planned cost is omitted (treated as zero in the day total) until pay is complete. Actual worked cost and hours are owned by time-control.

### 3.8 Suspension and termination

When a membership becomes **Suspended** or **Terminated**, Project Imperium **removes that employee from all future day schedules** from today forward in the business timezone, restoring vacation remaining for any future vacation marks removed. Past day schedules are left unchanged for history. Managers are not asked to confirm each shift.

Suspended and Terminated memberships must not receive **new** entries (also stated by the employees subject).

### 3.9 Employee calendar and time-off requests

- An ordinary employee may **read their own** calendar (their shift entries and the day comment on days they view). They do not manage peers' schedules or see day labour aggregates as an editing surface.
- From their calendar, an employee may **request** time off: at least **vacation** and **other leave** (for example a doctor appointment), for one or more days.
- Each request is **pending** until a **manager or above** **approves** or **rejects** it, with an optional note.
- **Approval of vacation** creates or updates vacation entries on the affected day schedules and applies vacation-balance rules.
- **Approval of other leave** creates or updates other-leave entries on the affected days and does not spend vacation days.
- **Rejection** leaves the schedule unchanged.
- Managers and above may still edit the schedule directly; requests are the employee-initiated path into the same rules.

### 3.10 Schedule gating (eligibility only)

- An **employee- or supervisor-layer** person's **business mode** eligibility follows a **planned working shift**: Business on the mode toggle is available from **10 minutes before** that shift's planned start until **2 hours after** planned start. Outside that window with no open attendance session, they cannot enter business mode and must be rescheduled. Vacation and other leave do not grant business-mode eligibility.
- Opening business mode is **not** on duty. On duty begins only through time-control (daily attendance QR scan-in).
- There is **no** late-unlock step on the schedule. Lateness, late lock before scan-in, and attendance honesty belong to time-control.
- Managers, admins, and owners are never blocked from business mode by the schedule or entry window, though they still appear on the schedule for planning (and so time-control can see who was planned as management that day). **Supervisors and employees are schedule-gated** (users and access-and-permissions subjects). Suspended or Terminated membership still blocks Business (users and employees subjects).

### 3.11 Notifications this subject owns as events

Schedule events are **in-app only** — a live ping on mobile or desktop while the recipient is online, and persisted in the inbox. Delivery mechanics belong to the notifications subject.

| Event | Who is notified | When |
| --- | --- | --- |
| Schedule changed | Each employee whose entries were added, changed, or removed in the editing session | When the manager **leaves the schedules main page** — **one** batched notification per affected employee summarising how many of their entries changed |
| Time-off request pending | Managers and above for the business | When an employee submits a request |
| Time-off request decided | The requesting employee | When a manager or above approves or rejects (includes optional note) |

---

## 4. Roles and entitlements

### Base access layers

| Layer | Powers on this subject |
| --- | --- |
| **Customer** | No schedule access. |
| **Employee** | Read own calendar and day comments on viewed days; submit time-off requests; receive schedule-change and request-decision notifications. Business-app access still follows the users subject's mode rules and §3.10. |
| **Supervisor** | Same self-schedule powers as employee. Does not edit the full workforce schedule or approve time-off. Schedule-gated for Business like employee. |
| **Manager** | Everything an employee can do, plus create and edit day schedules, copy/clear/bulk-add, approve or reject time-off requests, and edit day comments. |
| **Admin** | Everything a manager can do. |

### Job roles

A working shift's job role is chosen from the employee's membership roles. That scheduled role feeds effective base-layer resolution for the shift duration (access-and-permissions subject).

### Per-user capabilities

No per-user capability gates schedule editing or time-off approval on this subject. Those actions follow the **base access layer** table above.

### Who can do what

| Activity | Who |
| --- | --- |
| View month/week/day schedule surfaces | Managers and above (full schedule); employees and supervisors (own calendar) |
| Add, edit, or remove working shifts, vacation, or other leave | Managers and above |
| Copy day, clear day, multi-day bulk add | Managers and above |
| Edit day comment | Managers and above |
| Read day comment | Anyone who can see that day |
| Submit a time-off request | The employee themself |
| Approve or reject a time-off request | Managers and above |
| Read own planned shifts | The employee themself |
| See day planned labour aggregates as management totals | Managers and above |
| Save a day that has working shifts without a manager- or admin-layer working shift | Nobody — blocked (§3.1) |
