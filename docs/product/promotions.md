# Promotions

> **About this document.** This is the **target-state source of truth** for promotions in Project Imperium — the discount rules a venue defines, the menu and time they are scoped to, and how they take effect on orders. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes promotions as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **promotion**: a venue-defined price rule that discounts selected parts of the menu over a bounded time and takes effect on orders as they are taken. It covers:

- the **promotion type** — the six discount kinds a venue may choose;
- the **target scope** — the menu subcategories a promotion applies to;
- the **active window** — the dates, daily hours, and weekdays a promotion runs over;
- the **enabled switch** — creating a promotion disabled, enabling it, and the rule that enabled promotions may not overlap in time where their subcategory scopes intersect;
- the **delivery extension** — whether a promotion reaches delivery orders;
- how a promotion is applied to orders in real time, including the group behaviour of the multi-buy types;
- the promotion's **editing, disabling, and deletion**; and
- the promotion as the unit reporting and customer engagement attribute to.

It deliberately does **not** cover:

- **how an order prices and records a discount** — the price and cost an order carries, the promotion attached to it, the repricing of an open tab, the moment a discount becomes final, and the **manual discount** a manager may apply instead belong to the orders subject. This subject defines the rule that order applies.
- **the menu and its categories** — the business goods a venue sells and the **subcategory tree** a promotion targets belong to the business-goods subject. This subject reads that tree when it scopes a promotion.
- **gift cards** — a gift card's issuance, balance, and redemption are the gift-cards subject's concern; a gift card is **not** a promotion, and this subject does not decide whether it stacks with one.
- **promotion reporting and metrics** — the promotion dimension, the promotion sales-mix and discount KPIs, and how a promotion is presented in the daily, weekly, and monthly reports belong to the business-metrics and business-reports subjects.
- **delivering promotion messages** — the inbox broadcast a venue's customers receive when a promotion's window begins belongs to the notifications subject, and its email copy to the emails subject.
- **billing and tax** — the payments-and-tax subject owns how a discounted bill settles and how tax is computed.
- the **order lifecycle** — voids, invitations, cancellations, transfer, and the bill belong to the orders subject.

---

## 2. Domain model and vocabulary

### Entities

- **Promotion** — a venue-defined price rule that discounts selected menu subcategories over a bounded time and applies to orders in real time. A promotion belongs to **exactly one Business**, is created **disabled**, and carries a name, an optional description, a **type**, a **target scope**, an **active window**, an enabled switch, and a **delivery extension**.

### Terms this subject introduces

- **Promotion type** — one of six discount kinds: **percentage discount**, **fixed price**, **2×1**, **3×2**, **second item half price**, and **full complimentary**.
- **Target scope** — the **one or more menu subcategories** a promotion applies to. Targeting a subcategory covers every business good at or beneath it.
- **Active window** — the time a promotion runs: an **active period** (an inclusive start and end date), an optional **daily hours** range, and the **weekdays** it runs on. All three must hold for a promotion to apply.
- **Enabled** / **disabled** — the venue's on/off switch for a promotion. A promotion is created **disabled** and applies only while **enabled**.
- **Delivery extension** — the switch that decides whether a promotion also reaches **delivery** orders; while off, a promotion never applies to delivery.
- **Subcategory** — a node in the venue's menu tree, and the unit a promotion targets. The menu's categories and subcategories are the business-goods subject's concern.

Terms reused rather than redefined here: **Business**, **Business good**, **Order**, **Sales instance**, **Channel**, **Add-on**, **Customer**, **business currency**, and **soft delete**.

---

## 3. Capabilities

### 3.1 The promotion

- A venue defines its own promotions; each belongs to exactly one business and is never shared across venues.
- A promotion carries a **name** (required, unique among the venue's active promotions) and an optional **description**.
- A promotion is created **complete and disabled**: its type, target scope, active window, and delivery extension are all set at creation, and it does nothing until its enabled switch is turned on. There is **no draft state** — the enabled switch, not incompleteness, is why a new promotion is inert.

### 3.2 The six types

- **Percentage discount** — each matching main good is reduced by a venue-set percentage of its selling price.
- **Fixed price** — each matching main good sells at a venue-set promotional price per unit, in the business currency. It can only reduce, never raise, what the customer pays: a good whose normal price is at or below the promotional price is left unchanged.
- **2×1** — for every two matching main goods, the customer pays for one.
- **3×2** — for every three matching main goods, the customer pays for two.
- **Second item half price** — for every two matching main goods, the cheaper is half price.
- **Full complimentary** — every matching main good is free.

### 3.3 Target scope

- A promotion targets **one or more subcategories** of the venue's menu.
- Targeting a **subcategory covers every business good at or beneath it** in the menu tree, so a lower target applies to fewer goods.
- A promotion never targets a single business good directly; its scope is always one or more subcategories.
- Scope reads the **menu as it stands**: a good moved into a targeted subcategory becomes covered, and one moved out stops being covered. The menu tree itself, and the rule that subcategories nest, belong to the business-goods subject.
- A promotion **never touches an add-on**. Add-ons are outside its scope even when their own subcategory is targeted; the discount always lands on the order's **main good**.

### 3.4 Active window

- A promotion's **active period** is an inclusive start and end date, in the venue's timezone.
- **Daily hours** are an optional start and end clock time **within a single day** — the window does not cross midnight. When set, the promotion applies only between them each day; when left unset, it applies all day.
- **Weekdays** are the days of the week it runs on, chosen freely; **weekends** and **weekdays** are offered as shortcuts.
- A promotion applies only while the current moment is inside **all three** — inside the period, inside the hours, and on a selected weekday.

### 3.5 Enabling and the overlap rule

- A promotion is created **disabled**; the venue enables it with a switch and may disable it again at any time. Disabling stops it applying at once: an order still on an open tab loses the promotion, while an order already settled is never altered.
- A venue may hold **as many promotions as it needs**, with any windows and target scopes, overlapping freely — while disabled, nothing conflicts.
- **Enabling is guarded.** Enabling a promotion is **blocked, with a warning naming the conflict**, when it would overlap an already-**enabled** promotion: their active windows share any moment **and** their target scopes intersect — the same subcategory, or one an ancestor or descendant of the other.
- The same guard applies when an **enabled** promotion is **edited**, so an edit cannot silently create a collision.
- Once enabled, a promotion's standing follows its window as a **derived label**: **Scheduled** before it begins, **Active** while it runs, and **Ended** after it closes. These labels are never set by hand.

### 3.6 Real-time application to orders

- A promotion applies to an order only when the order's **creation moment** falls inside the promotion's active window while it is enabled, and the order's **main good** sat inside the target scope **at that moment**. A later move of the good between subcategories never qualifies an order already placed.
- Because overlapping enabled promotions are refused, a good is targeted by **at most one** enabled promotion whose active window is current at a time, so a single promotion covers an order.
- **Percentage discount**, **fixed price**, and **full complimentary** apply to **each** matching order on its own.
- The **multi-buy** types — **2×1**, **3×2**, and **second item half price** — group matching orders on the **same sales instance**. Groups are filled from the most expensive matching order downward, and the **cheapest order in each group** is the one discounted, so the customer always pays in full for the most expensive goods. Matching orders left over after grouping are charged in full.
- The goods' **full price is recorded** as orders are added; the promotion's discount is applied while the tab is **open** and may reprice an already-added order as further matching orders complete a group. The amount is **final** once the order is settled.
- A promotion applies to orders taken through every channel **except delivery**; the **delivery extension** adds delivery. The channels themselves belong to the sales-points-and-instances and order-flow subjects.

### 3.7 Editing, disabling, and deletion

- A promotion is **fully editable at any time** — its type, target scope, active window, name, description, and delivery extension. An edit takes effect at once for open tabs and for orders placed after it; an order already settled is never altered. Editing an enabled promotion re-runs the overlap guard (§3.5).
- Disabling a promotion stops it applying at once; its past applications remain in reporting.
- A promotion is **soft-deleted**: the record is retained and marked deleted, never hard-removed, and may be reactivated; its name is unique among active promotions. Deleting a promotion stops it applying and leaves its past applications in reporting.
- A promotion **never blocks deleting a business good** it covers: it targets a subcategory, not a good, so the menu may change freely and the promotion simply stops covering what is gone.

### 3.8 Reporting, metrics, and engagement

- The **promotion an order carries** is retained, so reporting attributes the order's discount to the promotion across the promotion dimension and computes the promotion sales mix, promotion discount rate, and promotion ROI proxy the business-metrics and business-reports subjects define.
- When a promotion's **active window begins**, Project Imperium sends the venue's related customers a **Promotion** engagement message; the notifications and emails subjects own its delivery. An **edit or re-enable does not re-broadcast** — only a window beginning does.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Promotion powers |
| --- | --- |
| **Customer** | Enjoys promotions as they apply to orders; never authors or configures one. |
| **Employee** | Everything a customer can do; takes orders that promotions apply to; never authors or configures a promotion. |
| **Manager** | Creates, edits, enables, disables, and deletes promotions; sets their type, target scope, active window, and delivery extension. |
| **Admin/owner** | Everything a manager can do, plus full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| Create, edit, and delete a promotion | Managers and above |
| Enable or disable a promotion | Managers and above |
| Set the target subcategories, the active period, daily hours, weekdays, type, and delivery extension | Managers and above |
| Enjoy a promotion on an order | Any customer or staff member taking an order |
| Author or configure a promotion | Managers and above — never an employee, a customer, or the superadmin |
