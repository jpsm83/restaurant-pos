# Business reports

> **About this document.** This is the **target-state source of truth** for the business reports of a venue in Project Imperium. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes business reports as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **how a venue's numbers are gathered, grouped, closed, and presented over time**. It owns:

- the **daily sales report** — the day's report, opened on the first sale, calculated, reconciled, and closed;
- the **weekly business report** — the reporting week's aggregation of daily reports, focused on operational performance;
- the **monthly business report** — the month's aggregation, adding fixed and extra cost, inventory variance and waste, purchasing, and labour;
- the **report periods and their boundaries** — the day, the reporting week, and the calendar month, interpreted in the venue's timezone;
- the **report buckets** — how a period's activity is grouped;
- the **dimension breakdowns** — how a period's metrics are sliced by the standard dimensions;
- the **target-vs-actual comparison** — the comparison of each configured target and waste threshold against its actual;
- the **report lifecycle** — calculation, reconciliation, closing, and reopening;
- the **report-ready signal** — the event that a weekly or monthly report is ready for review.

It deliberately does **not** cover:

- the **definition, units, formulas, dimensions, and benchmarks of the metrics themselves**, nor the cost targets and waste thresholds — the business-metrics subject owns those; this subject presents them;
- the **derivation of inventory variance and waste** — the inventories subject owns how usage, deviation, variance, and waste are computed; this subject presents them in the monthly report;
- the **raw sales, order, payment, labour, and stock data** the reports are built from — the orders, payments, time-control, and inventories subjects own those;
- the **delivery of notifications** — the notifications subject owns inbox, email, and push; this subject only raises the report-ready signal;
- **report exports and the table engine** used to render them — the shared presentation layer owns those.

---

## 2. Domain model and vocabulary

### Entities

- **Daily sales report** — one venue's report for one calendar day, in the venue's timezone. It is opened automatically by the **first sale of the day** and accumulates that day's activity. It is closed by a manager, which locks the day.
- **Weekly business report** — one venue's report for one **reporting week**, built by aggregating that week's closed daily reports. It focuses on operational performance.
- **Monthly business report** — one venue's report for one **calendar month**, built by aggregating that month's daily reports and adding the costs and inventory figures that are only known monthly. It is the venue's fullest statement of profitability.
- **Reporting week** — the seven-day window defined by the venue's **reporting-week start day**. It groups daily reports into the weekly report.
- **Report period** — the window a report covers: a **day**, a **reporting week**, or a **calendar month**.
- **Bucket** — a group a period's activity is accumulated into (for example, an employee's sales, or the delivery channel's sales).
- **Dimension breakdown** — a period's metric sliced by one of the standard dimensions (for example, sales by daypart).
- **Target comparison** — the comparison of a configured **target** or **waste threshold** against its **actual** for the period, with the delta and whether it is over or under.
- **Report-ready signal** — the event that a weekly or monthly report has been aggregated and is ready for review.

### Terms this subject introduces

- **Report state** — where a report is in its lifecycle: **open**, **calculated**, **reconciled**, or **closed**.
- **Calculate** — compute the report's totals from the period's activity.
- **Reconcile** — review the computed totals and confirm they are correct before closing.
- **Close** — lock the report. A closed report is the venue's frozen record of the period and is not re-computed.
- **Reopen** — undo a close so the period can be corrected, under the rules in §3.7.
- **Business totals** — a report's whole-venue figures, as distinct from its per-bucket and per-dimension figures.

Terms reused from other subjects rather than redefined here: **business**, **reporting-week start day**, **total sales**, **net revenue**, **cost of goods sold**, **prime cost**, **target**, **waste threshold**, **benchmark**, **dimension**, **daypart**, **channel**, **sales point**, **sales instance**, **order**, and the metric names defined by the business-metrics subject.

---

## 3. Capabilities

### 3.1 The daily sales report

- The daily sales report **opens automatically on the first sale of the day**. There is one daily report per venue per calendar day, in the venue's timezone.
- It accumulates the day's activity into **buckets** and computes the venue's **business totals**:
  - **per-employee** buckets — each employee's sales, tips, goods sold, voided, and invited, and their payment-method breakdown;
  - the **delivery** channel bucket — the day's delivery sales, tips, goods, and payment methods;
  - the **self-ordering** and **kiosk** buckets — sales taken through self-ordering and kiosk, by point;
  - the **business totals** — total sales, net revenue, tips, cost of goods sold, profit, customers served, average spend per customer, void and invited value, and the platform's commission.
- The daily report's **dimension breakdowns** are the operational ones: **employee**, **sales point/channel**, **payment method**, and **menu item**.
- A manager **calculates** the report, **reconciles** it, and **closes** it.
- **Closing requires no open orders**: a sales instance that is still open blocks closure. Closing **locks the day** — the closed daily report is the frozen record of that day.
- The first sale of a new day opens that day's report; it does not disturb a prior day's closed report.

### 3.2 The weekly business report

- The weekly business report aggregates the **closed daily reports** that fall in the venue's **reporting week**.
- It is focused on **operational performance**: it presents the operational cost targets — **food**, **beverage**, and **labour** — and the waste thresholds, and **excludes fixed and extra cost**, which are only known monthly.
- It carries the **full dimension set** as breakdowns (§3.5): category/subcategory, menu item, employee, sales point/channel, daypart, table/seat, payment method, and promotion.
- It aggregates the week's **covers**, **average spend per customer**, **tips**, **payment methods**, **goods sold/voided/invited**, **labour cost** from the schedule, and the week's **inventory waste**.
- It **closes automatically when a new reporting week begins**. A closed week is not re-bucketed if the reporting-week start day later changes; only future weeks are affected.
- When the week is ready for review, Project Imperium raises the **report-ready signal**.

### 3.3 The monthly business report

- The monthly business report aggregates the month's **daily reports** and adds what is only known monthly:
  - **fixed and extra operating cost**, and the month's **finance costs** (interest, income tax, depreciation, and amortisation) that feed net profit and EBITDA;
  - **inventory variance and waste**, taken from the closed inventory month;
  - **purchasing** totals;
  - **labour** cost for the month.
- It compares **targets vs actuals** across **food, beverage, labour, and fixed cost** and the **waste thresholds**, and reports **break-even**, **net profit**, and the metrics comparison.
- It carries the **full dimension set** as breakdowns (§3.5), plus the inventory dimensions **supplier good** and **supplier**.
- It **closes at the month boundary once all daily reports are closed**.
- When the month is ready for review, Project Imperium raises the **report-ready signal**.

### 3.4 Report periods and boundaries

- Reports exist at **three periods only**: the **day**, the **reporting week**, and the **calendar month**. There is no yearly report and no custom date range.
- All boundaries are interpreted in the **venue's timezone**, not the server's or the viewer's.
- The **reporting week** begins on the venue's **reporting-week start day**; it does not change the **calendar month** used by the monthly report.
- **Money is shown in the venue's currency**; **percentages** are shown on the platform's `0..100` scale.

### 3.5 Dimension breakdowns

- Every period's metrics may be sliced by the **standard dimensions** defined by the business-metrics subject: category/subcategory, menu item, supplier good, supplier, employee, sales point/channel, daypart, table/seat, payment method, and promotion.
- Breakdowns are **first-class report content**, not an afterthought:
  - the **daily** report carries the **operational** breakdowns — employee, sales point/channel, payment method, and menu item;
  - the **weekly** and **monthly** reports carry the **full dimension set**, with the monthly report adding the inventory dimensions (supplier good, supplier).
- A breakdown over a dimension with **no activity** produces **no value**; Project Imperium never fabricates a zero.

### 3.6 Target and benchmark comparison

- For each **configured target** and **waste threshold**, the report records the **target**, the **actual**, the **delta**, and whether the metric is **over** or **under** target.
- The comparison is **derived** and **report-owned**; it is computed at aggregation time and retained with the report. It is never a client-settable value.
- Each KPI is also shown against its **benchmark** where one exists. A benchmark is **reference only** — it is displayed beside the actual and is never policed, alerted on, or configured.
- A target that has not been set is not compared.

### 3.7 Closing and reopening

- A report's lifecycle is **open → calculated → reconciled → closed**. A closed report is the frozen record of its period.
- **Daily**: a manager closes the day; closing requires no open orders and locks the day.
- **Weekly**: closes automatically when the next reporting week begins.
- **Monthly**: closes at the month boundary **only once every daily report in the month is closed** and **the inventory month is closed** — so the report's variance and waste figures are final.
- **Reopening** a closed report is deliberate and audited:
  - a **daily** report is reopened by a manager, with a reason;
  - the **monthly** report is tied to the **inventory month**: when the **general manager reopens the inventory month**, the monthly report **reopens with it**; the report closes again when the inventory month closes again.
- Closed history is never silently re-bucketed: a change to the reporting-week start day or the inventory month affects only what is open or future.

### 3.8 Report-ready signalling

- When a **weekly** or **monthly** report is aggregated and ready for review, Project Imperium raises the **report-ready signal**.
- The signal names the report and its period. **How it is delivered** — in-app, email, or push — belongs to the notifications subject; this subject only raises it.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Business-reports powers |
| --- | --- |
| **Customer** | None. |
| **Employee** | None by default; may be granted a capability to view a report (see below). |
| **Manager** | Calculates, reconciles, closes, and reopens the **daily** report; views all reports and breakdowns. |
| **Admin** | Everything a manager can do, plus full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| View the daily, weekly, and monthly reports and their breakdowns | Managers and above; employees with the granted capability |
| Calculate and reconcile the daily report | Managers and above |
| Close or reopen the daily report | Managers and above |
| Reopen the monthly report | Tied to the inventory month: the general manager's reopen reopens it (the inventories subject's rule) |
| View targets, benchmarks, and the target comparison | Whoever may view the report |

Reporting is an operational act: the managers who own cost control and inventory closure also own report closure, consistent with the business-metrics and inventories subjects.
