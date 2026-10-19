# Daily sales report

> **About this document.** This is the **target-state source of truth** for the daily sales report in Project Imperium. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes the daily sales report as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **daily sales report**: how a venue's one-day activity is opened, accumulated, locked, and amended. It owns:

- the **daily sales report** itself — one report per venue per work day;
- **opening** on the first sales instance of the work day;
- the **per-employee** and **channel** buckets and the venue's **business totals**;
- the **operational dimension breakdowns** for the day;
- the **open / closed / reopened** lifecycle, including close preconditions, lock, and fulfilment sweep;
- a **day-level commission estimate** (finalisation and collection belong to the weekly business report);
- **download/export** of the entire daily report;
- **bill-driven recalculation** and the **edited** flags on the report and on amended bills and payments;
- **reopen** with a mandatory reason, and how that reason and amendment cascade into weekly and monthly business reports.

It deliberately does **not** cover:

- the **weekly and monthly business reports**, their target-vs-actual comparison, and the report-ready signal — the business-reports subject owns those; this subject supplies the closed (and amended) dailies they aggregate;
- the **definition, units, formulas, dimensions, and benchmarks of the metrics themselves** — the business-metrics subject owns those; this subject presents the day's operational sales figures using those definitions;
- **platform commission finalisation and collection** — the business-reports subject owns those at weekly close; this subject only shows a day-level **estimate**;
- the **raw sales, order, payment, labour, and stock data** the report is built from — the orders, payments-and-tax, sales-points-and-instances, and related subjects own those; this subject only aggregates them;
- **cash drawer or tip-cash counting** at close — out of scope for this subject; close does not require a cash attestation;
- the **delivery of notifications** — the notifications subject owns inbox and channels; this subject raises **no** daily report-ready or closed signal;
- **how reports are exported or laid out on screen** — outside this subject;
- **gift-card issue, balance, redemption, void, and expiry rules** — the gift-cards subject owns those; this subject accumulates deposit intake and tender in the gift-card channel, forfeitures (expiry and void-with-balance) in the forfeiture channel, and surfaces outstanding liability;
- **reservation deposit forfeiture** — the reservations subject owns when a deposit is forfeited; this subject accumulates that forfeiture in the forfeiture channel bucket.

---

## 2. Domain model and vocabulary

### Entities

- **Daily sales report** — one venue's report for one **work day**, in the venue's timezone. It opens automatically on the **first sales instance** of that work day, stays continuously derived from that day's activity while open or reopened, and is locked when a manager **closes** it.

### Terms this subject introduces

- **Work day** — the business-local calendar day, in the venue's timezone, that a sales instance belongs to (the day it opened). The daily sales report is scoped to one work day.
- **Report state** — where the daily report is in its lifecycle: **open**, **closed**, or **reopened**.
- **Open** — the report for a work day that has **never been closed**; figures recalculate continuously from bills and payments.
- **Closed** — the day is locked. Figures do not change until the report is reopened.
- **Reopened** — a previously closed day unlocked for further bill and payment changes. Distinct from **open**: the day had already been closed at least once. Figures recalculate continuously again until the next close.
- **Bucket** — a group the day's activity is accumulated into: a **per-employee** bucket or a **channel bucket**.
- **Channel bucket** — a dedicated accumulation for a named money path that is not staff-taken dine-in attribution: **delivery**, **self-ordering**, **kiosk**, **gift-card**, or **forfeiture**.
- **Business totals** — the day's whole-venue figures, as distinct from per-bucket and per-dimension figures.
- **Edited flag** — a durable marker that a daily report, bill, or payment was amended after that work day had already been closed at least once. It survives the subsequent close.
- **Reopen reason** — the mandatory, audited explanation a manager supplies when reopening a closed day; carried onto weekly and monthly reports that absorb the amendment.
- **Close** — lock the day: block further changes until reopen, and run the fulfilment sweep for that work day.
- **Reopen** — unlock a closed day so belonging bills and payments may change again; moves the report to **reopened**.
- **Commission estimate** — a day-level preview of platform commission on that day's commissionable sales; **not charged**. Finalisation and owing happen when the weekly business report closes; collection belongs to platform-billing.

Terms reused from other subjects rather than redefined here: **business**, **sales instance**, **sales point**, **order**, **bill**, **payment**, **guest count**, **covers**, **total sales**, **net revenue**, **cost of goods sold**, **tip**, **void**, **invitation**, **gift card**, **reservation deposit**, **fulfilment slice**, **managers and above**, and the metric names defined by the business-metrics subject.

---

## 3. Capabilities

### 3.1 Opening the day

- There is **one daily sales report per venue per work day**, in the venue's timezone.
- The report **opens automatically on the first sales instance** of that work day. Opening an empty tab with no sale yet still opens the report.
- If a venue has **no sales instance** on a calendar day, there is **no** daily sales report for that day.
- The first instance of a new work day opens that day's report; it does **not** disturb a prior day's closed report.

### 3.2 Derived figures — never hand-edited

- The daily sales report is **entirely app-calculated** from the sales instances, orders, bills, and payments that belong to that work day.
- **Nobody edits report cells.** Corrections happen on the **bill** or **payment**; when those change, the report **recalculates itself**.
- While the report is **open** or **reopened**, recalculation is continuous and immediate — there is no separate "calculate" step and no manager attestation step on the report itself.

### 3.3 Buckets

- The day's activity accumulates into **buckets** and into the venue's **business totals**.
- **Per-employee buckets** hold **staff-taken** activity only: each attributed employee's sales, tips, goods sold, voided, and invited, and their payment-method breakdown. Channel activity is **not** double-counted into a staff sales bucket.
- **Channel buckets** (no staff sales double-count):
  - **delivery** — delivery-channel sales, tips, goods, and payment methods;
  - **self-ordering** — self-ordering sales by point;
  - **kiosk** — kiosk sales by point;
  - **gift-card** — that day's **gift-card deposit intake** (paid issues as cash-in liability funding, granted issues as liability with no cash), and **Gift card** tender on meal bills (payment-method view of redemptions), so one channel is the audit home for gift-card money movement; **product sales and tax** from redemptions sit in ordinary business totals by line, not as a second gift-card sale;
  - **forfeiture** — **gift-card expiry forfeitures** and **gift-card void-with-balance forfeitures** (each labeled Expired or Voided), and **reservation deposit forfeitures** (customer cancel after reserved, or no-show, when the deposit is kept), and nothing else.
- Amounts in channel buckets still roll into **business totals** where they are venue money. Gift-card **deposit intake** is not product sales revenue; **redemption** recognises product revenue on the paid order lines (gift-cards subject; ADR-0004). **Outstanding gift-card liability** (sum of Active remaining balances) is visible to managers and above alongside the day.
- There is **no** separate dine-in channel bucket: staff-taken dine-in activity lives in **per-employee** buckets, with sales-point breakdown for where it happened.

### 3.4 Business totals and dimensions

- **Business totals** for the day include at least: total sales, net revenue, tips, cost of goods sold, profit, customers served (covers), average spend per customer, void and invited value, and a **commission estimate** for the day (never a charged amount).
- **Customers served (covers)** is the sum of **guest counts** on sales instances that belong to that work day, including self-ordering, kiosk, and delivery instances.
- The daily report's **dimension breakdowns** are the operational set only: **employee**, **sales point/channel**, **payment method**, and **menu item**.
- The **sales point/channel** breakdown includes ordinary sales points for staff-taken activity and the dedicated channels **delivery**, **self-ordering**, **kiosk**, **gift-card**, and **forfeiture**.
- The daily report does **not** carry cost-target or waste-threshold comparison, nor industry benchmarks — those belong to weekly and monthly business reports.
- A breakdown over a dimension with **no activity** produces **no value**; Project Imperium never fabricates a zero.
- Money is shown in the venue's currency.

### 3.5 Closing the day

- **Managers and above** **close** the day when service for that work day is done.
- Closing requires that **no sales instance for that work day still has open orders**. Empty instances are discarded or closed first; an empty instance alone does not block close.
- Closing does **not** require every fulfilment slice to be Delivered first; close itself clears stragglers (§3.6).
- Closing does **not** require a cash-drawer or tip-cash count.
- On close, Project Imperium:
  - moves the report to **closed** and **locks the day** — belonging bills and payments cannot change until reopen;
  - runs the **fulfilment sweep** (§3.6).
- A first-pass close (the day was never closed before) does **not** set the edited flag.
- Closing the day does **not** charge platform commission; the commission estimate remains an estimate until the weekly business report closes.

### 3.6 Fulfilment sweep on close

- When the daily sales report **closes**, every fulfilment slice for that business work day that is not yet **Delivered** is moved to **Delivered** (advancing through Preparing and Ready as needed) so queues are clear.
- The printers-and-screens and orders subjects own fulfilment status mechanics; this subject owns that close triggers that sweep.

### 3.7 Commission estimate

- The daily report shows a **commission estimate** using the same formula the business-reports subject uses for the week: **base plan rate × that day's commissionable sales**. Commissionable sales are **paid product sales after voids and refunds** across **all payment methods**, including sales paid with **gift card** tender (paid or granted cards); **invitations**, gift-card **deposit intake**, **forfeitures**, and **tips** are excluded. The base rate comes from the monetization catalogue.
- The rates are **fixed by the subscription plan / catalogue** and are not editable on the report.
- The estimate is **never charged** from the daily report. **Finalisation and owing** happen when the **weekly business report closes** (business-reports subject); **collection** belongs to platform-billing.

### 3.8 Reopen, bill edits, and the edited flag

- Changing a bill or payment that belongs to a **closed** day requires **reopening** that day first.
- **Managers and above** reopen with a **mandatory reason**. Reopen moves the report to **reopened** (not plain **open**).
- While **reopened**, the day accepts both **corrections** to existing activity (refunds, voids, reasoned bill edits) and **any still-arriving same-work-day activity**, until it is closed again.
- When at least one belonging **bill** or **payment** changes after a prior close:
  - that **bill** and that **payment** carry an **edited** flag for easy identification;
  - the **daily sales report** also carries an **edited** flag.
- The edited flags and the reopen reason are **durable**: they survive the subsequent close.
- After reopen, the manager must **close** again to lock the day and re-run the fulfilment sweep as needed. The day's commission estimate recalculates with the figures; any already-closed weekly report that absorbed the day is re-finalised by the business-reports subject.
- A day closed once with no prior close does **not** get the edited flag — only days that went **closed → reopened → (bill or payment change) → closed** again.

### 3.9 Refunds and payment history

- Refunds and payment status follow the payments-and-tax subject: the original sale stays visible; the refund sits beside it.
- Those changes adjust the day's derived figures. If the day is already **closed**, it must be **reopened** before the bill or payment may change and the report recalculates.

### 3.10 Cascade into weekly and monthly reports

- Weekly and monthly business reports aggregate **closed** dailies (the business-reports subject owns those roll-ups).
- When a closed daily is reopened, amended through bill or payment changes, and closed again:
  - any weekly or monthly report that already included that day is **automatically recalculated**;
  - those roll-ups **remain closed** (amended closed records);
  - they **carry the same reopen reason** and show that they were **updated from an edited daily**, so the amendment is justified end-to-end;
  - a closed weekly report's **commission is re-finalised** under the business-reports subject's rules.
- There is no separate manager reopen of each roll-up for this path; the daily's reopen reason is the justification.

### 3.11 Export

- Managers and above (and employees granted view access) can **download/export the entire** daily sales report.
- Export format and on-screen layout are outside this subject; the capability to take the whole report away is in scope.

### 3.12 No daily notifications

- The daily sales report raises **no** report-ready and **no** closed notification. Closing the day is an operational act for managers on duty.
- Weekly and monthly report-ready signalling belongs to the business-reports subject.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Sales-reports powers |
| --- | --- |
| **Customer** | None. |
| **Employee** | None by default; may be granted a per-user capability to **view the daily sales report**. |
| **Manager** | Views the daily report and its breakdowns; closes and reopens the day (reopen with reason). |
| **Admin** | Everything a manager can do, plus full venue control. |

Job roles follow the usual floor hierarchy: **managers and above** close and reopen; no separate host- or chef-specific gate. Viewing may be extended to an individual employee via the per-user capability above.

### Who can do what

| Activity | Who |
| --- | --- |
| View the daily sales report and its breakdowns | Managers and above; employees with the per-user capability to view the daily sales report |
| Download/export the daily sales report | Whoever may view the daily sales report |
| Close the daily report | Managers and above |
| Reopen the daily report (mandatory reason) | Managers and above |
| Edit report figures directly | Nobody — figures are derived only |
| Change a bill or payment on an open or reopened day | Per the orders and payments-and-tax subjects' rules |
| Change a bill or payment on a closed day | Blocked until managers and above reopen that day |

Closing and reopening the day are operational acts for the managers who run the floor, consistent with how weekly and monthly roll-ups consume the locked daily record.
