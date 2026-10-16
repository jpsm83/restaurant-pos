# Order flow

> **About this document.** This is the **target-state source of truth** for order flow in Project Imperium — the end-to-end service journey from opening a sitting through ordering, fulfilment, billing, payment, and close, and how each service surface walks that journey. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes order flow as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **service journey**: the sequencing of a sitting from open to close, and how each **surface** walks the same lifecycle. It covers:

- the **shared lifecycle stages** every surface uses;
- the **surface flows** — **dine-in** (staff POS), **QR self-ordering**, **kiosk**, and **delivery**;
- **to-go packaging** (stay vs packed to go) as a choice on orders, not as a channel or sales point;
- when a sitting may **bill**, **settle**, and **close** relative to fulfilment; and
- how **self-service** commits (pay first) versus how a **staff tab** runs open service.

It deliberately does **not** cover:

- the **sales point and sales instance** model — types, channels a point accepts, the one-open rule, instance statuses, responsible employee, reserved hold, and handover verification of an identification code belong to the sales-points-and-instances subject. This subject sequences the journey those anchors support.
- the **order and batch** model — composition, drafting and sending, pricing, promotions, void, invitation, cancellation, transfer, held batches, don't-make, and fulfilment statuses belong to the orders subject. This subject places those acts in the journey.
- **settlement mechanics** — payment methods, providers, splits, partial payments, tips, refunds, and tax belong to the payments-and-tax subject. This subject owns when the journey reaches settlement and that the instance closes only when the bill is fully paid.
- **printers and screens** — routing, prep screens, the delivery screen, and the customer pickup board belong to the printers-and-screens subject. This subject names when fulfilment and handoff happen in the journey.
- **reservations** — booking, deposit, and seating choice (reservation guests vs ordinary guests) belong to the reservations subject. This subject continues from the staff tab that seating opens.
- **delivery and self-ordering configuration** — enabling delivery, radius, minimum order, and windows, and enabling self-ordering for the venue, belong to the business subject; which points accept which channels belong to the sales-points-and-instances subject.
- **inventory, notifications, emails, and reports** — their subjects own those effects; this subject only places the moments that trigger them.

---

## 2. Domain model and vocabulary

### Entities

This subject introduces **no new persistent entity**. It sequences existing ones: **sales point**, **sales instance**, **order**, **batch**, **bill**, and **payment**.

### Terms this subject introduces

- **Service journey** — the end-to-end path of one sitting from open through close.
- **Lifecycle stage** — one step of the shared journey: **Open**, **Build & send**, **Fulfil**, **Bill**, **Settle**, **Close**. Surfaces differ in who acts and in the order of stages, not in a separate stage catalogue.
- **Surface** — one of the four ways a venue serves through a **channel**: **Dine-in**, **Self-ordering**, **Kiosk**, or **Delivery**.
- **To-go packaging** (also **stay** vs **to-go**) — whether an order is fulfilled for consumption on plates and glasses (**stay**) or packed in takeaway bags and cups (**to-go**). Packaging is **not** a channel and **not** a sales point.
- **Sitting default (packaging)** — the stay/to-go preference a sitting carries; new orders inherit it until overridden.
- **Pay-to-commit** — the self-service rule that a basket creates no sales instance and reaches the kitchen only after the customer pays in full.
- **Venue handoff (delivery)** — the moment venue staff mark a delivery order **Delivered** when it is handed to the courier; that completes Project Imperium's delivery journey. The courier may track last-mile in their own tools.

Terms reused rather than redefined here: **Business**, **Sales point**, **Sales instance**, **Staff tab**, **Channel**, **Order**, **Batch**, **Identification code**, **Fulfilment slice**, **Fulfilment status**, **Held batch**, **Bill**, **Payment**, **Outstanding balance**, **Reservation**, **on duty**, and **soft delete**.

---

## 3. Capabilities

### 3.1 Shared lifecycle

- Every sitting walks the same **lifecycle stages**: **Open** → **Build & send** → **Fulfil** → **Bill** → **Settle** → **Close**.
- A **staff tab** may loop **Build & send** and **Fulfil** many times before **Bill**. A **self-service** sitting typically **builds**, then **Settles** (pay-to-commit), then **Fulfils**, then **Closes** — it never holds a staff **Bill** status.
- The first sales instance of a work day opens that day's daily sales report; the business-reports subject owns the report.

### 3.2 To-go packaging

- **Takeaway is packaging, not a channel.** There is no takeaway sales point and no takeaway channel. A guest who wants food to go walks a normal dine-in or self-service journey; fulfilment packs **bags and cups** instead of **plates and glasses**.
- Packaging is marked **per order**. A sitting may mix stay and to-go lines.
- A sitting may carry a **packaging default** that new orders inherit; staff or the customer may override per order.
- On a **staff tab**, the employee sets the sitting default and per-order overrides.
- On **Self-ordering**, the customer sets packaging; the default at a table QR is **stay**.
- On **Kiosk**, the customer sets packaging; the default is **to-go**.
- On **Delivery**, every order is **to-go** — there is no stay choice.
- Prep tickets and screens show stay vs to-go so stations **pack accordingly**.

### 3.3 Dine-in — staff POS

- An **on-duty employee** opens a **staff tab** on a served point from the POS or by scanning the point's QR, as the sales-points-and-instances subject defines (including reservation guests vs ordinary guests when a reserved hold is present).
- Staff **build drafts**, **send batches** (ready-to-make or held), and may send **many batches** over the sitting. Multi-course timing uses **held / release** and further sends — there is no separate course-number model.
- Prep areas advance fulfilment; runners deliver stay items to the point and pack to-go items for handover at the table or counter as the sitting requires.
- Staff may move the tab to **Bill** and **settle** even while some fulfilment slices are still in progress. Closing does not require every slice to be Delivered.
- While the tab is in **Bill**, staff may still **add and send** further orders; the bill updates.
- The tab **closes only when the outstanding balance is zero**. Unpaid open orders are not walked out; voids, invitations, and cancellations (orders subject) are how lines leave the charge. An instance opened and closed with **no orders** is discarded.
- Tips, splits, and payment methods are taken at settlement as the payments-and-tax subject defines.
- While the staff tab is open, **Self-ordering cannot open** on that point. When the tab **closes** (or an empty tab is discarded), self-ordering may open again if the business and point allow it (§3.4).

### 3.4 QR self-ordering

- Table self-ordering opens only when **all** of these hold: the **business** has self-ordering enabled, the **sales point** accepts the **Self-ordering** channel, and **no staff tab** is open on that point.
- The customer scans the point's QR, builds a **basket** (no sales instance yet), confirms the bill, and **pays in full**. Only then does Project Imperium create the instance and batches and release work to the kitchen (**pay-to-commit**).
- Fulfilment **delivers stay items to that QR point**. To-go lines on the same sitting are packed to go.
- The customer receives the **identification code** (notification and email); staff **verify the code at handover** before releasing items, as the sales-points-and-instances subject defines.
- The instance **closes on full settlement**. After close, another order at the same point is a **new** basket and instance — a closed self-service sitting is never reopened to add lines.
- **Managers and above** may void, invite, or cancel lines on a paid self-service sitting; refunds follow the payments-and-tax subject. Ordinary employees fulfil and verify handover; they do not rewrite a paid self-service ticket.

### 3.5 Kiosk

- A **Kiosk** point is a self-service terminal on the same customer app. The journey is pay-to-commit, like QR self-ordering.
- Fulfilment is **counter pickup**, not delivery to a table. Packaging defaults to **to-go**; the customer may still choose stay where the venue offers it for on-site consumption after pickup.
- The kiosk **prints a handover ticket** with the identification code; staff verify the code at the counter. The customer pickup board shows progress as the printers-and-screens subject defines.
- The instance closes on full settlement; a later order is a new instance.

### 3.6 Delivery

- When delivery is enabled, orders attach to the venue's **virtual Delivery point**. The customer builds a basket, meets the venue's delivery rules (radius, minimum, windows), **pays in full**, then the kitchen receives the work.
- Every delivery order is **to-go**. Prep runs as usual; when slices are **Ready**, venue staff use the **delivery screen** to run the handoff.
- A **runner** (or any staff allowed on the delivery screen) hands the order to the **third-party courier** and marks it **Delivered**. That completes Project Imperium's delivery journey. The courier may manage last-mile in their own app; a courier **never** signs into Project Imperium or operates the delivery screen.
- The instance closes on full settlement at pay-to-commit; fulfilment continues after payment until venue handoff.

### 3.7 Billing, settlement, and close

- **Staff tabs** enter **Bill** when an employee on the tab requests the check; self-service sittings never use that status because they pay to commit.
- Settlement — whole or in parts, with optional tips — belongs to the payments-and-tax subject. This subject requires that **every surface closes only when the outstanding balance is zero**.
- A **self-service** instance is created only at successful pay-to-commit, so it never carries a partial balance.
- When a reservation left a **shared deposit credit**, it is applied at bill time as the reservations subject defines; order-flow only places that moment in the staff-tab journey.

### 3.8 Reservation seating into the journey

- Seating a reservation opens one or more **staff tabs** linked to the booking. From that open onward, each tab walks the dine-in journey in this subject. Completing the reservation when every linked tab closes belongs to the reservations subject.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Powers here |
| --- | --- |
| **Customer** | Walks self-ordering, kiosk, and delivery journeys; sets packaging on self-service orders; pays to commit; never opens or manages a staff tab. |
| **Employee** | Runs dine-in journeys while on duty: open, build and send, request bill, settle and close; sets packaging on staff tabs; runs fulfilment and venue handoff (including delivery screen) under job-role screen access; verifies identification codes at handover. |
| **Manager** | Everything an employee can do, plus correcting paid self-service lines (void, invite, cancel) and the sent-order powers the orders subject grants. |
| **Admin/owner** | Full venue control over the journeys, including configuration owned by the business and sales-points subjects that gate the surfaces. |

### Who can do what

| Activity | Who |
| --- | --- |
| Open and run a staff tab through bill, settle, and close | On-duty employees on the tab |
| Set sitting packaging default and per-order stay/to-go on a staff tab | Staff on the tab |
| Build a self-service basket, set packaging, and pay to commit | The ordering customer |
| Enable self-ordering for the business | Managers and above (business subject) |
| Accept Self-ordering on a sales point | Managers and above (sales-points-and-instances subject) |
| Verify identification code at handover | Staff fulfilling the order |
| Mark delivery Ready → Delivered (handed to courier) | Staff allowed on the delivery screen (typically runner) |
| Void, invite, or cancel lines on a paid self-service sitting | Managers and above |
| Walk a courier through Project Imperium screens | Nobody — couriers stay on their own tools |
