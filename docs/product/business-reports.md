# Business reports

> **About this document.** This is the **target-state source of truth** for the weekly and monthly business reports of a venue in Project Imperium. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes business reports as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **how a venue's numbers are gathered, grouped, closed, and presented over the reporting week and the calendar month**. It owns:

- the **weekly business report** — the reporting week's operational roll-up of closed daily sales reports, with actual labour and operational target comparison;
- the **monthly business report** — the month's full statement: a sales section plus the full P&L (fixed and extra cost, finance costs, inventory variance and waste, purchasing, actual labour, break-even, net profit, EBITDA);
- the **report periods and their boundaries** — the reporting week and the calendar month, in the venue's timezone (the work day belongs to the sales-reports subject);
- the **live mid-period roll-up** — managers may view the week or month so far before it closes;
- the **dimension breakdowns** on weekly and monthly reports;
- the **target-vs-actual comparison** for the periods this subject presents;
- the **weekly and monthly report lifecycle** — aggregation, close, amendment from an edited daily, and inventory-tied reopen of the monthly report;
- **platform commission finalisation** at weekly close (and handing the owed amount to platform-billing for collection);
- the **report-ready signal** when a weekly or monthly report closes;
- **download/export** of the entire weekly or monthly report.

It deliberately does **not** cover:

- the **daily sales report** — opening, buckets, close, reopen, edited flags, and fulfilment sweep — the sales-reports subject owns those; this subject **consumes closed dailies** (and the current live day when showing a mid-period view);
- the **definition, units, formulas, dimensions, and benchmarks of the metrics themselves**, nor the cost targets and waste thresholds — the business-metrics subject owns those; this subject presents them;
- the **derivation of inventory variance and waste** — the inventories subject owns how usage, deviation, variance, and waste are computed; this subject presents them in the monthly report only;
- **actual labour cost and worked hours** as attendance facts — the time-control subject owns those; this subject presents them on weekly and monthly reports;
- the **raw sales, order, payment, and stock data** the reports are built from — the orders, payments-and-tax, and inventories subjects own those;
- the **plan catalogue and base commission rates** — the monetization and superadmin subjects own those; this subject applies them at weekly close;
- **how platform charges are taken** (payment method, invoice, retries, billing documents, dunning) — the platform-billing subject owns collection; this subject finalises the owed weekly amount and signals re-finalise adjustments;
- the **delivery of notifications** — the notifications subject owns inbox, email, and push; this subject only raises the report-ready signal;
- **how reports are laid out on screen** (tabs, charts, table chrome) — outside this subject; export of the whole report is in scope.

---

## 2. Domain model and vocabulary

### Entities

- **Weekly business report** — one venue's report for one **reporting week**. It is the operational performance package: sales, COGS and labour actuals, operational targets, and dimension breakdowns. It is also the period at which **platform commission** is finalised and marked owed for platform-billing to collect.
- **Monthly business report** — one venue's report for one **calendar month**. It has a **sales section** and a **full P&L section** (costs, inventory, purchasing, finance, profitability). It is the venue's fullest statement of the month.
- **Reporting week** — the seven-day window defined by the venue's **reporting-week start day**. It groups daily sales reports into the weekly report.
- **Report period** — the window a weekly or monthly report covers: a **reporting week** or a **calendar month**.
- **Dimension breakdown** — a period's metric sliced by one of the standard dimensions (for example, sales by daypart).
- **Target comparison** — the comparison of a configured **target** or **waste threshold** against its **actual** for the period, with the delta and whether it is over or under.
- **Report-ready signal** — the event that a weekly or monthly report has **closed** and is ready for review.

### Terms this subject introduces

- **Report state** — where a weekly or monthly report is in its lifecycle: **open** (live mid-period roll-up, still accepting further closed dailies and inputs) or **closed** (frozen for the period, except when amended from an edited daily or when the monthly report is reopened with the inventory month — §3.8).
- **Close** — lock the weekly or monthly report for its period under the rules in §3.8.
- **Live mid-period roll-up** — the open weekly or monthly report as viewed during the period: whatever belonging dailies are already closed, plus the current live work day's sales figures when the viewer asks for the period so far.
- **Commissionable sales** — the paid product sales volume that commission is calculated on for a reporting week: paid sales after voids and refunds across **every payment method** (cash, card, crypto, gift card tender, and the rest). **Invitations** (comps), gift-card **deposit intake** (paid or granted issue), **forfeitures**, **tips**, and any other activity with no paid product sale are **excluded**.
- **Weekly commission** — the platform fee for one reporting week: **base plan rate × commissionable sales** (tips excluded from the base). It is **finalised and owed** when the weekly report **closes**; **collection** belongs to platform-billing.
- **Amendment from edited daily** — when a closed daily sales report is reopened, changed through its bills or payments, and closed again, any closed weekly or monthly report that included that day is recalculated automatically, stays closed, carries the daily's reopen reason, and shows it was updated from an edited daily; the week's commission is **re-finalised** if that week is already closed (platform-billing then adjusts the collected amount).

Terms reused from other subjects rather than redefined here: **business**, **daily sales report**, **work day**, **edited flag**, **reopen reason**, **reporting-week start day**, **total sales**, **net revenue**, **cost of goods sold**, **prime cost**, **labour cost**, **fixed cost**, **extra cost**, **finance costs**, **target**, **waste threshold**, **benchmark**, **dimension**, **daypart**, **channel**, **sales point**, **sales instance**, **order**, **inventory month**, **monthly resume**, and the metric names defined by the business-metrics subject.

---

## 3. Capabilities

### 3.1 Inputs from the daily sales report and the live day

- Weekly and monthly reports are built from **closed daily sales reports** owned by the sales-reports subject.
- While a period is **open**, a manager viewing the live roll-up also sees the **current live work day's** sales figures folded into the period so far (the sales-reports subject owns that day's continuous recalculation).
- This subject does not open, close, or reopen a daily report; it aggregates what that subject has locked (and re-aggregates when that subject amends a day — §3.8).

### 3.2 The weekly business report

- The weekly business report aggregates the **closed daily sales reports** that fall in the venue's **reporting week**, plus the live current day when viewed mid-period.
- It is an **operational performance** package, not a full P&L:
  - **sales** and related operational figures (covers, average spend, tips, payment methods, goods sold/voided/invited, channel and other dimension breakdowns);
  - **actual labour** cost and hours from time-control;
  - comparison of **food**, **beverage**, and **labour** cost targets against actuals (§3.7);
  - **excludes fixed cost, extra cost, and finance costs**;
  - **excludes inventory variance and waste**, **waste-threshold comparison**, and **purchasing** totals (those are monthly).
- It carries the **full dimension set** as breakdowns (§3.6), except the inventory-only slices (supplier good, supplier) which appear on the monthly report.
- While **open**, it may show a **week-to-date commission estimate** (same base as §3.9). On **close** it **finalises** commission and marks it owed for platform-billing to collect (§3.9).
- When the week **closes**, Project Imperium raises the **report-ready signal**.
- The entire weekly report can be **downloaded/exported**.

### 3.3 The monthly business report

- The monthly business report aggregates the month's **closed daily sales reports** (and the live current day when viewed mid-period) and is presented in two parts:
  - a **sales section** — the month's sales roll-up and sales-oriented breakdowns;
  - a **full P&L section** — everything needed for monthly profitability.
- The full P&L adds what is only known or entered monthly:
  - **fixed and extra operating cost**, and the month's **finance costs** (interest, income tax, depreciation, and amortisation) that feed net profit and EBITDA;
  - **inventory variance and waste**, taken from the closed inventory month;
  - **purchasing** totals for the calendar month (received/completed purchase spend as the purchases subject defines them);
  - **actual labour** cost for the month from time-control;
  - **break-even**, **net profit**, **EBITDA**, and the metrics comparison.
- It compares **targets vs actuals** across **food, beverage, labour, and fixed cost** and the **waste thresholds**.
- It carries the **full dimension set** as breakdowns (§3.6), including the inventory dimensions **supplier good** and **supplier**.
- It **sums the finalised weekly commission charges** for reporting weeks that **closed in that calendar month**; it does **not** create a separate monthly commission event.
- When the month **closes**, Project Imperium raises the **report-ready signal**.
- The entire monthly report can be **downloaded/exported**.

### 3.4 Fixed, extra, and finance cost entry

- **Managers and above** enter and edit **fixed cost**, **extra cost**, and **finance costs** on the monthly business report.
- These are **monthly report inputs**. Missing values are treated as **zero**; empty fields do not block close.
- Cost entry is part of the monthly report's content; screen layout (for example separate tabs) is outside this subject.

### 3.5 Report periods and boundaries

- Weekly and monthly reports exist at **two periods only** at this subject: the **reporting week** and the **calendar month**. The **work day** belongs to the sales-reports subject. There is no yearly report and no custom date range.
- All boundaries are interpreted in the **venue's timezone**, not the server's or the viewer's.
- The **reporting week** begins on the venue's **reporting-week start day**; it does not change the **calendar month** used by the monthly report.
- **Money is shown in the venue's currency**.

### 3.6 Dimension breakdowns

- Every period's metrics may be sliced by the **standard dimensions** defined by the business-metrics subject: category/subcategory, menu item, supplier good, supplier, employee, sales point/channel, daypart, table/seat, payment method, and promotion.
- Breakdowns are **first-class report content**:
  - the **weekly** report carries the operational full set (without requiring inventory supplier slices);
  - the **monthly** report carries the **full dimension set**, including **supplier good** and **supplier**;
  - the **daily** operational breakdown set is owned by the sales-reports subject.
- A breakdown over a dimension with **no activity** produces **no value**; Project Imperium never fabricates a zero.

### 3.7 Target and benchmark comparison

- For each **configured target** (and, on the **monthly** report, each **waste threshold**), the report records the **target**, the **actual**, the **delta**, and whether the metric is **over** or **under** target.
- **Weekly** compares **food**, **beverage**, and **labour** targets only. **Monthly** compares **all four cost targets** plus the **waste thresholds**.
- The comparison is **derived** and **report-owned**; it is computed when the report is aggregated and kept with the report. Nobody edits the comparison by hand.
- Each KPI is also shown against its **benchmark** where one exists. A benchmark is **reference only** — it is displayed beside the actual and is never policed, alerted on, or configured.
- A target that has not been set is not compared.
- Daily sales reports do not carry this comparison; it is weekly and monthly only.

### 3.8 Closing, live roll-up, and amendment

- While a reporting week or calendar month is in progress, the report stays **open** as a **live mid-period roll-up**. Managers may view it at any time.
- A weekly report **closes** when both are true:
  - the **reporting week has ended** in the venue's timezone; and
  - every **daily sales report that belongs to that week** is **closed**, or **never existed** because that work day had no sales instance.
- A monthly report **closes** when all are true:
  - the **calendar month has ended** in the venue's timezone;
  - every **daily sales report that belongs to that month** is **closed** or never existed; and
  - the **inventory month is closed**.
- Close does **not** fire at clock midnight while a belonging **work day is still open** (late service past midnight). The period waits for that work day to close. A gap day with no sales instance does not block.
- **Reopening the inventory month** (general manager, inventories subject) **reopens the monthly business report with it**; the report closes again when the inventory month closes again. Weekly reports are **not** affected by inventory reopen.
- When a **closed daily sales report** is reopened, changed through its bills or payments, and closed again (sales-reports subject):
  - any weekly or monthly report that already included that day is **automatically recalculated**;
  - those roll-ups **remain closed** (amended closed records);
  - they **carry the same reopen reason** and show they were **updated from an edited daily**;
  - if a **closed weekly** report is among them, its **weekly commission is re-finalised** and platform-billing is signalled to adjust the collected amount to match (§3.9).
- A change to the reporting-week start day still affects only open or future weeks; it does not by itself rewrite closed history. Amendment from an edited daily is the deliberate exception above.
- Fixed, extra, and finance inputs do **not** gate monthly close (zeros allowed — §3.4).

### 3.9 Platform commission at weekly close

- **Commissionable sales** for a reporting week are **paid product sales after voids and refunds** across **all payment methods** (cash, card, crypto, gift card tender at redemption, and any other recorded method). **Invitations**, gift-card **deposit intake**, **forfeitures**, **tips**, and other unpaid activity are **not** in the base.
- Until weekly close, commission is **estimate only**: the daily sales report shows a **day-level estimate**, and an **open** weekly report may show a **week-to-date estimate**. Neither estimate is charged.
- When the weekly report **closes**, Project Imperium:
  - **finalises** the **weekly commission** as base rate × commissionable sales;
  - marks it **owed** on the **Business** (weekly commission is a venue debt); and
  - hands that owed amount to **platform-billing** for collection as a weekly fee line — never netted out of what the venue's customers paid, and never skimmed from the diner Stripe payment.
- The rates are **fixed by the subscription plan / catalogue** and are not editable on the report.
- After an edited-daily amendment, approved refund, or card dispute that changes commissionable sales on a closed week, commission is **re-finalised** and platform-billing adjusts the collected amount to match.
- The monthly report **sums** the finalised weekly commission charges for weeks that **closed in that month**; it does not charge commission again.

### 3.10 Report-ready signalling

- When a **weekly** or **monthly** report **closes**, Project Imperium raises the **report-ready signal**.
- The signal names the report and its period. **How it is delivered** — in-app, email, or push — belongs to the notifications subject; this subject only raises it.
- There is no report-ready signal for the daily sales report, and none while a week or month is still the open live roll-up.

### 3.11 Export

- Managers and above (and employees granted view access) can **download/export the entire** weekly or monthly report, including the monthly cost inputs and comparisons.
- Export format and on-screen layout are outside this subject; the capability to take the whole report away is in scope.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Business-reports powers |
| --- | --- |
| **Customer** | None. |
| **Employee** | None by default; may be granted a capability to view a report (see below). |
| **Manager** | Views weekly and monthly reports and breakdowns; enters fixed, extra, and finance costs on the monthly report; exports reports. Closing the daily sales report (which feeds these roll-ups) belongs to the sales-reports subject. |
| **Admin** | Everything a manager can do, plus full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| View the weekly and monthly reports and their breakdowns | Managers and above; employees with the granted capability |
| Enter or edit fixed, extra, and finance costs on the monthly report | Managers and above |
| Download/export the weekly or monthly report | Whoever may view that report |
| Close a weekly or monthly report | Automatic under §3.8 — not a manual manager action |
| Reopen the monthly report | Tied to the inventory month: the general manager's inventory reopen reopens it (the inventories subject's rule) |
| View targets, benchmarks, and the target comparison | Whoever may view the weekly or monthly report |
| View commission estimate / finalised weekly commission | Whoever may view the weekly report |

Reporting at week and month is a management review act; the managers who own cost control and inventory closure also own reading these roll-ups and entering monthly costs, consistent with the business-metrics and inventories subjects.
