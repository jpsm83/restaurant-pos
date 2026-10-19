# Orders

> **About this document.** This is the **target-state source of truth** for orders in Project Imperium — the billable lines a venue sells, the batches they are sent in, and the path an order travels from the till through prep-area fulfilment to the bill. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes orders as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **order** — the billable line a venue sells — and the **batch** it is sent in. It covers:

- the **order** and its composition: one **main good** plus its **add-ons**;
- **add-ons** on an order — several, and repeats of the same one;
- the **batch** — the group of orders sent to the kitchen/bar together — and its **identification code**;
- **drafting and sending** — the freely editable draft, the send that commits a batch, and the immutability that follows;
- **attribution** — who created an order and who sent a batch, and in what capacity;
- **pricing and cost** — the price and cost an order records;
- **promotions** applied to orders, and the **manual discount** a manager may apply instead;
- the **order lifecycle** — transfer, void, invitation, and cancellation;
- the **fulfilment status** of a batch's **prep-area slices**, including **held** batches and **don't-make** orders; and
- the **bill** as the aggregation of a sales instance's batches.

It deliberately does **not** cover:

- the **sales point and sales instance** — where a guest sits, opening a tab, the one-open rule, self-service instances, and the handover verification of a self-service order belong to the sales-points-and-instances subject. This subject's orders attach to the instance that subject owns.
- the **end-to-end service journey** and the surface flows (dine-in, QR self-ordering, kiosk, delivery) and **to-go packaging** — the order-flow subject owns the journey; this subject owns the order and its batch as they travel through it.
- **billing and settlement** — splitting a bill, taking payments, the methods, tips, refunds, and tax belong to the payments-and-tax subject; the order-flow subject owns the journey that reaches settlement and the closing of the instance. This subject owns the order's billable state and the bill's composition; tips are noted here only for reference.
- **promotion rules** — the types, scoping, and availability of a promotion belong to the promotions subject. This subject owns how a promotion is applied to an order and the manual discount that may replace it.
- **business goods** — composition, selling price, derived cost, preparation time, categories, and allergens belong to the business-goods subject. This subject reads them when it prices and costs an order; the display and filtering of allergens across the menu belong to that subject too.
- **the inventory ledger** — the stock an order moves belongs to the inventories subject; this subject only states when an order moves it.
- **printing and screens** — printer routing and the kitchen, bar, delivery, and pickup surfaces belong to the printers-and-screens subject; this subject owns the fulfilment statuses those surfaces display and advance.
- **notifications, emails, and reports** — their subjects own delivery and reporting; this subject only names the events.
- the **reservation** an instance may seat — the reservations subject owns it.

---

## 2. Domain model and vocabulary

### Entities

- **Order** — one **billable line**: a single **main good** plus its **add-ons**. It belongs to exactly one **Business**, exactly one **sales instance**, and — once sent — exactly one **batch**. It records who created it and in what capacity, the price and cost it was sold at, the promotion or manual discount it carries, an optional comment, and its **billing state**.
- **Batch** — a group of orders **sent to the kitchen/bar together**. It carries one **identification code** shared by all its orders, the attribution of the person who sent it, and one **fulfilment slice** per prep area that received lines. It is the unit that was sent together; preparation and delivery may complete **per slice** on independent timelines.

### Terms this subject introduces

- **Main good** — the single business good an order is built around. Its quantity is expressed as separate orders; there is exactly one main good per order.
- **Add-on** — a business good flagged as an add-on, as the business-goods subject defines, sold alongside a main good in the same order. An order may carry **several** add-ons and may repeat the **same** add-on ("a burger with two extra slices of cheese").
- **Draft order** — an order being built on a tab and **not yet sent**; freely editable, and not yet part of any batch.
- **Sent order** — an order committed in a batch; live to the kitchen and **immutable** except to a manager.
- **Identification code** — the code a **batch** carries, shared by its orders; Project Imperium issues it and no client chooses it.
- **Fulfilment slice** — the portion of a batch that one **prep area** (for example kitchen or bar) must prepare. Each slice carries its own **fulfilment status**. A batch with food and drinks has separate slices so drinks may be delivered before food is ready.
- **Fulfilment status** (also called **kitchen status** in service talk) — a slice's preparation state: **Sent**, **Preparing**, **Ready**, or **Delivered**.
- **Held batch** / **released** — a batch sent **held** waits at the end of each affected prep area's tickets until an employee on the tab **releases** it, when it joins the end of that area's ready-to-make queue.
- **Don't make** — a per-**order** instruction that the kitchen should **not** prepare it; the order is treated as done.
- **Order comment** — the optional free-text note an order carries for the kitchen: a preparation request, or an allergy a customer raised.
- **Billing state** — an order's billable standing: **Open**, **Paid**, **Void**, or **Invitation**.
- **Void** — an order kept on the bill but flagged, **not charged**, and retained in reporting.
- **Invitation** (complimentary) — an order kept on the bill but flagged, **not charged**, and retained in reporting.
- **Cancellation** — the removal of a sent order from the bill **and** from reporting.
- **Manual discount** — a manager-set discount on one order that **replaces** any promotion on it.
- **Deadline** — the kitchen's visual target time for a batch, drawn from its orders' preparation times; it is for display only.
- **Bill** — the aggregation of a sales instance's batches as presented for settlement. An order is a bill's building block.

Terms reused rather than redefined here: **Business**, **Sales instance**, **Sales point**, **Business good**, **Promotion**, **Employee**, **Customer**, **on duty**, **business currency**, and **soft delete**.

---

## 3. Capabilities

### 3.1 The order

- An order is one **main good** plus any number of **add-ons**. Quantity of the main good is expressed as **separate orders** — three cokes are three orders.
- An order belongs to exactly one business, exactly one sales instance, and, once sent, exactly one batch.
- An order records its **creator and the creator's capacity** — an employee working the tab, or the customer for self-ordering, kiosk, or delivery.
- An order may carry an **optional comment** for the kitchen. A customer's allergy concern travels as a comment, not as a recorded allergen list; what a dish contains is the menu's concern.
- An order carries a **billing state**: **Open** while it is live, then **Paid**, **Void**, or **Invitation** (§3.7).

### 3.2 Add-ons

- An order may carry **zero or more add-ons**, and may **repeat** the same add-on.
- Each add-on is priced at its own **selling price** and **summed** into the order.
- Add-ons contribute to the order's **cost**, exactly as the main good does.
- An add-on **never** takes a promotion (§3.6).

### 3.3 Batches and the identification code

- A **batch** is the group of orders sent to the kitchen/bar together. It is the unit the kitchen prepares and the venue collects or delivers, and the **bill aggregates the instance's batches**.
- A batch carries **one identification code**, shared by **all** its orders. Project Imperium issues the code; no client chooses it.
- A batch records **who sent it and in what capacity**; for self-ordering, kiosk, and delivery it is owned by the **ordering customer**.
- A batch is sent either **ready-to-make** or **held** — never a mix.

### 3.4 Drafting and sending

- Orders are built on the tab as **drafts** and are **freely editable** by the tab's staff: change the main good, add, remove, or repeat add-ons, and remove orders.
- Removing a draft leaves **nothing behind** — no stock has moved and no batch exists.
- **Sending** a batch commits it: stock leaves the venue, the kitchen starts, the identification code is issued, and its orders become **immutable** to everyone but a **manager** (§3.6–§3.8, §4).
- A tab may send **many batches** over a sitting; staff see what is already on the table when building the next one.

### 3.5 Pricing and cost

- Each order records the **price** of its main good and add-ons at the time it is added, in the **business currency**.
- Each order records its **cost** at the time of the sale — the main good and add-ons expanded through their recipes to supplier goods — so reporting computes cost of goods and profit from the sale itself rather than from later prices.
- The recorded base price and cost are the order's own; a later change to a good's price, a recipe, or a supplier good's price never alters an order already sold. A promotion's discount applied while the tab is open (§3.6) is the one value that may still change before the order settles.

### 3.6 Promotions and manual discounts

- A promotion may apply to an order's **main good only** — **never** to its add-ons.
- At most **one** promotion applies to an order: a good's subcategory is targeted by at most one enabled promotion whose active window is current at a time, so a single promotion covers the order. An order counts toward a promotion only when it is taken while the promotion is enabled and the moment falls inside its **active window**; a matching order taken outside the window does not complete the promotion.
- The good's **full price is recorded** when the order is added; the promotion's discount is applied while the staff tab is **open**, or while a self-service **pre-pay basket** is unpaid (promotions subject: basket is a sitting-equivalent; multi-buy groups there, then bind to the instance at pay). The discount may reprice an already-added line — three matching burgers on a tab or basket turn one of them free, for example. The amount is **final** once the order is **settled**.
- A **manual discount** is set on a **single order** by a **manager and above**, as a **percentage or a fixed amount**, and requires a **reason**.
- Applying a manual discount **replaces** any promotion on that order; an order carries a promotion **or** a manual discount, **never both**.

### 3.7 Void, invitation, and cancellation

- **Void** keeps the order **on the bill, flagged**, and **uncharged**; the order is **retained in reporting**. A reason is **required**, stored, and never shown to the customer. Stock is **not** restored.
- **Invitation** (complimentary) likewise keeps the order **on the bill, flagged**, and **uncharged**, and **retained in reporting**. It requires a reason, stored and never shown to the customer, and stock is **not** restored. Paying with a **gift card** is **not** an invitation: those orders stay **Paid** and gift card is only tender (gift-cards and payments-and-tax subjects; ADR-0004).
- **Cancellation** removes a **sent** order from the bill **and** from reporting, **restores** the stock it moved, and is a **manager and above** act. A cancelled order is **hard-deleted**: the platform's soft-delete rule retains domain records, and a cancelled line is a deliberate exception, because it leaves no billable record to keep.
- Removing a **draft** order is **not** a cancellation: nothing was committed, so nothing is restored and nothing is recorded.

### 3.8 Transfer

- Orders may be **transferred between employee-opened tabs**; only employee-opened tabs take part.
- The **receiving tab's responsible employee approves** the transfer, except when the person transferring is also responsible for the destination — moving orders to one's **own** tabs needs no approval.
- Draft orders are transferred by the tab's staff; a **sent** order is transferred by a **manager and above**, and only as **part of its batch**: the batch, its identification code, and its other orders move together, so a batch is **never split** across tabs and the destination bills that batch.

### 3.9 Fulfilment status

- On send, a batch produces one **fulfilment slice** per prep area that receives lines. Each slice carries the fulfilment status **Sent → Preparing → Ready → Delivered** on its **own timeline**. Food and drinks (and any other areas) do not wait on each other.
- The batch reaches stations by **ticket or screen** (the printers-and-screens subject owns routing, main and sub-screens, and the gestures). Its orders' preparation times draw a **deadline** each prep surface sees for its own control.
- The prep area's **main screen** (or the POS under the same entitlements) sets a slice **Preparing**, then **Ready**. Venue staff on the **delivery screen** (or the POS under the same entitlements) — typically a **runner** — set a **Ready** slice **Delivered** when the items are handed to the guest (dine-in / pickup) or to the **third-party courier** (delivery). **Delivered** for a delivery order means Imperium's job is done; last mile is the courier company's responsibility. A courier **never** signs into Project Imperium or marks Delivered. A slice may be Delivered while another slice of the same batch is still Preparing or Ready.
- A batch is **fully fulfilled** when every slice is **Delivered** (or the batch never created a slice).
- A **held** batch is sent on its own (never mixed with a ready-to-make batch), waits at the **end of each affected prep area's ticket queue**, and, when an **employee on the tab releases** it, joins the **end of that area's ready-to-make queue**.
- An **employee on the tab** may mark an order **don't make** while taking it. A don't-make order needs no reason and is treated as **done**: it is **charged normally** and its stock is **deducted** like any other.
- A batch whose orders are **all** don't-make is fully **Delivered** at once, skipping the kitchen and delivery surfaces.
- When the **daily sales report closes**, any slice still not Delivered for that business day is moved to Delivered (through Preparing and Ready as needed) so queues are clear — the printers-and-screens and sales-reports subjects state that sweep.

### 3.10 The bill

- The **bill** of a sales instance is the **aggregation of its batches**. Void and invitation orders **remain listed**, flagged and uncharged.
- A bill that changes after its work day's sales report has already been **closed** at least once carries an **edited** flag (alongside the matching flag on affected payments and on the daily sales report). Changing such a bill requires that day to be **reopened** first — the sales-reports subject owns reopen.
- **Tips** are optional and are taken at settlement on a payment; they are owned by the payments-and-tax subject. This subject records none.
- Settlement, splitting, and payment are the payments-and-tax subject's concern; this subject supplies the billable lines it settles.

### 3.11 Deletion

- A **void** or **invitation** order is **retained** — on the bill for the sitting, and in reporting.
- A **cancelled** order is **hard-deleted**, as above.
- A **batch** is retained as history and has no delete of its own: its remaining orders keep it live, and a batch with no live orders simply stops being worked by the kitchen.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Order powers |
| --- | --- |
| **Customer** | Self-orders through self-ordering, kiosk, or delivery; holds the identification code of their batch; never sees a void or invitation reason; never manages an order. |
| **Employee** | Builds and sends orders as drafts; marks don't-make; holds and releases batches; prep areas set slices preparing and ready and the delivery area delivers ready slices; reads sent orders but cannot change them. |
| **Manager** | Everything an employee can do, plus editing, transferring, cancelling, voiding, or inviting a **sent** order and applying a manual discount. |
| **Admin/owner** | Everything a manager can do, with full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| Build, edit, and remove draft orders; mark an order don't-make | The tab's staff |
| Send a batch; hold and release a batch | The tab's staff |
| Set a fulfilment slice preparing or ready | The prep area for that slice (main screen or POS) |
| Set a ready fulfilment slice delivered | The delivery area |
| Transfer draft orders between tabs | The tab's staff, with the receiving tab's approval unless moving to one's own tabs |
| Transfer a sent order (with its whole batch) | Managers and above, with the same approval rule |
| Edit, void, invite, or cancel a sent order; apply a manual discount | Managers and above |
| Read a sent order | Anyone on the tab; the staff who sent it cannot change it |
