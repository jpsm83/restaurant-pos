# Payroll

> **About this document.** This is the **target-state source of truth** for payroll preparation and export in Project Imperium — pay periods, earnings assembled from attendance and pay terms, tip pooling, release to an external accountant or payroll provider, and versioned re-export. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes payroll as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **payroll preparation and export** — turning a venue's scheduled and recorded attendance, employee pay terms, and tips into a pay-period package an external accountant or payroll provider can consume. This subject owns:

- the **pay period** and venue **payroll configuration** (cadence and boundaries, accountant contact, tip-pool policy);
- the **pay run** for one business and one pay period — its draft assembly, **release**, immutable **export versions**, and CSV package;
- **earnings lines** derived from **closed shift sessions** and each employee's **gross pay** and **pay frequency**;
- **tip pooling and distribution** into the pay run (and pass-through when pooling is off);
- **release** to the configured accountant (email with CSV) and download of any released version;
- **versioned recalculation** when upstream attendance, tips, pay terms, or tip policy change after a release.

It deliberately does **not** cover:

- **payroll processing** — tax withholding, statutory deductions, filings, payslips as legal artifacts, bank disbursement, or becoming the venue's payroll processor. Project Imperium prepares inputs only; the external accountant or payroll provider pays people and remits taxes.
- the **Employee** membership, contract, and pay terms as HR records — the employees subject owns those. This subject reads gross, net, pay frequency, tax and national identifiers, and job roles for assembly and export.
- the **schedule** (working shifts, vacation, other leave) — the schedules subject owns the plan. Managers correct plan and related facts there; this subject never invents hours on the pay run.
- **attendance** — time-clock ledger, shift sessions, breaks, worked hours, overtime detection, corrections — the time-control subject owns those. This subject consumes closed sessions.
- **tips at settlement** and tip tax rates — the payments-and-tax subject owns taking and attributing tips on payments. This subject pools and packages tip amounts for the pay run.
- **labour KPI formulas** and weekly or monthly business-report roll-ups — the business-metrics and business-reports subjects own those. Pay periods are independent of the reporting week.
- **notification delivery and email mechanics** — the notifications and emails subjects own inbox, push, and send/retry. This subject defines which payroll events fire and what the accountant package contains.
- **platform subscription or commission** — unrelated to venue staff pay.

---

## 2. Domain model and vocabulary

### Entities

- **Pay period** — a contiguous span of calendar time in the **business timezone**, bounded by the venue's configured payroll cadence, for which one **Business** prepares staff pay inputs.
- **Pay run** — the assembled payroll-preparation package for exactly one **Business** and one **pay period**. It holds live **draft** figures until a manager **releases** a version; each release produces an immutable **export version**.
- **Export version** — one released snapshot of a pay run (CSV package and metadata). Later source changes never mutate a prior version; they create a new draft that can be released as the next version.
- **Tip-pool policy** — the venue's rules for which job roles contribute tips, which receive them, and how redistributed amounts are split. Optional; when off, attributed tips pass through.

```
Business ──< Pay period >── Pay run ──< Export version >
                └── Tip-pool policy (venue configuration)
Pay run ── assembles ← closed Shift sessions, Employee pay terms, Tips
```

### Terms this subject introduces

- **Payroll configuration** — venue settings owned by this subject: pay-period cadence and boundaries, **accountant contact**, and **tip-pool policy**.
- **Accountant contact** — the external recipient for released packages: display name, email, and optional firm name and phone. Not necessarily a User on the platform.
- **Draft pay run** — the live, recalculating assembly for a period before or between releases. Figures follow upstream sources; managers do not edit amounts on the pay run.
- **Release** — the manager action that freezes the current assembly into a new **export version**, generates the CSV, and emails it to the accountant contact. Release does not edit figures; it only ships what the sources already say.
- **Earnings line** — per-employee wage inputs for the period: worked hours (break-aware), overtime hours (informational for the provider), and a wage amount derived from **gross pay** and **pay frequency** over those worked hours, using the same frequency family as planned and actual labour cost on the schedules and time-control subjects.
- **Tip line** — per-employee tip amounts for the period: **pre-pool** (attributed) and **post-pool** (after tip-pool policy), in the business currency.
- **Tip-pool day** — one business-timezone calendar day whose platform-recorded tips and that day's recipient hours feed one pool calculation.
- **House tip input** — platform-recorded tips from **self-service** payments (no staff taker); they enter that day's pool with no employee owner when pooling is on.
- **Incomplete pay flag** — marks an employee on the run whose gross or pay frequency is missing or incomplete: hours and tips still appear; the wage earnings amount is omitted until pay terms are complete.
- **Changelog** — with a replacement export version, the summary of what changed versus the prior released version (hours, tips, pay terms, included employees, and similar package fields) and an explicit reference to the version it replaces.

Terms reused rather than redefined here: **Business**, **Employee**, **job role**, **gross pay**, **net pay**, **pay frequency**, **shift session**, **worked hours**, **overtime**, **tip**, **business currency**, **business timezone**, **base access layer**, and **managers and above**.

### Pay run status

A pay run is viewed as:

| Status | Meaning |
| --- | --- |
| **Waiting** | Period ended (or assembly started) but at least one shift session that **started inside the period** is still open — overnight or otherwise. |
| **Draft** | Assembly is live and Release is allowed (no blocking open in-period sessions). |
| **Released** | At least one export version has been sent; the live assembly may already differ if sources changed (a new draft version pending Release). |

---

## 3. Capabilities

### 3.1 Preparation and export only

- Project Imperium **prepares and exports** payroll inputs. It does **not** withhold taxes, compute statutory deductions, file returns, print legal payslips, or disburse wages.
- Every released package is explicitly for an **external accountant or payroll provider**. Remittance and payment of staff remain the venue's and that provider's duty.
- There are **no adjustment lines** on a pay run. Corrections happen only by changing upstream sources: schedule and time-control (attendance corrections), employee pay terms, recorded tips, or tip-pool policy.

### 3.2 One pay run per business

- A pay run belongs to exactly one **Business** (venue). Multi-venue owners prepare and release **per venue**.
- Pay periods and tip-pool policy are **per business**, not Company- or Owner-wide.

### 3.3 Payroll configuration

Admin or owner sets, on the venue:

- **Pay-period cadence and boundaries** in the business timezone (for example weekly, biweekly, or monthly spans the venue chooses). These periods are **independent** of the reporting week used for business reports and platform commission.
- **Accountant contact** — display name, email, optional firm and phone.
- **Tip-pool policy** — on or off, contributor roles, recipient roles, and hours-weighted split (§3.6).

Managers do not change payroll configuration; they release packages under it.

### 3.4 Overnight sessions and period membership

- A **shift session** belongs to the **pay period that contains its sign-in**, in the business timezone — matching overnight belonging on the schedules and time-control subjects (the day and period work **began**).
- Hours are never split across two pay runs. A night shift that starts before the period ends and signs out after the period's calendar end still counts entirely in the start period once closed.
- While any session that **started inside the period** remains open, the pay run stays **Waiting** and **Release is blocked**.

### 3.5 Draft assembly

- When a configured pay period ends, Project Imperium **opens a draft pay run** for that business and period (or keeps it **Waiting** until in-period-started sessions close).
- The draft **recalculates continuously** from:
  - **closed** shift sessions whose sign-in falls in the period — worked hours (break hours setting applied), overtime hours, and wage earnings from each employee's **gross pay** and **pay frequency**;
  - platform-recorded **tips** in the period, after tip-pool policy for each tip-pool day;
  - the current employee identity and pay-terms snapshot used for export columns.
- **Planned** schedule hours alone never create earnings. Absence (no-show) with no session contributes no hours.
- Employees with closed work or tip lines in the period appear on the run even if later **Terminated**; membership status does not erase period actuals.
- **Incomplete pay** does not block assembly or Release: the employee stays on the run with hours and tips, wage amount omitted, and an **incomplete pay flag** for the accountant.

### 3.6 Tip pooling

- When the tip-pool policy is **off**, each staff member's **attributed** platform tips for the period pass through as their tip line (pre-pool equals post-pool). **Self-service** tips (no staff taker) do not appear on any employee tip line; the package carries them as a single venue **house tip total** for the period so they are not lost.
- When **on**, each **tip-pool day** in the period:
  - **Contributors** — job roles configured to contribute; staff-taken tips attributed to employees in those roles that day enter the pool.
  - **House tip input** — self-service tips that day enter the pool with no employee owner.
  - **Recipients** — job roles configured to receive; the day's pool is split among recipient employees **in proportion to worked hours** from sessions that **started that day**.
  - Pre-pool (attributed) and post-pool amounts are both retained for the package and for staff self-view.
- Only **platform-recorded** tips participate. Cash tips handed to staff away from the platform are out of scope (payments-and-tax).
- Tip-pool math is **automatic** as sessions and tips settle. There is no separate tip-day approval. The only send gate is **Release** on the pay run (§3.7).
- Changing tip-pool policy or upstream tips recalculates the draft (and may create a new version after a prior release — §3.8).

### 3.7 Release and CSV export

- **Managers and above** review the draft (read-only amounts) and **Release** when allowed.
- Release:
  - creates a new immutable **export version**;
  - generates the **CSV** package;
  - **emails** that package to the configured accountant contact (best-effort; failure does not undo the release — the version remains downloadable);
  - leaves the version available for download anytime afterward.
- The CSV includes, for each employee on the run at least: name, **employee tax number**, **national ID number**, pay-terms snapshot (pay frequency, gross, net), worked hours, overtime hours, wage earnings (or incomplete-pay flag), pre-pool and post-pool tips, plus run metadata (business, period bounds, version identity, changelog when replacing a prior version, and the venue house tip total when pooling is off).
- The committed export handoff is the **CSV** attached to the accountant email and available for download after Release.

### 3.8 Versions after a release

- A released **export version** never changes.
- If upstream sources change after a release (attendance correction, tip or payment edit, pay-terms edit, tip-pool policy change, and so on), Project Imperium **recalculates** a new draft version and **notifies the venue's managers and above**.
- Managers **Release again** to email the accountant the replacement package. The new version carries a **changelog** and an explicit reference to the **prior version it replaces**.
- Project Imperium does **not** auto-email the accountant on recalculation alone — only on Release.

### 3.9 Self-view

An ordinary employee may see **their own** worked hours, overtime hours, and **post-pool** tips for a pay period once the draft exists.

They must **not** see other employees' lines, wage amounts (own or others'), pre-pool tip breakdowns for the venue, full pay-run CSVs, or accountant contact details.

### 3.10 Borders with reporting

- Pay periods are **not** required to align with daily sales-report close or with the reporting week.
- Labour and tip figures in business and sales reports remain owned by those subjects; this subject does not redefine KPI formulas.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Powers on this subject |
| --- | --- |
| **Customer** | No payroll access. |
| **Employee** | Self-view of own period hours and tip lines (§3.9). |
| **Supervisor** | Same self-view as employee. No Release and no payroll configuration. |
| **Manager** | Everything an employee can do, plus review drafts, **Release** (and re-Release), and download any export version for the venue. |
| **Admin** | Everything a manager can do, plus edit **payroll configuration** (pay periods, accountant contact, tip-pool policy). The owning user is admin at every venue they own. |

### Job roles

Job roles on the membership feed tip-pool contributor and recipient sets. Assigning roles remains an employees-subject concern; this subject only reads them for pooling.

### Per-user capabilities

No per-user capability gates payroll configuration or Release. Those actions follow the **base access layer** table above.

### Who can do what

| Activity | Who |
| --- | --- |
| Configure pay periods, accountant contact, tip-pool policy | Admin or owner |
| Review draft pay run | Managers and above |
| Release / re-Release (email CSV to accountant) | Managers and above |
| Download a released export version | Managers and above |
| See own hours and post-pool tips for a period | The employee themself |
| Edit amounts on the pay run | No one — fix upstream sources instead |
| Receive accountant package email | The configured accountant contact |
| Receive “version recalculated after release” notice | Managers and above |
