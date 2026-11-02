# Orders

> **About this document.** This is the **target-state source of truth** for orders in Project Imperium — the billable lines a venue sells, the batches they are sent in, and the path an order travels from the till through prep-area fulfilment to the bill. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes orders as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **order** — the billable line a venue sells — and the **batch** it is sent in. It covers:

- the **order** and its composition: one **main good** plus its **add-ons**, any **`No` removals**, and any **choice selections**;
- **add-ons** on an order — several, and repeats of the same one;
- **`No` removals** — structured removal of a modifiable ingredient, with its cost and inventory effect;
- **choice selections** — labels chosen from a good's choice groups, with no price, cost, inventory, allergen, or preparation-time effect;
- **guest allergen flags** on an order — the structured allergen set stamped when an allergen menu filter is active at add time;
- the **batch** — the group of orders sent to the kitchen/bar together — its **identification code**, and the **handover pass** a self-service batch carries;
- **drafting and sending** — the freely editable draft, the send that commits a batch, and the immutability that follows;
- **attribution** — who created an order and who sent a batch, and in what capacity;
- **pricing and cost** — the price and cost an order records;
- **promotions** applied to orders, and the **manual discount** a manager may apply instead (with a required operational reason);
- the **order lifecycle** — transfer, void, invitation, and cancellation (void and invitation each require an operational reason);
- the **fulfilment status** of a batch's **prep-area slices**, including **held** batches, **don't-make** orders, and the narrow **recall** exception; and
- the **bill** as the aggregation of a sales instance's batches.

It deliberately does **not** cover:

- the **sales point and sales instance** — where a guest sits, opening a tab, the one-open rule, self-service instances, and the handover verification of a self-service order belong to the sales-points-and-instances subject. This subject's orders attach to the instance that subject owns.
- the **end-to-end service journey** and the surface flows (dine-in, QR self-ordering, kiosk, delivery) and **to-go packaging** — the order-flow subject owns the journey; this subject owns the order and its batch as they travel through it.
- **billing and settlement** — splitting a bill, taking payments, the methods, tips, refunds, and tax belong to the payments-and-tax subject; the order-flow subject owns the journey that reaches settlement and the closing of the instance. This subject owns the order's billable state and the bill's composition; tips are noted here only for reference.
- **customer bill and receipt documents** — required content, bill and receipt numbers, reprint and replacement identity belong to the **receipts-and-bills** subject. This subject owns the bill as aggregation and the batch **identification codes** that may appear on those documents.
- **promotion rules** — the types, scoping, and availability of a promotion belong to the promotions subject. This subject owns how a promotion is applied to an order and the manual discount that may replace it.
- the **operational reason catalogues** for void, invitation, and manual discount — closed platform lists, Other-note rule, maintenance, visibility, and reporting-by-reason expectations belong to the **operational reasons** subject. This subject requires a code from those catalogues when the act happens.
- **business goods** — composition, selling price, derived cost, preparation time, categories, derived allergens, **modifiable ingredients**, **choice groups**, guest-facing allergen display, and the **allergen menu filter** behaviour belong to the business-goods subject. This subject reads goods when it prices and costs an order, records `No` removals and choice selections, and stamps **guest allergen flags** from the active filter at add time; order-flow places when the filter is used on each surface.
- **the inventory ledger** — the stock an order moves belongs to the inventories subject; this subject only states when an order moves it.
- **printing and screens** — printer routing and the kitchen, bar, delivery, and pickup surfaces belong to the printers-and-screens subject; this subject owns the fulfilment statuses those surfaces display and advance.
- **notifications, emails, and reports** — their subjects own delivery and reporting; this subject only names the events.
- the **reservation** an instance may seat — the reservations subject owns it.

---

## 2. Domain model and vocabulary

### Entities

- **Order** — one **billable line**: a single **main good** plus its **add-ons**, **`No` removals**, and **choice selections**. It belongs to exactly one **Business**, exactly one **sales instance**, and — once sent — exactly one **batch**. It records who created it and in what capacity, the price and cost it was sold at, the promotion or manual discount it carries, an optional comment, optional **guest allergen flags**, its **modified-line** state, and its **billing state**.
- **Batch** — a group of orders **sent to the kitchen/bar together**. It carries one **identification code** shared by all its orders, the attribution of the person who sent it, and one **fulfilment slice** per prep area that received lines. A **self-service batch** also carries one **handover pass** (owned by the sales-points-and-instances subject). It is the unit that was sent together; preparation and delivery may complete **per slice** on independent timelines. A batch may mix orders **with** and **without** guest allergen flags; the flag lives on the order, not on the batch.

### Terms this subject introduces

- **Main good** — the single business good an order is built around. Its quantity is expressed as separate orders; there is exactly one main good per order.
- **Add-on** — a business good flagged as an add-on, as the business-goods subject defines, sold alongside a main good in the same order. An order may carry **several** add-ons and may repeat the **same** add-on ("a burger with two extra slices of cheese").
- **`No` removal** — a structured selection of a **modifiable ingredient** on the order's main good (or on a combo member) that the kitchen must omit. It leaves the selling price unchanged, reduces the order's **recorded cost** by that ingredient's recipe cost, and reduces the inventory the order consumes. It never changes the good's allergens or preparation time (ADR-0014).
- **Choice selection** — a label chosen from one of the good's **choice groups** (for example `Doneness: medium rare`). It is a label only: no price, cost, inventory, allergen, or preparation-time effect.
- **Modified line** — an order line carrying at least one `No` removal or choice selection. It is marked as modified on prep surfaces and on the bill.
- **Draft order** — an order being built on a tab and **not yet sent**; freely editable, and not yet part of any batch.
- **Sent order** — an order committed in a batch; live to the kitchen and **immutable** except to a manager.
- **Identification code** — the code a **batch** carries, shared by its orders; Project Imperium issues it and no client chooses it.
- **Fulfilment slice** — the portion of a batch that one **prep area** (for example kitchen or bar) must prepare. Each slice carries its own **fulfilment status**. A batch with food and drinks has separate slices so drinks may be delivered before food is ready.
- **Fulfilment status** (also called **kitchen status** in service talk) — a slice's preparation state: **Sent**, **Preparing**, **Ready**, or **Delivered**.
- **Held batch** / **released** — a batch sent **held** waits at the end of each affected prep area's tickets until an employee on the tab **releases** it, when it joins the end of that area's ready-to-make queue.
- **Don't make** — a per-**order** instruction that the kitchen should **not** prepare it; the order is treated as done.
- **Order comment** — the optional free-text note an order carries for the kitchen (for example a preparation request). It is **not** the structured allergy path, **not** a `No` removal, and **not** a choice; it never affects inventory, cost, allergens, or preparation time. Declared guest allergens travel as **guest allergen flags**.
- **Guest allergen flags** — the optional set of allergens from the platform's **canonical allergen set** stored on an **order** when that order was added while an **allergen menu filter** was active. Empty means the order carries no allergen flag. Kitchen and bar surfaces read these flags (printers-and-screens).
- **Billing state** — an order's billable standing: **Open**, **Paid**, **Void**, or **Invitation**.
- **Void** — an order kept on the bill but flagged, **not charged**, and retained in reporting.
- **Invitation** (complimentary) — an order kept on the bill but flagged, **not charged**, and retained in reporting.
- **Cancellation** — the removal of a sent order from the bill **and** from reporting.
- **Manual discount** — a manager-set discount on one order that **replaces** any promotion on it.
- **Deadline** — the kitchen's visual target time for a **slice**, equal to the **longest preparation time** among its lines (main goods plus add-ons). It starts at `Sent`, or at release for a held batch, and is for display only; `No` removals and choices do not change it.
- **Recall** — a narrow, audited fulfilment gesture that moves a slice from **Ready** back to **Preparing** within a fixed window, without reversing `Delivered` (ADR-0015).
- **Bill** — the aggregation of a sales instance's batches as presented for settlement. An order is a bill's building block.

Terms reused rather than redefined here: **Business**, **Sales instance**, **Sales point**, **Business good**, **modifiable ingredient**, **choice group**, **choice**, **Promotion**, **Employee**, **Customer**, **on duty**, **business currency**, **handover pass**, **handover QR**, **courier request**, **courier handover**, **soft delete**, **allergen menu filter**, **canonical allergen set** (business-goods), and **operational reason** (reason code and optional Other note from the operational reasons subject).

---

## 3. Capabilities

### 3.1 The order

- An order is one **main good** plus any number of **add-ons**, zero or more **`No` removals**, and zero or more **choice selections**. Quantity of the main good is expressed as **separate orders** — three cokes are three orders.
- An order belongs to exactly one business, exactly one sales instance, and, once sent, exactly one batch.
- An order records its **creator and the creator's capacity** — an employee working the tab, or the customer for self-ordering, kiosk, or delivery.
- An order may carry an **optional comment** for the kitchen. Structured guest allergen concern travels as **guest allergen flags**, not as the comment. What a dish contains remains the business-goods subject's concern.
- A **`No` removal** is allowed only for an ingredient the business-goods subject marks **modifiable** on that good (or on a combo member). Several removals may sit on one line, one per ingredient, with no duplicates.
- A **choice selection** is allowed only from a **choice group** the good offers. A required group must be chosen before the line can be added; an optional group may be left empty.
- **Modified lines never change the good's allergens.** A line that removes cheese still displays Milk. `No` also does not change the good's preparation time or deadline.
- **Modified lines never change availability.** A Sold out good does not become orderable because the guest removes the short ingredient; availability follows the full recipe.
- An order carries a **billing state**: **Open** while it is live, then **Paid**, **Void**, or **Invitation** (§3.7).
- When an order is **added** while an **allergen menu filter** is active (staff POS or self-channel — order-flow), Project Imperium **automatically** stamps that order with **guest allergen flags** equal to the filter's current selection.
- When **no** filter allergens are selected, new orders carry **no** guest allergen flags and the sitting flows normally.
- Flags attach to the **order**, not the batch or the whole sales instance. A mixed table may send one batch with, for example, two unflagged burgers and one burger flagged for Milk — kitchen and bar see the flag only on the flagged line.
- Guest allergen flags are set **only at add time** from the active filter. There is **no** way to add, change, or clear flags on an order after it is already on the tab or in the basket. To redo, staff or the guest **remove** the draft or basket line and add it again under the correct filter state.
- Changing or clearing the filter does **not** rewrite flags on orders already added; it only affects orders added afterward.
- Because the filter hides goods (and add-ons) that contain the selected allergens, a newly added flagged order's main good and add-ons do not declare those allergens at add time. The optional comment remains available for free-text prep notes.

### 3.2 Add-ons

- An order may carry **zero or more add-ons**, and may **repeat** the same add-on.
- Each add-on is priced at its own **selling price** and **summed** into the order.
- Add-ons contribute to the order's **cost**, exactly as the main good does.
- An add-on **never** takes a promotion (§3.6).

### 3.2.1 Removals and choices

- **`No` removals and choices are not add-ons.** An add-on is a priced good that adds cost and stock; a removal reduces stock and cost; a choice is a label with no economic effect.
- A `No` removal may target only a **modifiable ingredient** on the main good or, for a combo, on a member; for a combo the removal records the member good and the ingredient line it targets. A line may carry several removals, one per ingredient, with no duplicates. The same ingredient may not be removed and added on the same line: `No cheese` plus an `Extra cheese` add-on is blocked.
- A choice must come from a **choice group** the good offers. A required group blocks adding the line until a choice is selected; an optional group may be empty. One choice per group.
- A **comment** is free text and is the correct path for anything not modelled, including “less salt” or “less pickles”. A comment never changes cost, inventory, allergens, or preparation time.
- Removals and choices are recorded on the **order line** as structured data, so prep surfaces can print them, reports can count them, and the kitchen sees them as part of the line rather than as loose text.
- After a batch is sent, a removal or choice changes only through a **manager correction**. That correction updates the recorded cost and inventory effect with the line and is subject to the existing sent-order audit path.

### 3.3 Batches and the identification code

- A **batch** is the group of orders sent to the kitchen/bar together. It is the unit the kitchen prepares and the venue collects or delivers, and the **bill aggregates the instance's batches**.
- A batch carries **one identification code**, shared by **all** its orders. Project Imperium issues the code; no client chooses it.
- A **self-service batch** also carries the **handover pass** the sales-points-and-instances subject defines: an opaque token and, for QR self-ordering and kiosk, a handover QR. The pass is not a second identification code and never replaces the batch code on the bill or receipt.
- A self-service order that is paid once and sent once creates **one batch**. A later self-service order is a **new** sales instance, batch, receipt, and handover pass; it never joins the earlier batch.
- A batch records **who sent it and in what capacity**; for self-ordering, kiosk, and delivery it is owned by the **ordering customer**.
- A batch is sent either **ready-to-make** or **held** — never a mix. Self-service batches are always ready-to-make and exist only after full payment is accepted.

### 3.4 Drafting and sending

- Orders are built on the tab as **drafts** and are **freely editable** by the tab's staff: change the main good, add, remove, or repeat add-ons, change **`No` removals** and **choice selections**, edit the comment, and remove orders. **Guest allergen flags** are not edited on the draft; they follow the add-time rules in §3.1.
- Removing a draft leaves **nothing behind** — no stock has moved and no batch exists.
- **Sending** a batch commits it: stock leaves the venue, the kitchen starts, the identification code is issued, and its orders become **immutable** to everyone but a **manager** (§3.6–§3.8, §4). Guest allergen flags, removals, choices, and comments travel with each sent order for prep tickets and screens.
- A tab may send **many batches** over a sitting; staff see what is already on the table when building the next one.
- Send (and self-channel pay-to-commit) is **blocked** when any line's business good is no longer orderable under business-goods availability — order-flow places that check in the journey.

### 3.5 Pricing and cost

- Each order records the **price** of its main good and add-ons at the time it is added, in the **business currency**. A **`No` removal** and a **choice** never change that price; the guest pays the full configured price.
- Each order records its **cost** at the time of the sale — the main good and add-ons expanded through their recipes to supplier goods — so reporting computes cost of goods and profit from the sale itself rather than from later prices. A **`No` removal** reduces that recorded cost by the removed ingredient's recipe cost; a **choice** does not change cost.
- The recorded base price and cost are the order's own; a later change to a good's price, a recipe, or a supplier good's price never alters an order already sold. A promotion's discount applied while the tab is open (§3.6) is the one value that may still change before the order settles.

### 3.6 Promotions and manual discounts

- A promotion may apply to an order's **main good only** — **never** to its add-ons.
- At most **one** promotion applies to an order: a good's subcategory is targeted by at most one enabled promotion whose active window is current at a time, so a single promotion covers the order. An order counts toward a promotion only when it is taken while the promotion is enabled and the moment falls inside its **active window**; a matching order taken outside the window does not complete the promotion.
- The good's **full price is recorded** when the order is added; the promotion's discount is applied while the staff tab is **open**, or while a self-service **pre-pay basket** is unpaid (promotions subject: basket is a sitting-equivalent; multi-buy groups there, then bind to the instance at pay). On **draft** matching lines and unpaid basket lines, the discount may reprice as further matching lines complete a multi-buy group, or when the promotion is **disabled** mid-sitting (promotions subject: those lines return to full price). **Sent** lines keep the discount they already evaluated when a promotion is disabled; changing them afterward is a manager correction this subject allows. The amount is **final** once the order is **settled**.
- A **manual discount** is set on a **single order** by a **manager and above**, as a **percentage or a fixed amount**, and requires an **operational reason** from the closed **manual discount** catalogue (operational reasons subject).
- Applying a manual discount **replaces** any promotion on that order; an order carries a promotion **or** a manual discount, **never both**.

### 3.7 Void, invitation, and cancellation

- **Void** keeps the order **on the bill, flagged**, and **uncharged**; the order is **retained in reporting**. An **operational reason** from the closed **void** catalogue is **required**, stored, and never shown to the customer (operational reasons subject). Stock is **not** restored.
- **Invitation** (complimentary) likewise keeps the order **on the bill, flagged**, and **uncharged**, and **retained in reporting**. It requires an **operational reason** from the closed **invitation** catalogue, stored and never shown to the customer (operational reasons subject), and stock is **not** restored. Paying with a **gift card** is **not** an invitation: those orders stay **Paid** and gift card is only tender (gift-cards and payments-and-tax subjects; ADR-0004).
- **Cancellation** removes a **sent** order from the bill **and** from reporting, **restores** the stock it moved, and is a **manager and above** act. A cancelled order is **hard-deleted**: the platform's soft-delete rule retains domain records, and a cancelled line is a deliberate exception, because it leaves no billable record to keep.
- Removing a **draft** order is **not** a cancellation: nothing was committed, so nothing is restored and nothing is recorded.

### 3.8 Transfer

- Orders may be **transferred between employee-opened tabs**; only employee-opened tabs take part.
- The **receiving tab's responsible employee approves** the transfer, except when the person transferring is also responsible for the destination — moving orders to one's **own** tabs needs no approval.
- Draft orders are transferred by the tab's staff; a **sent** order is transferred by a **manager and above**, and only as **part of its batch**: the batch, its identification code, and its other orders move together, so a batch is **never split** across tabs and the destination bills that batch.

### 3.9 Fulfilment status

- On send, a batch produces one **fulfilment slice** per prep area that receives lines. Each slice carries the fulfilment status **Sent → Preparing → Ready → Delivered** on its **own timeline**. Food and drinks (and any other areas) do not wait on each other.
- The batch reaches stations by **ticket or screen** (the printers-and-screens subject owns routing, main, sub, expo, and handoff screens, and the gestures). Its **deadline** is the longest preparation time among the slice's lines and is displayed on every prep surface; `No` removals and choices do not change it.
- Every prep ticket and screen shows each order's **`No` removals**, **choice selections**, **comment**, and **guest allergen flags**, with modified lines marked as modified.
- The prep area's **main screen**, the **expo screen**, or the POS under the same entitlements sets a slice **Preparing**, then **Ready**. Venue staff on the **handoff screen** (or the POS under the same entitlements) — typically expo staff, not runners — set a **Ready** slice **Delivered** when the items are handed to the guest (dine-in / pickup) or to the courier (delivery, whether the venue's own courier or a connected third-party provider). **Delivered** for a delivery order means the venue handed the batch to the courier; last mile is the courier company's responsibility. A courier **never** signs into Project Imperium or marks Delivered. For dine-in and to-go work, a slice may be Delivered while another slice of the same batch is still Preparing or Ready; delivery handover is whole-batch.
- **Recall** is the one narrow exception to forward-only fulfilment. Within **5 minutes**, the station that fulfilled an item or ticket may move a **Ready** slice back to **Preparing**. After 5 minutes, a supervisor and above may recall before `Delivered`; managers and above may recall before `Delivered`. The original sent time is kept, so the ticket shows late. `Delivered` never moves backward. Every recall is audited and attributed to the actor or display-lease opener (ADR-0015).
- On **QR self-ordering**, the customer's **handover pass** scan sets only the selected **Ready** slices Delivered; the batch may be handed over in parts. On **kiosk** and **delivery**, the handover is **all-or-nothing**: the scan or Delivered action is blocked until every slice is Ready and then marks the whole batch Delivered. The sales-points-and-instances subject owns the pass and verification rules.
- On **delivery**, a connected courier provider may receive a **courier request** at batch send and a **courier handover** call when staff mark Delivered; those calls belong to the delivery-integrations subject. A venue that records no staff handover raises no handover call, and the daily close completes any undelivered slice.
- A batch is **fully fulfilled** when every slice is **Delivered** (or the batch never created a slice).
- A **held** batch is sent on its own (never mixed with a ready-to-make batch), waits at the **end of each affected prep area's ticket queue**, and, when an **employee on the tab releases** it, joins the **end of that area's ready-to-make queue**.
- An **employee on the tab** may mark an order **don't make** while taking it. A don't-make order needs no reason and is treated as **done**: it is **charged normally** and its stock is **deducted** like any other.
- A batch whose orders are **all** don't-make is fully **Delivered** at once, skipping the prep, expo, and handoff surfaces.
- When the **daily sales report closes**, any slice still not Delivered for that business day is moved to Delivered (through Preparing and Ready as needed) so queues are clear — the printers-and-screens and sales-reports subjects state that sweep.

### 3.10 The bill

- The **bill** of a sales instance is the **aggregation of its batches**. Void and invitation orders **remain listed**, flagged and uncharged. A **modified line** keeps its `No` removals and choices listed with the line; the price remains the full configured price.
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
| **Customer** | Self-orders through self-ordering, kiosk, or delivery; selects **`No` removals** and **choices** where the good offers them; holds the identification code and, where the receipt carries one, the handover pass of their batch; never sees a void or invitation reason; never manages an order. |
| **Employee** | Builds and sends orders as drafts; selects **`No` removals**, **choices**, and comments; marks don't-make; holds and releases batches; prep areas set slices preparing and ready, the expo coordinates them, and the handoff area delivers ready slices; recalls within the allowed window; reads sent orders but cannot change them. |
| **Supervisor** | Same floor order powers as employee, plus recall after the station's 5-minute window and before `Delivered`. Does not edit, transfer, void, invite, cancel, or manually discount a **sent** order. |
| **Manager** | Everything an employee can do, plus recall before `Delivered` and editing, transferring, cancelling, voiding, or inviting a **sent** order and applying a manual discount. |
| **Admin/owner** | Everything a manager can do, with full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| Build, edit, and remove draft orders; select `No` removals, choices, and comments; mark an order don't-make | The tab's staff |
| Send a batch; hold and release a batch | The tab's staff |
| Set a fulfilment slice preparing or ready | The prep area for that slice (main/sub screen), the expo screen, or the POS under the same entitlements |
| Recall a ready slice to preparing | The fulfilling station within 5 minutes; supervisor and above after that and before `Delivered`; managers and above before `Delivered` |
| Set a ready fulfilment slice delivered | The handoff area (handoff screen or POS) |
| Verify a self-service handover pass and set the selected Ready slices (QR) or the whole batch (kiosk / delivery) Delivered | Staff fulfilling the batch on an entitled handover surface |
| Override a missing handover pass and mark Delivered | Managers and above (recorded) |
| Transfer draft orders between tabs | The tab's staff, with the receiving tab's approval unless moving to one's own tabs |
| Transfer a sent order (with its whole batch) | Managers and above, with the same approval rule |
| Edit, void, invite, or cancel a sent order; apply a manual discount | Managers and above |
| Read a sent order | Anyone on the tab; the staff who sent it cannot change it |
