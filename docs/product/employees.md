# Employees

> **About this document.** This is the **target-state source of truth** for employees in Project Imperium — the membership of a user in a business, job roles, employment status, HR data, and termination. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes employees as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **Employee** — the full per-venue membership that makes a person part of a business. The **User** holds only client/global identity; every employment fact lives on the membership. This subject owns:

- the **membership** — the one link between a **User** and a **Business**, and the only path into a tenant;
- **job role(s)** on that membership;
- **employment status** and tenure (join date, termination date);
- the **employment contract** — kind, quantity, period, and optional end date;
- **pay** — frequency, gross, and net in the business currency;
- **vacation** allowance and remaining balance;
- required **employee tax number** and **national ID number**;
- **HR documents** and optional **HR comments**;
- **hiring**, **editing**, **termination**, and **rehire**.

It deliberately does **not** cover:

- the global **User**, **Owner**, **Company**, credentials, sessions, customer identity, or account deletion — the users subject owns those. This subject consumes the User the membership points at.
- the **four base access layers**, **mode eligibility** (Customer | Business), and **per-user capabilities** as platform mechanisms — the users subject owns those rules. This subject supplies the membership and job roles those rules read.
- the **schedule** (daily schedule, vacation and other leave on the schedule, time-off requests, planned labour roll-ups) — the schedules subject owns it. This subject supplies the people and vacation balance the schedule consumes and updates.
- **attendance** — daily attendance QR scan-in, manager sign-out, breaks, overtime alerts, and actual labour-cost calculation — the time-control subject owns those.
- **labour and vacation KPI formulas** — the business-metrics subject owns them; reports consume the figures.
- **operational attribution** of service work (responsible employee on a tab, tips, print permissions) — each operational subject names the employee as an actor; this subject owns the membership record itself.
- **payroll preparation and export** — pay runs, tip pooling into a pay package, and accountant release — the payroll subject owns those. This subject supplies pay terms and identifiers that subject reads.

---

## 2. Domain model and vocabulary

### Entities

- **Employee** — a person's membership in one **Business**. It links exactly one **User** to exactly one venue and carries that person's job role(s), employment status, tenure, contract, pay, vacation, tax and national identifiers, documents, and HR comments. It is the **only** way a user joins a tenant. One user holds **at most one** membership per business and may hold **many** across businesses. Soft-delete applies under the platform convention.

```
User ──< Employee >── Business          (membership: the only path into a tenant)
```

### Terms this subject introduces

- **Job role** — a value from the canonical job-role list (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Operator, Employee, Cashier, Floor Staff, Bartender, Barista, Waiter, Head Chef, Sous Chef, Line Cooks, Kitchen Porter, Cleaner, Security, Host, Runner, Supervisor, Entertainer, Other). Describes *what a person is* at the venue. A membership may hold **several** job roles; the schedule selects which role the person works for a given shift.
- **Employment status** — exactly one of **Active**, **Seasonal**, **Medical absence**, **Parental leave**, **Unpaid leave**, **Suspended**, or **Terminated**. The business state of the membership.
- **Contract kind** — **Permanent** or **Seasonal**. Independent of employment status.
- **Contract period** — **Hourly**, **Monthly**, or **Yearly** — the unit for the contractual quantity of hours.
- **Contract quantity** — the number of hours committed for one contract period.
- **Contract end date** — required when contract kind is **Seasonal**; blank when **Permanent**.
- **Pay frequency** — exactly one of **Hourly**, **Daily**, **Weekly**, or **Monthly**. Unique choices; the cadence at which gross and net are expressed.
- **Gross pay** — the pre-deduction amount at the pay frequency; the figure labour-cost planning and actuals use.
- **Net pay** — the after-deduction amount at the same frequency; recorded for HR display only, never used in cost KPIs.
- **Vacation allowance** — annual vacation days granted for the calendar year in the business timezone.
- **Vacation remaining** — days still available; **taken** is allowance minus remaining.
- **Employee tax number** — the person's tax identifier for venue HR. Required. Distinct from the **Company** tax number.
- **National ID number** — the person's national identity number for venue HR. Required. In some countries it is the same value as the employee tax number; both fields are still recorded and may hold identical values.
- **HR document** — a labeled file attachment on the membership (contract, certificate, and so on). Optional; labels are free text.
- **HR comments** — optional free-text notes on the membership, visible only to managers and above.
- **Termination** — ending employment at the venue by setting status to **Terminated** and recording a termination date. The **User** and customer identity remain intact.
- **Rehire** — restoring a terminated membership at the same venue to **Active** on the **same** user–business link (never a second membership).

Terms reused rather than redefined here: **User**, **Business**, **Owner**, **Company**, **base access layer**, **per-user capability**, **business currency**, **business timezone**, **on duty**, and **soft delete**.

---

## 3. Capabilities

### 3.1 Membership is the full employee record

A person joins a venue **only** through an **Employee** membership. The **User** stays the client and global identity; it does **not** embed employment fields.

- Managers and above create a membership by linking an **existing user by sign-in email**. If no user exists for that email, Project Imperium creates the user (a customer) first, then creates the membership — the users subject owns user creation; this subject owns the membership.
- A user holds **at most one** membership per business. Rehire never creates a duplicate link.
- Soft-deleting a membership follows the platform soft-delete convention. Routine “let them go” is **termination**, not soft-delete (§3.9–§3.10).

### 3.2 Job roles on the membership

- Every membership carries **one or more job roles** from the canonical list (§2).
- Roles describe the person. The **base access layer** defaults from those roles and may be overridden by managers and above; the **users** subject owns how layers and mode eligibility resolve from membership and shift role. This subject owns assigning and storing the roles on the membership.

### 3.3 Employment status

Exactly one status applies at a time:

| Status | Meaning |
| --- | --- |
| **Active** | Employed and ordinarily eligible to work. |
| **Seasonal** | Employed on a seasonal footing; membership remains. |
| **Medical absence** | Away for medical reasons; membership remains. |
| **Parental leave** | Away for parental leave; membership remains. |
| **Unpaid leave** | Away unpaid; membership remains. |
| **Suspended** | Membership remains, but **business-app access is blocked** until a manager or above clears the suspension. |
| **Terminated** | Employment at this venue has ended; access through this membership is gone. The user and customer identity stay. |

- **Active**, **Seasonal**, **Medical absence**, **Parental leave**, and **Unpaid leave** may still appear on the **schedule** when the venue chooses (for example a return shift, or vacation during leave).
- **Suspended** and **Terminated** must **not** be added to **new** shifts. The schedules subject **removes** that employee from **future** day schedules (today forward) and restores vacation remaining for any future vacation marks stripped; past days stay for history.
- Status changes are recorded by managers and above (termination and rehire follow §3.9–§3.10).

### 3.4 Join date and required hiring fields

Creating a membership for hired staff requires:

- at least one **job role**;
- an **employment status**;
- a **join date**;
- **contract kind**, and a **contract end date** when kind is Seasonal;
- **contract quantity** and **contract period**;
- **pay frequency**, **gross pay**, and **net pay**;
- **vacation allowance** (remaining defaults to the allowance);
- **employee tax number** and **national ID number**.

**HR documents** and **HR comments** are optional at create and afterward.

When a user **registers a business**, Project Imperium creates the owner's membership with the **Owner** job role, **Active** status, and **join date** now. The owner **completes the remaining required HR fields** afterward. Incomplete owner HR is allowed operationally; labour and vacation figures stay incomplete until filled. Incomplete owner HR is **not** a go-live checklist item (business subject).

### 3.5 Employment contract

- **Contract kind** is **Permanent** or **Seasonal**.
- **Permanent** contracts leave the **contract end date blank**.
- **Seasonal** contracts **require** a contract end date on or after the join date.
- Contract kind is **independent** of employment status (for example Active on a seasonal contract, or Seasonal status on a permanent contract).
- Reaching the contract end date does **not** change status automatically. Managers and above **terminate**, **extend** (new end date), or otherwise act deliberately.
- **Contract quantity** plus **contract period** (**Hourly**, **Monthly**, or **Yearly**) state the committed hours. They are the planned-hours reference for reporting and overtime context. They are **not** a hard scheduler block — the venue may still schedule more or less; alerts belong to schedules and time-control.

### 3.6 Pay

- **Pay frequency** is exactly one of **Hourly**, **Daily**, **Weekly**, or **Monthly** — unique choices.
- **Gross** and **net** are amounts at that frequency, always in the **business currency**.
- **Gross** drives labour-cost planning and actuals (consumed by schedules, time-control, metrics, and reports).
- **Net** is HR-facing only and never enters cost KPIs.
- Pay frequency and contract period are **related but separate**: they need not match (for example monthly pay with a yearly contract-hours total).

### 3.7 Vacation

- Each membership holds an **annual vacation allowance** (days per calendar year in the business timezone) and a **remaining** balance.
- **Taken** days equal allowance minus remaining.
- The **schedule** is the write path that reduces remaining when vacation is marked on the schedule.
- At each **calendar-year** boundary in the business timezone, the allowance resets for the new year and **remaining returns to the full allowance**. Unused days **do not roll over**.

### 3.8 Identifiers, documents, and comments

- **Employee tax number** and **national ID number** are both **required**. They are venue HR fields on the membership, never customer-profile fields on the User, and never the Company's tax number.
- Where local practice uses one number for both tax and national identity, the two fields may hold the **same value**; both are still stored.
- **HR documents** are labeled file attachments managed by managers and above. There is no fixed document-type catalogue — labels are free text. Retention follows soft-delete rules when the membership is soft-deleted.
- **HR comments** are optional free-text notes, managers and above only.

### 3.9 Termination

- Managers and above **terminate** a membership by setting status to **Terminated** and recording a **termination date** on or after the join date.
- Termination **ends access** through that membership. The **User** and customer identity are untouched.
- Termination is the ordinary end of employment. It is **not** soft-delete.

### 3.10 Rehire

- Only an **admin or owner** may **rehire**.
- Rehire restores the **same** user–business membership: status returns to **Active**, the termination date is cleared, and the admin or owner may set a **new join date**. HR fields become editable again under the same rules as any active membership.
- A second membership for the same user at the same business is never created.

### 3.11 Self-view

An ordinary employee may read **their own** job roles, employment status, join date, contract kind and hours (quantity, period, end date when set), vacation allowance and remaining, and their HR documents.

They must **not** see **gross or net pay**, **employee tax number**, **national ID number**, or **HR comments**.

### 3.12 Soft delete

Under the platform soft-delete convention, an Employee membership is never hard-deleted. Soft-delete is the retention marker for the platform delete/reactivate path — **not** a substitute for **Terminated**. Day-to-day separation uses termination (§3.9).

---

## 4. Roles and entitlements

### Base access layers

| Layer | Powers on this subject |
| --- | --- |
| **Customer** | No employee-record access. |
| **Employee** | Self-view of non-sensitive own HR (§3.11). Business-app access still follows the users subject's mode and schedule rules. |
| **Manager** | Everything an employee can do, plus create and edit memberships, assign job roles, change status (including Suspended), edit all HR fields, upload or remove documents, and terminate. |
| **Admin** | Everything a manager can do, plus **rehire**. The owning user is admin at every venue they own. |

### Job roles

Job roles live on the membership and feed the base-layer defaults the users subject resolves. Assignable by managers and above.

### Per-user capabilities

No per-user capability gates hiring, HR editing, termination, or rehire on this subject. Those actions follow the **base access layer** table above. Cross-cutting capabilities remain a users-subject mechanism; other feature subjects may still grant capabilities that name an employee as an actor.

### Who can do what

| Activity | Who |
| --- | --- |
| Create or link a membership (hire) | Managers and above |
| Edit job roles, status, contract, pay, vacation, tax/national ID, documents, comments | Managers and above |
| Terminate | Managers and above |
| Clear a suspension | Managers and above |
| Rehire | Admin or owner |
| Read own non-sensitive HR | The employee themself |
| Read salary, tax/national ID, or HR comments | Managers and above |
| Complete remaining HR on the owner membership after registration | The owner (admin) at that venue |
