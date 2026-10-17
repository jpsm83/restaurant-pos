# Business reports

> **About this document.** This is the **target-state source of truth** for the weekly and monthly business reports of a venue in Project Imperium. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes business reports as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **how a venue's numbers are gathered, grouped, closed, and presented over the reporting week and the calendar month**. It owns:

- the **weekly business report** — the reporting week's aggregation of closed daily sales reports, focused on operational performance;
- the **monthly business report** — the month's aggregation, adding fixed and extra cost, inventory variance and waste, purchasing, and labour;
- the **report periods and their boundaries** — the reporting week and the calendar month, interpreted in the venue's timezone (the work day itself belongs to the sales-reports subject);
- the **dimension breakdowns** on weekly and monthly reports — how a period's metrics are sliced by the standard dimensions;
- the **target-vs-actual comparison** — the comparison of each configured target and waste threshold against its actual;
- the **weekly and monthly report lifecycle** — aggregation, closing, and amendment when an included daily sales report is edited after close;
- the **report-ready signal** — the event that a weekly or monthly report is ready for review.

It deliberately does **not** cover:

- the **daily sales report** — its opening, buckets, close, reopen, edited flags, and commission finalisation — the sales-reports subject owns those; this subject **consumes closed dailies** as inputs;
- the **definition, units, formulas, dimensions, and benchmarks of the metrics themselves**, nor the cost targets and waste thresholds — the business-metrics subject owns those; this subject presents them;
- the **derivation of inventory variance and waste** — the inventories subject owns how usage, deviation, variance, and waste are computed; this subject presents them in the monthly report;
- the **raw sales, order, payment, labour, and stock data** the reports are built from — the orders, payments, time-control, and inventories subjects own those;
- the **delivery of notifications** — the notifications subject owns inbox, email, and push; this subject only raises the report-ready signal;
- **how reports are exported or laid out on screen** — outside this subject.
- the **work day** and opening of a daily sales report — the sales-reports subject owns those.

---

## 2. Domain model and vocabulary

### Entities

- **Weekly business report** — one venue's report for one **reporting week**, built by aggregating that week's closed daily sales reports. It focuses on operational performance.
- **Monthly business report** — one venue's report for one **calendar month**, built by aggregating that month's closed daily sales reports and adding the costs and inventory figures that are only known monthly. It is the venue's fullest statement of profitability.
- **Reporting week** — the seven-day window defined by the venue's **reporting-week start day**. It groups daily sales reports into the weekly report.
- **Report period** — the window a weekly or monthly report covers: a **reporting week** or a **calendar month**.
- **Dimension breakdown** — a period's metric sliced by one of the standard dimensions (for example, sales by daypart).
- **Target comparison** — the comparison of a configured **target** or **waste threshold** against its **actual** for the period, with the delta and whether it is over or under.
- **Report-ready signal** — the event that a weekly or monthly report has been aggregated and is ready for review.

### Terms this subject introduces

- **Report state** — where a weekly or monthly report is in its lifecycle: **open** (still aggregating or accepting further closed dailies) or **closed** (frozen for the period, except when amended from an edited daily — §3.7).
- **Close** — lock the weekly or monthly report for its period under the rules in §3.7.
- **Amendment from edited daily** — when a closed daily sales report is reopened, changed through its bills or payments, and closed again, any closed weekly or monthly report that included that day is recalculated automatically, stays closed, and carries the daily's reopen reason.

Terms reused from other subjects rather than redefined here: **business**, **daily sales report**, **work day**, **edited flag**, **reopen reason**, **reporting-week start day**, **total sales**, **net revenue**, **cost of goods sold**, **prime cost**, **target**, **waste threshold**, **benchmark**, **dimension**, **daypart**, **channel**, **sales point**, **sales instance**, **order**, and the metric names defined by the business-metrics subject.

---

## 3. Capabilities

### 3.1 Inputs from the daily sales report

- Weekly and monthly reports are built from **closed daily sales reports** owned by the sales-reports subject.
- This subject does not open, close, or reopen a daily report; it only aggregates what that subject has locked (and re-aggregates when that subject amends a day — §3.7).

### 3.2 The weekly business report

- The weekly business report aggregates the **closed daily sales reports** that fall in the venue's **reporting week**.
- It is focused on **operational performance**: it presents the operational cost targets — **food**, **beverage**, and **labour** — and the waste thresholds, and **excludes fixed and extra cost**, which are only known monthly.
- It carries the **full dimension set** as breakdowns (§3.5): category/subcategory, menu item, employee, sales point/channel, daypart, table/seat, payment method, and promotion.
- It aggregates the week's **covers**, **average spend per customer**, **tips**, **payment methods**, **goods sold/voided/invited**, **labour cost** from the schedule, and the week's **inventory waste**.
- It **closes automatically when a new reporting week begins**. A closed week is not re-bucketed if the reporting-week start day later changes; only future weeks are affected — except when an included daily is amended after close (§3.7).
- When the week is ready for review, Project Imperium raises the **report-ready signal**.

### 3.3 The monthly business report

- The monthly business report aggregates the month's **closed daily sales reports** and adds what is only known monthly:
  - **fixed and extra operating cost**, and the month's **finance costs** (interest, income tax, depreciation, and amortisation) that feed net profit and EBITDA;
  - **inventory variance and waste**, taken from the closed inventory month;
  - **purchasing** totals;
  - **labour** cost for the month.
- It compares **targets vs actuals** across **food, beverage, labour, and fixed cost** and the **waste thresholds**, and reports **break-even**, **net profit**, and the metrics comparison.
- It carries the **full dimension set** as breakdowns (§3.5), plus the inventory dimensions **supplier good** and **supplier**.
- It **closes at the month boundary once all daily sales reports in the month are closed** and **the inventory month is closed**.
- When the month is ready for review, Project Imperium raises the **report-ready signal**.

### 3.4 Report periods and boundaries

- Weekly and monthly reports exist at **two periods only** at this subject: the **reporting week** and the **calendar month**. The **work day** belongs to the sales-reports subject. There is no yearly report and no custom date range.
- All boundaries are interpreted in the **venue's timezone**, not the server's or the viewer's.
- The **reporting week** begins on the venue's **reporting-week start day**; it does not change the **calendar month** used by the monthly report.
- **Money is shown in the venue's currency**.

### 3.5 Dimension breakdowns

- Every period's metrics may be sliced by the **standard dimensions** defined by the business-metrics subject: category/subcategory, menu item, supplier good, supplier, employee, sales point/channel, daypart, table/seat, payment method, and promotion.
- Breakdowns are **first-class report content**, not an afterthought:
  - the **weekly** and **monthly** reports carry the **full dimension set**, with the monthly report adding the inventory dimensions (supplier good, supplier);
  - the **daily** operational breakdown set is owned by the sales-reports subject.
- A breakdown over a dimension with **no activity** produces **no value**; Project Imperium never fabricates a zero.

### 3.6 Target and benchmark comparison

- For each **configured target** and **waste threshold**, the weekly or monthly report records the **target**, the **actual**, the **delta**, and whether the metric is **over** or **under** target.
- The comparison is **derived** and **report-owned**; it is computed at aggregation time and retained with the report. It is never a client-settable value.
- Each KPI is also shown against its **benchmark** where one exists. A benchmark is **reference only** — it is displayed beside the actual and is never policed, alerted on, or configured.
- A target that has not been set is not compared.
- Daily sales reports do not carry this comparison; it is weekly and monthly only.

### 3.7 Closing and amendment from an edited daily

- A weekly report **closes automatically when the next reporting week begins**.
- A monthly report **closes at the month boundary** only once **every daily sales report in the month is closed** and **the inventory month is closed** — so the report's variance and waste figures are final.
- **Reopening the inventory month** (general manager, inventories subject) **reopens the monthly report with it**; the report closes again when the inventory month closes again.
- When a **closed daily sales report** is reopened, changed through its bills or payments, and closed again (sales-reports subject):
  - any weekly or monthly report that already included that day is **automatically recalculated**;
  - those roll-ups **remain closed** (amended closed records);
  - they **carry the same reopen reason** and show they were **updated from an edited daily**.
- A change to the reporting-week start day still affects only open or future weeks; it does not by itself rewrite closed history. Amendment from an edited daily is the deliberate exception above.

### 3.8 Report-ready signalling

- When a **weekly** or **monthly** report is aggregated and ready for review, Project Imperium raises the **report-ready signal**.
- The signal names the report and its period. **How it is delivered** — in-app, email, or push — belongs to the notifications subject; this subject only raises it.
- There is no report-ready signal for the daily sales report.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Business-reports powers |
| --- | --- |
| **Customer** | None. |
| **Employee** | None by default; may be granted a capability to view a report (see below). |
| **Manager** | Views weekly and monthly reports and breakdowns. Closing the daily sales report (which feeds these roll-ups) belongs to the sales-reports subject. |
| **Admin** | Everything a manager can do, plus full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| View the weekly and monthly reports and their breakdowns | Managers and above; employees with the granted capability |
| Close or reopen a daily sales report | Managers and above (daily sales report subject) |
| Reopen the monthly report | Tied to the inventory month: the general manager's reopen reopens it (the inventories subject's rule) |
| View targets, benchmarks, and the target comparison | Whoever may view the weekly or monthly report |

Reporting at week and month is a management review act; the managers who own cost control and inventory closure also own reading these roll-ups, consistent with the business-metrics and inventories subjects.
