# Business metrics

> **About this document.** This is the **target-state source of truth** for the business metrics of a venue in Project Imperium. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes business metrics as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **numbers a venue measures itself by** — the financial inputs they are computed from, the targets and thresholds a venue sets, the platform's named metrics and their canonical formulas, and the industry benchmarks they are read against. It owns:

- the **financial inputs** — the period amounts every metric is computed from, and the cost categories they are split into;
- the **cost targets** — the four target categories (food, beverage, labour, fixed), each a percentage of total sales;
- the **supplier-good waste thresholds** — the acceptable waste ceilings, keyed to a supplier good's **budget impact**;
- the **reporting-week start day** — the day that begins the venue's weekly reporting window;
- the **dimension vocabulary** — the standard breakdowns a metric may be sliced by;
- the **benchmarks** — the reference industry ranges a metric is read against;
- the **KPI catalogue** — the platform's named metrics, each with its unit, the direction that is "good", its meaning, its **canonical formula**, the dimensions it supports, and its benchmark.

It deliberately does **not** cover:

- the **daily, weekly, and monthly report** structures, buckets, aggregation, closing, and rendering — the sales-reports subject owns the daily report; the business-reports subject owns the weekly and monthly reports; this subject defines the metrics and targets those reports compare against;
- the **derivation of inventory variance and supplier-good waste** — the inventories subject owns how usage, deviation, variance, and waste are computed; the supplier-goods subject owns the **budget impact** a good carries. This subject owns the thresholds waste is compared against and the metrics that name it;
- the **raw sales, order, labour, and inventory data** the inputs are drawn from — the orders, time-control, and inventories subjects own those;
- the **business profile, currency, and go-live** — the business subject owns those; metrics belong to a business's own configuration but are documented here;
- **notifications** for report readiness or over-target conditions — the notifications subject owns delivery, and no over-target alert is committed here.

---

## 2. Domain model and vocabulary

### Entities

- **Business metrics** — the venue's own target configuration. It holds the **cost targets** and the **supplier-good waste thresholds**. It is **stored as fields on the business**, seeded with the platform defaults when the venue is created, and editable thereafter. It belongs to one venue; the business subject owns the storage, this subject owns the meaning.
- **Cost target** — a target ratio for one cost category, expressed as a **percentage of total sales** (not of that category's own sales).
- **Supplier-good waste threshold** — the acceptable **waste ceiling** for supplier goods of one **budget-impact level**, expressed as a **percentage of total sales**.
- **Reporting config** — the venue's reporting-window configuration; it holds the **reporting-week start day**.
- **KPI** — a named metric the platform publishes, carrying a unit, a good direction, a canonical formula, the dimensions it supports, and a benchmark.
- **Dimension** — a standard breakdown axis a KPI may be sliced by (for example, category, channel, or daypart). Each KPI declares the dimensions it supports.
- **Benchmark** — the reference industry range a KPI is read against. It is **reference only**: it informs, and is never policed.
- **Target comparison** — a metric's **target** against its **actual**, with the **delta** and whether it is over or under target.

### Financial inputs

Every metric is computed from **period amounts** — the totals a report has aggregated for its day, week, or month. The platform's canonical inputs are:

- **Gross sales** — the value of everything sold in the period at selling price, **before** any adjustment for voids, discounts, or complimentary items.
- **Total sales** — the venue's canonical sales figure for the period: gross sales before adjustments. It is the denominator of every sales-ratio KPI and every cost target.
- **Net revenue** — the amount customers actually paid in the period, after voids, discounts, and complimentary items.
- **Cost of goods sold (COGS)** — the cost of the goods sold in the period; the sum of **food cost** and **beverage cost**.
- **Food cost** — the COGS of the period's **food** goods.
- **Beverage cost** — the COGS of the period's **beverage** goods.
- **Labour cost** — the period's labour cost.
- **Fixed cost** — the period's fixed operating cost.
- **Extra cost** — one-time and extra operating costs recorded for the period; they appear in the monthly report only.
- **Total operating cost** — the sum of food cost, beverage cost, labour cost, fixed cost, and extra cost.
- **Variable cost** — the cost that moves with sales: **COGS plus labour cost**. The remainder of total operating cost is fixed.
- **Fixed costs** — the portion of total operating cost that does not move with sales: **fixed cost plus extra cost**.
- **Prime cost** — food cost plus beverage cost plus labour cost.
- **Operating profit** — net revenue less total operating cost.
- **Finance costs** — the month's interest, income tax, depreciation, and amortisation.
- **Net profit** — operating profit less finance costs.
- **EBITDA** — operating profit plus depreciation and amortisation; earnings before interest, tax, depreciation, and amortisation.
- **Covers** — the number of guests served in the period.
- **Labour hours** — the hours worked in the period.
- **Inventory value** — stock on hand valued at its current price per unit of stock; **average inventory value** is the mean of the period's opening and closing values.
- **Waste** — the stock that left the venue unexplained in the period, valued at cost.
- **Inventory variance** — the signed difference between actual and theoretical usage in the period.
- **Shrink** — the positive-only loss a count finds against the system count.

### Cost-category conventions

- **Food and beverage are classified by a good's main category**: a good whose main category is **Beverage** is a **beverage**; every other good is **food**. The split is deterministic and needs no per-good flag.
- **Prime cost is food plus beverage plus labour** — the industry definition. It is not food plus labour.
- Every cost category is published **three ways**: as an **amount**, as a **percentage of total sales**, and as a **percentage of total operating cost**.

### Terms this subject introduces

- **Cost target** — one of four target percentages of sales: **food**, **beverage**, **labour**, **fixed**.
- **Waste threshold** — a ceiling, one per budget-impact level, for supplier-good waste as a percentage of sales.
- **Budget-impact level** — the **Very Low → Very High** classification carried on a **supplier good** (defined by the supplier-goods subject). It selects which waste threshold applies to that good's waste.
- **Reporting week** — the seven-day window that groups daily sales reports into one weekly business report. Its first day is the **reporting-week start day**, expressed from `0` (Sunday) to `6` (Saturday).
- **KPI dictionary** — the platform's canonical list of named metrics (this document's §3.7), with units, direction, dimensions, and formulas.
- **Dimension vocabulary** — the standard breakdown axes (§3.5): category/subcategory, menu item, supplier good, supplier, employee, sales point/channel, daypart, table/seat, payment method, and promotion.
- **Channel** — how an order reached the venue: **dine-in** (staff service), **self-ordering**, **kiosk**, or **delivery**.
- **Daypart** — the fixed service period an order falls in: **breakfast**, **lunch**, **dinner**, or **late-night**.
- **Benchmark** — a reference industry range, shown for context, never policed.

**Seat count** and **floor area** are optional business attributes (the business subject owns them); when either is absent, the metrics that need it produce no value.

Terms reused from other subjects rather than redefined here: **business**, **supplier good**, **budget impact**, and **break-even**. Percent KPIs are expressed on a **`0..100`** scale; a division by zero yields `0`.

---

## 3. Capabilities

### 3.1 Cost targets

A business holds **four cost targets** — food, beverage, labour, and fixed.

- Each target is a **percentage of total sales**, not a percentage of the category's own sales. A food target of `30` means food cost is targeted at `30%` of total sales.
- Each target is validated in the **`0..100`** range and accepts decimals.
- The **four targets are independent**: Project Imperium places **no requirement that they sum to 100**. They describe different cost categories against the same denominator — total sales — not shares of a cost pool. Food and beverage together form COGS; food, beverage, and labour together form **prime cost**; the remainder is profit.
- Targets are **seeded at venue creation** with the platform defaults (§3.8) and are **editable** at any time by managers and above.
- The **actual** a target is compared against is the corresponding cost ratio **against total sales** for the report's period.

### 3.2 Supplier-good waste thresholds

Waste thresholds are **five ceilings**, one per **budget-impact level**, applied to supplier-good waste.

- Each threshold is the acceptable waste **ceiling for goods of that budget-impact level**, expressed as a **percentage of total sales**.
- The five levels are the canonical budget-impact values: **Very Low**, **Low**, **Medium**, **High**, **Very High**. The ordering is deliberate: a **higher budget impact means a lower tolerance**, because waste on an expensive good costs more.
- The **actual** for a level is that level's waste **cost as a percentage of total sales**; the ceilings do not blend into one figure — each level is compared on its own.
- Waste is **also published as a percentage of COGS** for the input view (§3.7). That view is **reference only**; only the percentage-of-sales ceiling is policed.
- Thresholds are seeded at venue creation with the platform defaults (§3.8) and are editable by managers and above.
- A level with **no waste recorded** and a level with **no supplier goods** at that impact simply produce no meaningful comparison; Project Imperium never fabricates a zero-waste result for a level that had no activity.

### 3.3 Reporting-week start day

- A business has a **reporting-week start day** from **`0` (Sunday)** to **`6` (Saturday)**; the default is **Monday (`1`)**.
- The start day defines the **reporting week** used to group **daily sales reports** into a **weekly business report**. It does **not** change the **calendar month** used by the monthly business report.
- Changing the start day affects **future** reporting weeks only. A week that has already been aggregated and closed keeps the window it was closed under; closed history is never silently re-bucketed.
- The start day is set by managers and above.

### 3.4 Targets vs actuals

- Project Imperium compares each **configured target** against its **actual** for the report period and records the **target**, the **actual**, the **delta**, and whether the metric is **over** or **under** target.
- The comparison is **derived** and **report-owned**; it is never a client-settable field. It is computed at report aggregation time and retained with the report.
- Comparison coverage:
  - the **weekly** business report compares the operational cost targets — **food**, **beverage**, and **labour**; **fixed cost** and the **waste thresholds** are excluded from the weekly view (waste waits for the monthly inventory close);
  - the **monthly** business report compares **all four cost targets** plus the **waste thresholds**.
- A target that has not been set is not compared. Because defaults are seeded at creation (§3.8), a venue begins with every target configured and may still clear any it does not want to police.
- Only **targets and waste thresholds** are policed. Every other KPI is **read-only** and, where a benchmark exists, is shown against that benchmark **for reference only**.

### 3.5 Dimensions

Every KPI is expressed for a **period** — a day, a week, or a month — and may be **sliced by dimensions**. The platform's standard dimensions are:

| Dimension | Values |
| --- | --- |
| **Category / subcategory** | The menu category and subcategory of a business good. |
| **Menu item** | A single business good. |
| **Supplier good** | A single purchasable item / unit of stock. |
| **Supplier** | A vendor the venue buys from. |
| **Employee** | A member of staff. |
| **Sales point / channel** | The sales point, or the channel: dine-in, self-ordering, kiosk, delivery. |
| **Daypart** | Breakfast, lunch, dinner, late-night. |
| **Table / seat** | A sales point of table or seat type. |
| **Payment method** | The method a bill was paid with. |
| **Promotion** | A promotion applied to orders. |

- The **period axis is always present**; the rest are optional breakdowns.
- Dayparts are a **fixed platform set** — breakfast, lunch, dinner, late-night — derived from the time an order was placed. Venues do not configure their own dayparts.
- Each KPI declares the dimensions it supports. To keep the catalogue readable, dimensions are stated **per family with inline exceptions** rather than repeated on every row.
- A breakdown over a dimension that has **no activity** produces **no value**; Project Imperium never fabricates a zero.

### 3.6 Benchmarks

- Each KPI carries an **industry benchmark** where a **credible published range exists**, and **no benchmark** where one does not — Project Imperium never fabricates a reference range.
- A benchmark is **reference only**: it is shown beside the actual for context and is **never policed, alerted on, or configured**. Only the cost targets and waste thresholds govern.
- Benchmarks are **platform-fixed** reference values; they are not venue-editable.
- A benchmark is stated as a **typical range** in the KPI's own unit (for example, prime cost `55–65%` of sales).

### 3.7 KPI catalogue

The platform's named metrics, grouped by family. Each row gives the unit, the direction that is "good", the **canonical formula**, the meaning, and the **benchmark** (`—` where none is published). Percentage KPIs are returned on the **`0..100`** scale (already multiplied by 100), and every division is guarded so a `0` denominator yields `0`.

#### Profitability

**Dimensions:** period; category, channel, daypart. **Exceptions:** net profit and EBITDA are **monthly-only**, with no dimensions beyond the period (their finance inputs are monthly).

| KPI | Unit | Good direction | Formula | Meaning | Benchmark |
| --- | --- | --- | --- | --- | --- |
| Gross profit | Business currency | Higher | `netRevenue - cogs` | Net revenue less COGS. | — |
| Gross profit margin | Percent | Higher | `(grossProfit / totalSales) * 100` | Gross profit as a share of total sales. | `60–70%` |
| Operating profit | Business currency | Higher | `netRevenue - totalOperatingCost` | Net revenue less total operating cost. | — |
| Operating profit margin | Percent | Higher | `(operatingProfit / totalSales) * 100` | Operating profit as a share of total sales. | — |
| Net profit | Business currency | Higher | `operatingProfit - financeCosts` | Operating profit less finance costs. | — |
| Net profit margin | Percent | Higher | `(netProfit / totalSales) * 100` | Net profit as a share of total sales. | `3–5%` |
| EBITDA | Business currency | Higher | `operatingProfit + depreciation + amortisation` | Earnings before interest, tax, depreciation, and amortisation. | — |
| EBITDA margin | Percent | Higher | `(ebitda / totalSales) * 100` | EBITDA as a share of total sales. | `10–15%` |
| Cost per cover | Business currency | Lower | `totalOperatingCost / covers` | Operating cost per guest served. | — |
| Prime cost | Business currency | Lower | `foodCost + beverageCost + laborCost` | Food, beverage, and labour cost combined. | — |
| Prime cost % of sales | Percent | Lower | `(primeCost / totalSales) * 100` | Prime cost over total sales. | `55–65%` |

#### Cost

**Dimensions:** period; category, channel, daypart. **Exceptions:** cost KPIs tied to stock (COGS, food cost, beverage cost) support supplier good and supplier.

Every cost category is published as an **amount**, as a **percentage of total sales**, and as a **percentage of total operating cost**. The composite rows follow the same three views.

| KPI | Unit | Good direction | Formula | Meaning | Benchmark |
| --- | --- | --- | --- | --- | --- |
| Food cost | Business currency | Lower | `COGS of food goods` | Cost of the food sold. | — |
| Food cost % of sales | Percent | Lower | `(foodCost / totalSales) * 100` | Food cost over total sales — the **food target**. | `28–35%` |
| Beverage cost | Business currency | Lower | `COGS of beverage goods` | Cost of the beverage sold. | — |
| Beverage cost % of sales | Percent | Lower | `(beverageCost / totalSales) * 100` | Beverage cost over total sales — the **beverage target**. | `18–25%` |
| Labour cost | Business currency | Lower | `period labour cost` | Cost of labour. | — |
| Labour cost % of sales | Percent | Lower | `(laborCost / totalSales) * 100` | Labour cost over total sales — the **labour target**. | `30–35%` |
| Fixed cost | Business currency | Lower | `fixed operating cost` | Fixed operating cost. | — |
| Fixed cost % of sales | Percent | Lower | `(fixedCost / totalSales) * 100` | Fixed cost over total sales — the **fixed target**. | `20%` |
| Extra cost | Business currency | Lower | `one-time and extra operating cost` | Ad-hoc operating cost, monthly only. | — |
| Occupancy cost | Business currency | Lower | `rent + utilities + occupancy charges` | Occupancy-related cost. | — |
| Occupancy cost % of sales | Percent | Lower | `(occupancyCost / totalSales) * 100` | Occupancy cost over total sales. | `≤10%` |
| Paper / consumables cost | Business currency | Lower | `period consumables cost` | Non-food consumables (packaging, paper). | — |
| Paper / consumables cost % of sales | Percent | Lower | `(paperCost / totalSales) * 100` | Consumables cost over total sales. | `1–3%` |
| COGS | Business currency | Lower | `foodCost + beverageCost` | Cost of goods sold. | — |
| COGS % of sales | Percent | Lower | `(cogs / totalSales) * 100` | COGS over total sales. | `30–35%` |
| Total operating cost | Business currency | Lower | `cogs + laborCost + fixedCost + extraCost` | All operating cost combined. | — |
| Variable cost ratio | Ratio | Lower | `variableCost / totalSales` | Variable cost over total sales. | — |
| Cost category % of operating cost | Percent | Lower | `(costCategory / totalOperatingCost) * 100` | Any cost category as a share of total operating cost (the second view). | — |

#### Sales quality

**Dimensions:** period; category, menu item, employee, sales point/channel, daypart, table/seat, payment method, promotion.

| KPI | Unit | Good direction | Formula | Meaning | Benchmark |
| --- | --- | --- | --- | --- | --- |
| Gross sales | Business currency | Higher | `sum of order gross value` | Sales value before adjustments. | — |
| Total sales | Business currency | Higher | `gross sales before adjustments` | The canonical sales figure; the ratio denominator. | — |
| Net revenue | Business currency | Higher | `amount actually paid` | Sales after voids, discounts, and complimentary items. | — |
| Average daily sales | Business currency | Higher | `totalSales / daysInPeriod` | Total sales spread across the period's days. | — |
| Average spend per customer | Business currency | Higher | `netRevenue / covers` | Net revenue over guests served. | — |
| Sales per labour hour | Business currency | Higher | `totalSales / laborHours` | Sales over hours worked. | — |
| Revenue per seat hour (RevPASH) | Business currency | Higher | `netRevenue / (seatCount * serviceHours)` | Revenue per available seat hour. | — |
| Sales per floor area | Business currency | Higher | `totalSales / floorArea` | Sales per unit of floor area. | — |
| Category sales mix | Percent | — | `(categorySales / totalSales) * 100` | A category's sales over total sales. | — |
| Channel sales mix | Percent | — | `(channelSales / totalSales) * 100` | A channel's sales over total sales. | — |
| Daypart sales mix | Percent | — | `(daypartSales / totalSales) * 100` | A daypart's sales over total sales. | — |
| Sales payment completion | Percent | Higher | `(netRevenue / totalSales) * 100` | Net revenue over total sales. | — |
| Void sales % | Percent | Lower | `(voidSales / totalSales) * 100` | Void value over total sales. | `<1–2%` |
| Invited sales % | Percent | Lower | `(invitedSales / totalSales) * 100` | Complimentary value over total sales. | `1–3%` |
| Discount sales % | Percent | Lower | `(discountValue / grossSales) * 100` | Discount value over gross sales. | `1–5%` |
| Tips | Business currency | Higher | `period tips` | Tips received. | — |
| Tips % of sales | Percent | — | `(tips / totalSales) * 100` | Tips over total sales. | — |
| Tips % of COGS | Percent | — | `(tips / cogs) * 100` | Tips over COGS. | — |

#### Labour

**Dimensions:** period; employee, daypart, channel.

| KPI | Unit | Good direction | Formula | Meaning | Benchmark |
| --- | --- | --- | --- | --- | --- |
| Labour hours | Hours | — | `hours worked` | Actual hours worked. | — |
| Scheduled labour hours | Hours | — | `hours scheduled` | Planned hours from the schedule. | — |
| Covers per labour hour | Ratio | Higher | `covers / laborHours` | Guests served per hour worked. | — |
| Labour cost per hour | Business currency | Lower | `laborCost / laborHours` | Labour cost per hour worked. | — |
| Overtime % | Percent | Lower | `(overtimeHours / laborHours) * 100` | Overtime over hours worked. | `<5%` |
| Staff turnover rate | Percent | Lower | `(terminations / averageHeadcount) * 100` | Leavers over average headcount. | `70–80%` per year (annualised) |
| Absenteeism rate | Percent | Lower | `(absentShifts / scheduledShifts) * 100` | Missed shifts over scheduled shifts. | `2–4%` |
| Schedule adherence | Percent | Higher | `(workedHours / scheduledHours) * 100` | Worked over scheduled hours. | `>95%` |
| Vacation taken | Days | — | `days of vacation used` | Vacation days used in the period. | — |
| Vacation remaining | Days | — | `allowance - taken` | Vacation days left. | — |

#### Inventory and purchasing

**Dimensions:** period; supplier good, supplier, category.

| KPI | Unit | Good direction | Formula | Meaning | Benchmark |
| --- | --- | --- | --- | --- | --- |
| Inventory turnover | Ratio | Higher | `cogs / averageInventoryValue` | How many times stock turns over in the period. | `4–8×` per year (annualised) |
| Days of inventory on hand | Days | Lower | `averageInventoryValue / cogs * daysInPeriod` | How long stock lasts. | `5–15 days` |
| Inventory value | Business currency | — | `stock on hand * price per unit of stock` | Value of stock on hand. | — |
| Inventory variance | Business currency | — | `signed actual usage − theoretical usage, at cost` | Signed usage gap; both directions shown. | — |
| Inventory variance % of sales | Percent | Lower | `(variance / totalSales) * 100` | Variance over total sales. | — |
| Inventory variance % of COGS | Percent | Lower | `(variance / cogs) * 100` | Variance over COGS. | — |
| Waste | Business currency | Lower | `unexplained stock loss, at cost` | Unexplained loss, valued at cost. | — |
| Waste % of sales | Percent | Lower | `(waste / totalSales) * 100` | Waste over total sales. | — |
| Waste % of COGS | Percent | Lower | `(waste / cogs) * 100` | Waste over COGS (the input view). | `4–10%` |
| Shrink % | Percent | Lower | `(shrink / totalSales) * 100` | Count loss over total sales. | — |
| Theoretical usage | Quantity | — | `recipe consumption of goods sold` | Expected usage from recipes. | — |
| Actual usage | Quantity | — | `opening + purchases + transfers in − transfers out − closing` | Usage from the stock ledger. | — |
| Theoretical food cost % | Percent | Lower | `(theoreticalFoodCost / totalSales) * 100` | What food should have cost. | — |
| Food cost variance | Percent | Lower | `((actualFoodCost - theoreticalFoodCost) / totalSales) * 100` | Actual over theoretical food cost. | `<2%` well-managed; `>5%` investigate |
| Purchase spend | Business currency | Lower | `sum of purchase totals` | What the venue spent on goods. | — |
| Supplier spend concentration | Percent | — | `(supplierSpend / totalPurchaseSpend) * 100` | A supplier's share of spend. | — |
| Purchase price variance | Percent | Lower | `((actualPrice - previousPrice) / previousPrice) * 100` | Price change against the prior price. | — |
| Par-level compliance | Percent | Higher | `(goods at or above par / countable goods) * 100` | Goods replenished to par. | — |
| Stock-out rate | Percent | Lower | `(goods at zero stock / countable goods) * 100` | Goods with no stock. | — |
| Purchase fill rate | Percent | Higher | `(deliveredQuantity / requestedQuantity) * 100` | Delivered over requested quantity. | — |
| Count frequency | Ratio | — | `counts in the period` | How often goods are counted. | — |

#### Menu engineering

**Dimensions:** period; menu item, category.

| KPI | Unit | Good direction | Formula | Meaning | Benchmark |
| --- | --- | --- | --- | --- | --- |
| Item sales mix | Percent | — | `(itemQuantitySold / totalItemsSold) * 100` | An item's share of units sold. | — |
| Item contribution margin | Business currency | Higher | `itemSellingPrice - itemCost` | Margin an item contributes. | — |
| Item contribution margin % | Percent | Higher | `(itemContributionMargin / itemSellingPrice) * 100` | Item margin over its price. | — |
| Item food cost % | Percent | Lower | `(itemCost / itemSellingPrice) * 100` | An item's cost over its price. | — |
| Item theoretical cost | Business currency | — | `recipe cost of one item` | Expected cost of one item. | — |
| Menu engineering class | Category | — | popularity and margin against the menu average | Star, plowhorse, puzzle, or dog. | — |

#### Operations

**Dimensions:** period; sales point, table/seat, daypart, employee, channel.

| KPI | Unit | Good direction | Formula | Meaning | Benchmark |
| --- | --- | --- | --- | --- | --- |
| Covers | Count | Higher | `guests served` | Guests served in the period. | — |
| Average dwell time | Minutes | — | `sum of session durations / sessions` | How long a table is held. | — |
| Table turnover rate | Ratio | Higher | `(covers / tableCount) / serviceHours` | Turns per table per service hour. | — |
| Seat occupancy | Percent | Higher | `(occupied seat hours / available seat hours) * 100` | Seats in use over seats available. | — |
| Order accuracy | Percent | Higher | `((orders - voidedOrders) / orders) * 100` | Orders served without a void. | `>95%` |
| Ticket time | Minutes | Lower | `average time from order to service` | How long an order takes to serve. | — |
| Reservation no-show rate | Percent | Lower | `(noShows / reservations) * 100` | Reservations not honoured. | `5–10%` |
| Reservation cancellation rate | Percent | Lower | `(cancellations / reservations) * 100` | Reservations cancelled. | — |
| Delivery on-time rate | Percent | Higher | `(onTimeDeliveries / deliveries) * 100` | Deliveries on time. | `>90%` |
| Delivery sales % | Percent | — | `(deliverySales / totalSales) * 100` | Delivery over total sales. | — |
| Average delivery order value | Business currency | Higher | `deliverySales / deliveryOrders` | Net revenue per delivery order. | — |

#### Customer

**Dimensions:** period. The customer family covers only the signals the platform already produces; customer-satisfaction surveys — NPS, complaint tracking, and satisfaction scores — are **not** covered.

| KPI | Unit | Good direction | Formula | Meaning | Benchmark |
| --- | --- | --- | --- | --- | --- |
| Average rating | Rating (0–5) | Higher | `sum of ratings / ratingCount` | Mean venue rating. | `4.5+` |
| Review volume | Count | Higher | `ratings received` | Number of ratings in the period. | — |
| Rating distribution | Percent | — | `(ratingsAtLevel / ratingCount) * 100` | Share of ratings at each star level. | — |

#### Promotion and bar controls

**Dimensions:** period; promotion, menu item, category, channel, daypart.

| KPI | Unit | Good direction | Formula | Meaning | Benchmark |
| --- | --- | --- | --- | --- | --- |
| Promotion sales mix | Percent | — | `(promoSales / totalSales) * 100` | Promotional sales over total sales. | — |
| Promotion discount rate | Percent | Lower | `(promoDiscountValue / grossSales) * 100` | Discount value over gross sales. | — |
| Promotion ROI proxy | Ratio | Higher | `incrementalPromoSales / promoDiscountValue` | Incremental promotional sales per discount unit. | — |
| Pour cost | Percent | Lower | `(beverageUsedCost / beverageSales) * 100` | Beverage used cost over beverage sales. | `18–25%` |
| Beverage variance | Percent | Lower | `((actualUsage - theoreticalUsage) / theoreticalUsage) * 100` | Actual usage above theoretical, over theoretical. | — |

### 3.8 Platform defaults

A business is **created with industry-calibrated defaults** written onto its metrics, which the venue may then edit. The defaults are ordinary targets once stored — nothing about them is special after creation. Benchmarks (§3.6) are separate: they are platform-fixed and never editable.

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

The cost targets follow the industry convention that **prime cost** (food plus beverage plus labour) is the dominant controllable cost, targeted at roughly **`55–65%`** of sales, with fixed cost and profit taking the remainder — which is why the cost targets are **not** required to sum to `100`.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Business-metrics powers |
| --- | --- |
| **Customer** | None. |
| **Employee** | None by default; may be granted a capability (see below). |
| **Supervisor** | None by default; may be granted a view capability via report view grants. Does not edit targets or thresholds. |
| **Manager** | Sets and edits the **cost targets**, the **waste thresholds**, and the **reporting-week start day**. |
| **Admin** | Everything a manager can do, plus full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| Set or edit cost targets | Managers and above |
| Set or edit supplier-good waste thresholds | Managers and above |
| Set or edit the reporting-week start day | Managers and above |
| View metrics, benchmarks, and the target comparison | Whoever may view the weekly/monthly business report (the business-reports subject's rule) |

Editing metrics is an operational, not an ownership, act; it sits with the managers who own reporting and cost control, consistent with opening hours, delivery configuration, and inventory closure.
