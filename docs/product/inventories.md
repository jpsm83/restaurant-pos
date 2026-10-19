# Inventory

> **About this document.** This is the **target-state source of truth** for inventory in Project Imperium — the stock a venue holds and the stock it moves between its sibling venues. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes inventory as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **stock a venue holds**: how it is tracked, counted, valued, reconciled, closed, and moved between the venues of one tax entity. It owns:

- the **dynamic system count** — the live, running quantity held per supplier good;
- **physical counts** — who counts, how a count is recorded, and the lock on a submitted count;
- **count periods** and their **deviation**;
- the **monthly resume** — the aggregation of a month's count periods — its **close** and its **reopen**;
- the **variance** between theoretical and actual usage;
- **waste** — the loss a good's budget impact measures;
- **low-stock** and **negative-stock** detection;
- **inventory value**;
- **inventory transfers** between the venues of one Company, valued at cost, with a full audit; and
- the inventory's interaction with a **closed month**.

It deliberately does **not** cover:

- the **supplier good** — its identity, unit of stock, purchase unit and price math, budget impact, allergens, par level and minimum required, in-use state, and deletion belong to the supplier-goods subject. Inventory keeps a stock line per supplier good; it never defines the good.
- the **purchase record** and the increment a receipt contributes — the purchases subject owns the purchase; inventory owns the ledger the increment lands in.
- **what a sold good consumes** — the recipes, combos, and add-ons belong to the business-goods subject, and the orders that sold them belong to the orders subject. Inventory only reads them to compute theoretical usage.
- **availability** — how a business good becomes available or sold out belongs to the business-goods subject; inventory only supplies the stock figure that subject reads.
- the **waste thresholds** — the business-metrics subject owns the ceilings a budget impact selects; inventory computes the waste those ceilings are compared against.
- **notification delivery** — the notifications subject owns how an alert reaches its recipient; inventory owns the conditions it detects.
- the **reports** that present inventory — the business-reports subject owns them.
- the **Business**, the **Company**, and the **Owner** — the business and users subjects own them; a transfer is confined to one Company.
- **amounts payable to a supplier**, supplier invoices, and inter-company tax — none are part of Project Imperium.

---

## 2. Domain model and vocabulary

### Entities

- **Inventory** — the stock ledger of one Business. It holds one **stock line** per supplier good, records the venue's **count periods**, and carries the month's **resume**. It is internal to the business and never visible to customers.
- **Stock line** — the inventory's per-good record: the good's **dynamic system count**, its **last-counted date**, and its **count periods** with their deviations.
- **Count** — a physical count of one supplier good at one moment: the counted quantity, who counted, when, and an optional comment.
- **Count period** — the interval a good's most recent count closes: from the good's previous count to this one.
- **Monthly resume** — the aggregation of one month's count periods, usage variance, and waste, reviewed and closed once a month.
- **Inventory transfer** — a movement of a supplier good from one venue to another **under the same Company**.

### Terms this subject introduces

- **Dynamic system count** — also **stock on hand**: the quantity the venue is expected to hold of a good right now, in the good's unit of stock. It is **live**, moved by purchases received, orders, order cancellations, transfers, and counts, and it is the number availability reads.
- **Physical count** — a hands-on count of a good.
- **Deviation** — the counted quantity against the expected (system) quantity, in quantity and percent; a perfect count deviates by zero.
- **Count-period deviation** — the deviation recorded for the interval a count closes. It **resets** at each period boundary.
- **Closing count** — the count taken on the **morning of the first day of the following month**, which closes the prior month and opens the next.
- **Theoretical usage** — the quantity of a good the venue should have used, derived from the recipes of the business goods sold.
- **Actual usage** — the quantity the venue did use, derived from opening stock plus stock in minus stock out and closing stock.
- **Variance** — theoretical usage against actual usage, per good.
- **Waste** — the excess of actual usage over theoretical usage: stock that left the venue unexplained. It is valued at cost and graded by **budget impact**.
- **Inventory value** — stock on hand valued at the good's **price per unit of stock**.
- **Low stock** — a good whose stock on hand is below its **minimum required**.
- **Negative stock** — a good whose stock on hand is below zero.
- **Uncounted** — a good with no count in the month.

Terms reused from other subjects rather than redefined here: **Business**, **Company**, **Owner**, **Supplier**, **Supplier good**, **unit of stock**, **purchase unit**, **price per unit of stock**, **par level**, **minimum required**, **budget impact**, **in use**, **managers on duty**, **total sales**, and **soft delete**.

---

## 3. Capabilities

### 3.1 The dynamic system count

- Every good the business stocks has one **stock line** whose **dynamic system count** is expressed in the good's **unit of stock**.
- The count is **live and continuous**. It rises with a received purchase and a transfer in; it falls with a sold order and a transfer out; a cancelled order restores it; a physical count **sets** it.
- The count is the stock figure the venue's menu reads when it decides what can be sold; how a good becomes available or sold out belongs to the business-goods subject.
- The count **may fall below zero**. It is never blocked, because operational reality wins; a negative count is a signal that the stock records and the shelf disagree.
- Quantities are kept in the good's unit of stock: a recipe or a count expressed in a compatible unit is converted before it moves the count.

### 3.2 Physical counts

- A count is performed **whenever the business decides**. Routine counting follows **no fixed schedule and no cadence**: a good may be counted as often as the venue likes, and different goods may be counted at different rhythms. The one fixed count is the month's **closing count** (§3.4). The inventory shows each good's **last-counted date** so the venue can see how far a good is from its last count.
- A count records the **counted quantity**, **who** counted, **when**, and an optional **comment**.
- A count is **submitted and locked**. Once submitted, it cannot be changed by the person who made it; correcting it requires **supervisor layer or above**, a **reason**, and leaves an **audit record** of who re-edited, when, why, and the values before and after. A count is **never removed**.
- A count **sets** the good's stock on hand to the counted quantity and records the **deviation** against the expected count at that moment.
- Counting a good whose quantity matches what was expected is a valid count; its deviation is zero.

### 3.3 Count periods and deviation

- Each count **closes** the period that began at the good's previous count and **opens** the next. The closed period retains its **deviation**.
- **Deviation resets** at each period boundary; the new period starts from the count.
- A period's deviation measures how accurately the good has been used since its last count — the accumulated difference between the expected and the counted stock.
- A count advances the good's **last-counted date**.

### 3.4 The monthly resume

- A month's count periods are aggregated into a **monthly resume**: the month's counts and their deviations, the month's usage **variance**, and the month's **waste**, so the venue can see how good or bad the month was.
- The month is bounded by its **closing count** — taken on the **morning of the first day of the following month**, before deliveries and service, so the whole of the last day is covered. That count closes the month and opens the next, so the month's figures need **no proportional proration**.
- A good with **no count in the month** contributes its **running** figure and is marked **uncounted**; a missing count never blocks the close.
- When the resume is ready, Project Imperium notifies the venue's managers and above, and a **manager closes the month** after reviewing it. Closing is a deliberate act, never automatic.
- Closing the month **locks** it: its counts, its purchases, and its transfers become read-only and its figures are frozen.
- A closed month is reopened only by a membership that holds the **General Manager** or **Owner** job role, with a **reason** and an audit record.

### 3.5 Variance

- **Theoretical usage** is derived from the recipes of the business goods sold in the month: each sold good is expanded into its supplier-good components — including add-ons and combo members — and summed per good.
- **Actual usage** is opening stock, plus stock in (purchases received and transfers in), minus stock out (transfers out) and closing stock.
- **Variance** is theoretical usage against actual usage, per good, in the good's unit of stock and in value.
- Variance is **signed**. A good used **less** than expected (more stock than there should be) and a good used **more** than expected point at different problems, so both are shown.
- Variance is derived and report-owned; it is never entered by hand.

### 3.6 Waste

- **Waste** is the stock that left the venue **unexplained** — the excess of actual usage over theoretical usage — valued at the good's cost.
- A count that finds **more** stock than expected is the opposite of waste and is **not** reported as waste.
- Waste is graded by the good's **budget impact**; each grade is measured as a **percentage of total sales** — the view its **waste threshold** polices — and is also shown as a **percentage of COGS** for the input view.
- Waste is derived from the counts and the movements. There is **no separate waste entry to log**.
- A grade with no waste, or with no goods at that impact, simply produces no comparison; Project Imperium never fabricates a zero-waste result.

### 3.7 Low stock and negative stock

- A good whose stock on hand falls **below its minimum required** raises a **low-stock alert** to the venue's managers on duty; the **par level** is the level to replenish to.
- Every good — **in use or not** — alerts on low stock.
- A good whose stock on hand falls **below zero** raises a **negative-stock alert** to the managers on duty, as a management-error signal that purchases or counts are missing.
- Alerts repeat on a cooldown; how each alert is delivered belongs to the notifications subject.

### 3.8 Inventory value

- Stock on hand is valued at the good's **current price per unit of stock**, giving the venue's **inventory value**.
- Inventory value feeds the venue's inventory-turnover measure; the meaning and the formula of that measure belong to the business-metrics subject.

### 3.9 Inventory transfers

- Stock moves between venues **only within the same Company** — the venues that share one tax entity. A transfer **between different Companies is not allowed**, and **no transfer crosses Owners**.
- A transfer names one **supplier good at the source venue** and its **matching supplier good at the destination venue**. Once the pair is linked it is reused for later transfers.
- On the first transfer from a source venue, the destination gains a **supplier record representing the source venue**, carrying that venue's details, and a **matching supplier good** — the source good's identity, unit of stock, purchase unit, budget impact, allergens, par level, and minimum. Both are then ordinary records the destination may edit.
- A transfer is **valued at the source good's current cost per unit of stock** — the price per unit of stock of the good it moves.
- A transfer adjusts **both venues' stock** in one step: it leaves the source and arrives at the destination. It is **not a sale and not a purchase**, and **no tax is computed** on it; it is a movement inside one Company.
- A transfer lands in the **month** its date falls in, and is **blocked while that month is closed**.
- A transfer leaves a full **audit trail** — who, when, the goods, the quantity, and the value — and is corrected only by a **reverse transfer** or an **audited edit with a reason**. It is never removed.
- The transfer appears in the inventory's transfer history; it **never appears as customer sales**.

### 3.10 Deletion

- A supplier good is **soft-deleted** by the supplier-goods subject. Its stock line leaves the current inventory, while its past periods, counts, and transfers **remain as history**.

---

## 4. Roles and entitlements

Inventory is an internal, operational, management surface: never visible to customers, and never exposed to a supplier.

### Base access layers

| Layer | Inventory powers |
| --- | --- |
| **Customer** | None. Inventory is never visible to customers. |
| **Employee** | Performs **physical counts**; views stock only when granted the capability. |
| **Supervisor** | Performs physical counts; re-edits submitted counts with a reason and an audit (supervisor-layer default); views stock when granted the capability or as feature defaults allow. Does not create transfers or close the month. |
| **Manager** | Re-edits counts with a reason and an audit, creates transfers, closes the month, and views variance, waste, and value. Month reopen is General Manager or Owner job role only. |
| **Admin/owner** | Everything a manager can do, plus full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| Perform a physical count | Employees, supervisors, and managers and above |
| Re-edit a submitted count, with a reason and an audit | Supervisor layer and above |
| View stock, counts, variance, waste, and value | Managers and above; employees or supervisors with the granted capability |
| Create an inventory transfer (within one Company only) | Managers and above |
| Close the month | Managers and above |
| Reopen a closed month, with a reason and an audit | General Manager or Owner job role |
| Receive low-stock and negative-stock alerts | The venue's managers on duty |

Inventory sits with the managers who run purchasing and stock, consistent with the supplier, supplier-good, and purchase surfaces.
