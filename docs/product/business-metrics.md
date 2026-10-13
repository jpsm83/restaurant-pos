# Business metrics

> **About this document.** This is the **target-state source of truth** for the business metrics of a venue in POS. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes business metrics as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **numbers a venue sets for itself, the language the platform uses to name them, and the formulas behind them**. It owns:

- the **cost targets** — the four target categories (food, beverage, labour, fixed), each a percentage of total sales;
- the **supplier-good waste thresholds** — the acceptable waste ceilings, keyed to a supplier good's **budget impact**;
- the **reporting-week start day** — the day that begins the venue's weekly reporting window;
- the **KPI dictionary** — the platform's named metrics, each with its unit, the direction that is "good", its meaning, and its **canonical formula**.

It deliberately does **not** cover:

- the **weekly and monthly business report** structures, buckets, aggregation, closing, and comparison rendering — the business-reports subject owns those; this subject defines the KPIs and targets they compare against;
- the **inventory variance and supplier-good waste computation** — the inventories subject owns how waste and deviation are derived, and the supplier-goods subject owns the **budget impact** field;
- the **business profile, onboarding, currency, and go-live** — the business subject owns those; metrics belong to a business's own configuration but are documented here;
- **notifications** for report readiness or over-target conditions — the notifications subject owns delivery, and no over-target alert is committed here.

---

## 2. Domain model and vocabulary

### Entities

- **Business metrics** — the venue's own target configuration. It holds the **cost targets** and the **supplier-good waste thresholds**. It is **stored as fields on the business**, seeded with the platform defaults when the venue is created, and editable thereafter. It belongs to one venue; the business subject owns the storage, this subject owns the meaning.
- **Cost target** — a target ratio for one cost category, expressed as a **percentage of total sales** (not of that category's own sales).
- **Supplier-good waste threshold** — the acceptable **waste ceiling** for supplier goods of one **budget-impact level**, expressed as a **percentage of total sales**.
- **Reporting config** — the venue's reporting-window configuration; it holds the **reporting-week start day**.
- **KPI** — a named metric the platform publishes, carrying a unit, a good direction, and a pointer to its canonical formula.

### Terms this subject introduces

- **Cost target** — one of four target percentages of sales: **food**, **beverage**, **labour**, **fixed**.
- **Waste threshold** — a ceiling, one per budget-impact level, for supplier-good waste as a percentage of sales.
- **Budget-impact level** — the **Very Low → Very High** classification carried on a **supplier good** (defined by the supplier-goods subject). It selects which waste threshold applies to that good's waste.
- **Reporting week** — the seven-day window that groups daily sales reports into one weekly business report. Its first day is the **reporting-week start day**, expressed from `0` (Sunday) to `6` (Saturday).
- **KPI dictionary** — the platform's canonical list of named metrics (this document's §3.5), with units, direction, and formula pointers.
- **Target comparison** — a metric's **target** against its **actual**, with the **delta** and whether it is over or under target.

Terms reused from other subjects rather than redefined here: **business** and **supplier good** (product overview core vocabulary), **budget impact** (supplier-goods subject), and the reporting terms **total sales**, **cost of goods sold (COGS)**, **prime cost**, and **break-even**. Percent KPIs are expressed on a **`0..100`** scale; a division by zero yields `0`.

---

## 3. Capabilities

### 3.1 Cost targets

A business holds **four cost targets** — food, beverage, labour, and fixed.

- Each target is a **percentage of total sales**, not a percentage of the category's own sales. A food target of `30` means food cost is targeted at `30%` of total sales.
- Each target is validated in the **`0..100`** range and accepts decimals.
- The **four targets are independent**: POS places **no requirement that they sum to 100**. They describe different cost categories against the same denominator — total sales — not shares of a cost pool. Food and labour together form **prime cost**; beverage and fixed cost are measured alongside it; the remainder is profit.
- Targets are **seeded at venue creation** with the platform defaults (§3.6) and are **editable** at any time by managers and above.
- The **actual** a target is compared against is the corresponding cost ratio **against total sales** for the report's period.

### 3.2 Supplier-good waste thresholds

Waste thresholds are **five ceilings**, one per **budget-impact level**, applied to supplier-good waste.

- Each threshold is the acceptable waste **ceiling for goods of that budget-impact level**, expressed as a **percentage of total sales**.
- The five levels are the canonical budget-impact values: **Very Low**, **Low**, **Medium**, **High**, **Very High**. The ordering is deliberate: a **higher budget impact means a lower tolerance**, because waste on an expensive good costs more.
- The **actual** for a level is that level's waste **cost as a percentage of total sales**; the ceilings do not blend into one figure — each level is compared on its own.
- Thresholds are seeded at venue creation with the platform defaults (§3.6) and are editable by managers and above.
- A level with **no waste recorded** and a level with **no supplier goods** at that impact simply produce no meaningful comparison; POS never fabricates a zero-waste result for a level that had no activity.

### 3.3 Reporting-week start day

- A business has a **reporting-week start day** from **`0` (Sunday)** to **`6` (Saturday)**; the default is **Monday (`1`)**.
- The start day defines the **reporting week** used to group **daily sales reports** into a **weekly business report**. It does **not** change the **calendar month** used by the monthly business report.
- Changing the start day affects **future** reporting weeks only. A week that has already been aggregated and closed keeps the window it was closed under; closed history is never silently re-bucketed.
- The start day is set by managers and above.

### 3.4 Targets vs actuals

- POS compares each **configured target** against its **actual** for the report period and records the **target**, the **actual**, the **delta**, and whether the metric is **over** or **under** target.
- The comparison is **derived** and **report-owned**; it is never a client-settable field. It is computed at report aggregation time and retained with the report.
- Comparison coverage:
  - the **weekly** business report compares the operational cost targets — **food**, **beverage**, and **labour** — plus the **waste thresholds**; **fixed cost is excluded** from the weekly view;
  - the **monthly** business report compares **all four cost targets** plus the **waste thresholds**.
- A target that has not been set is not compared. Because defaults are seeded at creation (§3.6), a venue begins with every target configured and may still clear any it does not want to police.

### 3.5 KPI dictionary

The platform's named metrics, each with its unit, good direction, meaning, and **canonical formula**. Percentage KPIs are returned on the **`0..100`** scale (already multiplied by 100), and every division is guarded so a `0` denominator yields `0`. The **beverage cost** and **fixed cost** percentages follow the same cost-over-total-sales form as **food cost** and **labour cost**.

**Profitability**

| KPI | Unit | Good direction | Formula | Meaning |
| --- | --- | --- | --- | --- |
| Gross profit | Business currency | Higher | `netRevenue - cogs` | Net revenue less COGS. |
| Gross profit margin | Percent | Higher | `(grossProfit / totalSales) * 100` | Gross profit as a share of total sales. |
| Net profit | Business currency | Higher | `netRevenue - totalOperatingCost` | Net revenue less total operating cost. |
| Net profit margin | Percent | Higher | `(netProfit / totalSales) * 100` | Net profit as a share of total sales. |

**Cost and sales quality**

| KPI | Unit | Good direction | Formula | Meaning |
| --- | --- | --- | --- | --- |
| Food cost % of sales | Percent | Lower | `(foodCost / totalSales) * 100` | Food cost over total sales — the **food target**. |
| Beverage cost % of sales | Percent | Lower | `(beverageCost / totalSales) * 100` | Beverage cost over total sales — the **beverage target**. |
| Labour cost % of sales | Percent | Lower | `(laborCost / totalSales) * 100` | Labour cost over total sales — the **labour target**. |
| Fixed cost % of sales | Percent | Lower | `(fixedCost / totalSales) * 100` | Fixed operating cost over total sales — the **fixed target**. |
| Prime cost | Business currency | Lower | `foodCost + laborCost` | Food cost plus labour cost. |
| Prime cost % of sales | Percent | Lower | `(primeCost / totalSales) * 100` | Prime cost over total sales. |
| Sales payment completion | Percent | Higher | `(totalNetRevenue / totalSales) * 100` | Net revenue over total sales. |
| Void sales % | Percent | Lower | `(totalVoidSales / totalSales) * 100` | Void value over total sales. |
| Invited sales % | Percent | Lower | `(totalInvitedSales / totalSales) * 100` | Complimentary value over total sales. |

**Break-even and targets**

| KPI | Unit | Good direction | Formula | Meaning |
| --- | --- | --- | --- | --- |
| Contribution margin ratio | Ratio | Higher | `(totalSales - variableCosts) / totalSales` | Total sales less variable costs, over total sales. |
| Break-even sales | Business currency | — | `fixedCosts / contributionMarginRatio` | Fixed costs over the contribution-margin ratio. |
| Minimum daily sales target | Business currency | — | `breakEvenSales / daysInPeriod` | Break-even sales spread across the period's days. |

**Operational efficiency**

| KPI | Unit | Good direction | Formula | Meaning |
| --- | --- | --- | --- | --- |
| Average spend per customer | Business currency | Higher | `totalNetRevenue / customersServed` | Net revenue over customers served. |
| Sales per labour hour | Business currency | Higher | `totalSales / laborHours` | Total sales over labour hours. |
| Inventory turnover | Ratio | Higher | `cogs / averageInventoryValue` | COGS over average inventory value. |
| Table turnover rate | Ratio | Higher | `(guestsServed / numberOfTables) / serviceHours` | Guests per table per service hour. |

**Promotion and bar controls**

| KPI | Unit | Good direction | Formula | Meaning |
| --- | --- | --- | --- | --- |
| Promotion sales mix | Percent | — | `(promoSales / totalSales) * 100` | Promotional sales over total sales. |
| Promotion discount rate | Percent | Lower | `(promoDiscountValue / grossSales) * 100` | Discount value over gross sales. |
| Promotion ROI proxy | Ratio | Higher | `incrementalPromoSales / promoDiscountValue` | Incremental promotional sales per discount unit. |
| Pour cost | Percent | Lower | `(beverageUsedCost / beverageSales) * 100` | Beverage used cost over beverage sales. |
| Beverage variance | Percent | Lower | `((actualUsage - theoreticalUsage) / theoreticalUsage) * 100` | Actual usage cost above theoretical usage, over theoretical usage. |

### 3.6 Platform defaults

A business is **created with industry-calibrated defaults** written onto its metrics, which the venue may then edit. The defaults are ordinary targets once stored — nothing about them is special after creation.

| Setting | Default | Basis |
| --- | --- | --- |
| Food cost target | `30%` | Industry food cost commonly runs `28–35%` of revenue. |
| Beverage cost target | `20%` | Beverage (bar-led) cost commonly runs `18–25%`. |
| Labour cost target | `30%` | Labour commonly targets `30–35%`; full-service medians run higher. |
| Fixed cost target | `20%` | Occupancy plus fixed overhead; occupancy alone is typically `10%` or less. |
| Waste — Very Low impact | `9%` | Tolerance decreases as budget impact rises. |
| Waste — Low impact | `7%` | — |
| Waste — Medium impact | `5%` | — |
| Waste — High impact | `3%` | — |
| Waste — Very High impact | `1%` | — |
| Reporting-week start day | Monday (`1`) | Most venues plan and review on a Monday-start week. |

The cost targets follow the industry convention that **prime cost** (food plus labour) is the dominant controllable cost, targeted at roughly **`55–65%`** of sales, with beverage, fixed cost, and profit taking the remainder — which is why the cost targets are **not** required to sum to `100`.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Business-metrics powers |
| --- | --- |
| **Customer** | None. |
| **Employee** | None by default; may be granted a capability (see below). |
| **Manager** | Sets and edits the **cost targets**, the **waste thresholds**, and the **reporting-week start day**. |
| **Admin** | Everything a manager can do, plus full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| Set or edit cost targets | Managers and above |
| Set or edit supplier-good waste thresholds | Managers and above |
| Set or edit the reporting-week start day | Managers and above |
| View targets and the target comparison | Whoever may view the weekly/monthly business report (the business-reports subject's rule) |

Editing metrics is an operational, not an ownership, act; it sits with the managers who own reporting and cost control, consistent with opening hours, delivery configuration, and inventory closure.

---

## 5. Current vs target

*The only place current status is recorded.*

### What exists today

**Models** (`backend/src/models/business.ts`):

- An embedded `metricsSchema` on the business with **four cost percentages** seeded by default — food `30`, beverage `20`, labour `30`, fixed `20` — and a **five-level waste ladder** seeded `9 / 7 / 5 / 3 / 1`, keyed `veryLowBudgetImpact`, `lowBudgetImpact`, `mediumBudgetImpact`, **`hightBudgetImpact`**, **`veryHightBudgetImpact`** (the last two are misspelled).
- An embedded `reportingConfigSchema` with `weeklyReportStartDay` (min `0`, max `6`, default `1`).
- A model comment asserting "the sum of the cost percentage above should be 100%" — which nothing enforces and which is financially incorrect.

**Schemas** (`packages/schemas/business.ts`):

- `businessMetricsSchema` is a strict object where **every key is required when a `metrics` field is sent**; the four cost values use an unbounded coerced number (no `0..100` range) and the waste keys carry the same misspellings.
- `businessReportingConfigSchema` validates `weeklyReportStartDay` as an integer in `0..6`.
- Both fields are optional JSON-encoded fields on `updateBusinessBodySchema`; `createBusinessBodySchema` accepts neither.

**Interfaces** (`packages/interfaces/`):

- `IBusiness` carries `metrics?: IMetrics` and `reportingConfig?: IReportingConfig`; `IMetrics` includes all four cost targets, but the weekly report's `IMetrics` (`IWeeklyBusinessReport`) omits beverage and fixed, and the monthly comparison type (`IMonthlyBusinessReport`) omits beverage.

**Aggregation and calculations** (`backend/src/reports/businessMetrics/`, `backend/src/weeklyBusinessReport/`, `backend/src/monthlyBusinessReport/`):

- `calculations.ts` holds the canonical `calculateCostRatiosByTotalSales` (each cost over total sales) plus an **unused** `calculateCostRatiosByOperatingCost` (a legacy ratio whose denominator is total operating cost, not sales).
- `aggregateDailyReportsIntoWeekly.ts` and `aggregateDailyReportsIntoMonthly.ts` compute cost ratios with `calculateCostRatiosByTotalSales` and build a `metricsComparison`; the **weekly** comparison covers **food, labour, and waste**, and the **monthly** comparison covers **food, labour, fixed, and waste** — **beverage is compared in neither**.

**Routes** (`backend/src/routes/v1/`):

- `PATCH /business/:businessId` accepts `metrics` and `reportingConfig`, and writes changed metric leaves back as dotted paths (`metrics.<key>`, `metrics.supplierGoodWastePercentage.<key>`), logging a reporting-config change.
- `dailySalesReports.ts` reads `reportingConfig.weeklyReportStartDay` (defaulting to `1`) to place a day in its reporting week.
- `weeklyBusinessReport.ts` is read-only over the persisted report. `monthlyBusinessReport.ts` additionally builds a `metricsComparison` inline on its calculate-on-demand path, using cost ratios whose denominator is **total operating cost** (not total sales) — a second denominator that disagrees with the aggregation helpers.

**Screens** (`frontend/src/pages/business/`):

- `BusinessMetricsSettingsPage.tsx` renders a "Metrics" section (four cost inputs and five waste inputs) and a "Reporting" section (weekly report start day), reached at `/business/:businessId/settings/metrics`.

### Gap to target

- **No `0..100` range validation.** Target validates every cost target and waste threshold in `0..100`; today the schema accepts any number, so an out-of-range target is stored verbatim.
- **All-or-nothing metrics payload.** Target allows a venue to set or clear individual targets; today `businessMetricsSchema` requires *every* key whenever `metrics` is sent.
- **No canonical default seeding step.** Target seeds industry-calibrated defaults as an explicit part of venue creation; today the defaults are schema-level and the creation body does not accept metrics at all.
- **Unit is ambiguous.** Target states each target is a percentage of **total sales**; today the model comments say "of sales average" without pinning the denominator, and the stored values are unitless numbers.
- **Sum-to-100 claim.** Target has no sum rule; today a model comment asserts the four should sum to `100`, contradicting the total-sales denominator the report actually uses.
- **Misspelled waste keys.** Target uses canonical `highBudgetImpact` / `veryHighBudgetImpact`; today the model, schema, interfaces, and frontend all carry `hight` / `veryHight`.
- **Beverage missing from comparisons.** Target compares beverage in both the weekly and monthly reports; today beverage is computed as a ratio but never compared.
- **Weekly excludes fixed — inconsistent with the report pair.** Target defines weekly as food/beverage/labour + waste and monthly as all four + waste; today that split is neither documented nor enforced and the interfaces disagree with each other.
- **Comparison ownership is undeclared.** Target makes the target comparison a derived, report-owned output from metrics owned by this subject; today the comparison is assembled inline in the aggregators and the monthly calculate-on-demand route without a stated home.
- **Two cost denominators.** Target keeps one canonical cost denominator (total sales); today the monthly calculate-on-demand route compares ratios computed against **total operating cost**, while the aggregation helpers use total sales, so the same "food cost %" is scaled differently in different paths.

### ADR conflicts

- **ADR-0001 (zod DTOs exclude server-owned fields).** No conflict, but a constraint. The target's cost targets, waste thresholds, and reporting-week start day are **client-settable** and therefore belong in the request DTO with their `0..100` bounds; the **target comparison** — targets, actuals, deltas, and over/under flags — is **server-derived** and must stay out of every DTO.
- **ADR-0002 (dev-only Docker against Atlas).** Does not touch business metrics.
- **ADR-0003 (soft delete).** Does not touch business metrics; metric configuration lives on the business, whose soft-delete lifecycle is governed by ADR-0003.
