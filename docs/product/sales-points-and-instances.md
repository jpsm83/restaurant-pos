# Sales points and instances

> **About this document.** This is the **target-state source of truth** for sales points and sales instances in Project Imperium — the places a venue serves from and the sessions it opens there. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes sales points and instances as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **anchor of service**: where a guest sits or is served, and the open session that groups their orders. It covers:

- the **sales point** — the place, its **type**, the set of **channels** it accepts, its **QR identity**, its **reserved hold**, its derived **availability**, and its **deletion**;
- the **virtual delivery point** and the venue's **kiosk points**;
- the **sales instance** — opening, attribution, guest count, client name, status, the **one-open rule**, moving a tab, moving orders between tabs, the **reservation link**, the work-day anchor, and the discarding of an **empty instance**; and
- the **handover verification** rule for self-service orders.

It deliberately does **not** cover:

- the **end-to-end service journey** or the surface-specific flows (dine-in, QR self-ordering, kiosk, takeaway, and delivery dispatch) — the order-flow subject owns the journey; this subject owns the anchor those flows open and close.
- the **orders** themselves — the billable lines, add-ons, pricing, promotions, and the **identification code** an order carries belong to the orders subject. This subject groups orders into a session and owns the handover rule.
- **billing and payment** — splitting a tab, partial and multi-method payments, tips, and settlement belong to the payments-and-tax subject, while the order lifecycle — voids, invitations, and cancellations — belongs to the orders subject. This subject owns the instance's **Bill** status and its close once settled.
- the **reservation flow** — the booking, its lifecycle, and no-show handling belong to the reservations subject. This subject owns the **reservation link** a seated instance carries and the **reserved hold** a point may show.
- **delivery configuration** — enabling delivery, the radius, the minimum order, and the windows belong to the business subject; this subject owns the virtual delivery point those settings produce.
- **printer routing** — the printers-and-screens subject owns how a point routes tickets; this subject only names the point as a routing target.
- the **daily sales report** — the business-reports subject owns it; this subject owns the work-day anchor it opens on.
- **notification, email, and ticket delivery** — their own subjects own delivery; this subject names the triggers.
- **inventory effects** — the inventories subject owns what a sold order consumes.

---

## 2. Domain model and vocabulary

### Entities

- **Sales point** — a place a guest sits or is served: a table, a room, a bar seat, a seat, a counter, a standing spot, a kiosk, or the virtual delivery point. It belongs to exactly one **Business**, carries a **type** and the set of **channels** it accepts, holds its **QR identity**, and may show a **reserved hold**.
- **Sales instance** — an open session at a sales point that groups the orders of one sitting. It records who opened it and in what role, its guest count, its optional client name, the responsible employee for a staff tab, its status, and — when it seats one — the reservation it belongs to.

### Terms this subject introduces

- **Sales-point type** — what the place *is*: **Table**, **Room**, **Bar**, **Seat**, **Counter**, **Spot**, **Kiosk**, **Delivery**, or **Other**. A **Spot** is a standing point used for customer self-ordering; **Delivery** is the one virtual type.
- **Served point** — a sales point of a physical serving type (Table, Room, Bar, Seat, Counter, Spot, or Other), as opposed to a **Kiosk** or the virtual **Delivery** point.
- **Channel** — how orders reach the venue: **Dine-in** (staff service), **Self-ordering**, **Kiosk**, **Takeaway**, or **Delivery**. A point declares the set it accepts, so a table can serve staff (dine-in) and also allow self-ordering. **Takeaway** is a customer-initiated channel with no sales point of its own; the order-flow subject owns it.
- **Staff tab** — a sales instance opened by an employee under the **Dine-in** channel; it runs open until settled.
- **One-open rule** — a served point accepts **at most one open staff tab at a time**.
- **Guest count** — the number of guests a sitting covers; set when the instance opens and editable while it is open.
- **Client name** — the optional name a sitting is held under.
- **QR identity** — the point's QR code, issued by Project Imperium with the point and never chosen by a client. It is the point's identity, and it is offered to customers only where the point accepts **Self-ordering**.
- **Reserved hold** — a label on an **available** served point that a sitting is expected. It may be placed manually by a Host or managers and above, or produced when a **reservation** assigns that point; when tied to a reservation it carries that booking's summary for the waiter.
- **Available** and **occupied** — the derived point states: a point is **available** when it has no open instance and **occupied** while it has one. Project Imperium stores neither.
- **Responsible employee** — the on-duty employee answerable for a staff tab; responsibility moves with the tab and can be passed between on-duty staff.
- **Reservation link** — the instance's reference to the booking it seats, set when a tab is opened as **reservation guests**. Several instances may link to the same reservation when that booking spans multiple points.
- **Work-day anchor** — the business-local day an instance belongs to; the first instance of the day opens that day's daily sales report.
- **Empty instance** — a sales instance that recorded no orders.

Terms reused rather than redefined here: **Business**, **Order**, **Business good**, **Reservation**, **Daily sales report**, **managers on duty**, and **soft delete**.

---

## 3. Capabilities

### 3.1 Sales points

- A venue defines the sales points it serves from. Each has a **name** unique among the business's active points, a **type**, and the set of **channels** it accepts.
- A point may accept **Dine-in** and, independently, **Self-ordering**; a **Spot** is defined for self-ordering; a **Kiosk** point accepts the kiosk channel; the **Delivery** point accepts delivery.
- Every point holds a **QR identity**. Only points that accept self-ordering **offer** it to customers; staff may scan any point's QR to open its tab. A lost QR is reissued and the old one retired.
- Availability is **derived**: a point is available when no instance is open on it and occupied while one is. Project Imperium keeps no separate occupied marker to read.

### 3.2 The reserved hold

- A **Host or manager and above** may place a **reserved hold** on an **available** served point and clear it at any time.
- A hold placed by hand is a reminder only. It is **not a reservation** and does not by itself count as one.
- When a **reservation** assigns one or more points, each assigned point shows a reserved hold that **carries the booking's summary** (party, name, arrival, notes, and related detail). The reservations subject owns which booking claims the point and the no-overlap rule; this subject owns how the label appears on the point.
- A hold is cleared when an instance opens on the point (reservation guests or ordinary guests), or when the reservation releases that point. A manual hold with no booking is also cleared as soon as an instance on the point takes its **first order**.

### 3.3 The virtual delivery point and kiosk points

- Enabling delivery produces **exactly one** virtual **Delivery** point for the venue, and delivery orders attach to it. It holds a QR identity but never offers self-ordering.
- A venue may hold **many** **Kiosk** points, one per terminal. Each is a self-service point whose orders are collected at the counter.

### 3.4 Opening a sales instance

- An **on-duty employee** opens a staff tab from the POS or by scanning the point's QR; opening is gated by the employee's schedule, as everywhere in the business app.
- A point accepts **at most one open staff tab at a time** (the one-open rule), whoever opened it. The point frees when that tab closes.
- When a tab is opened on a point showing a **reserved hold** tied to a reservation, Project Imperium asks **reservation guests** or **ordinary guests**. **Reservation guests** opens a normal staff tab, sets the **reservation link**, and leaves other assigned points of the same booking available to open the same way (each tab its own instance, same reservation). **Ordinary guests** opens a walk-in with no link; that point is released from the booking and the reservations subject may move the booking to **awaiting table** when no usable assignment remains. A manual hold with no booking is simply cleared by the open.
- Opening records who opened the instance and in what role, the guest count, and an optional client name.
- An instance opened and closed with **no orders** is **discarded**, as if it had never opened (see §3.8).

### 3.5 Self-service instances

- **Self-ordering**, **Kiosk**, and **Delivery** open a customer's own instance at a point: the customer adds as many items as they wish, sees a **pre-payment confirmation** of the bill, pays, and the instance closes on settlement.
- These channels are **not** subject to the one-open rule: several may run at once, one per customer.
- A **Self-ordering** instance cannot open while a **staff tab** is open on the same point; the customer is told that service is underway.
- A self-service instance is created **only when the customer commits to pay**, so an abandoned basket leaves nothing behind.
- Every order carries an **identification code**. For **Self-ordering**, **Kiosk**, and **Delivery**, Project Imperium **notifies and emails** the customer the code, and a **kiosk also prints a ticket**. Staff **verify the code at handover**, before releasing the items, so the person who collects is the person who ordered.

### 3.6 Statuses and the tab lifecycle

- An instance's status is **Occupied** (open service), **Bill** (the check has been requested), or **Closed** (settled).
- **Bill** belongs to a **staff tab**; the self-service channels never hold it, because they pay to close.
- A staff tab moves from **Occupied** to **Bill** when the check is requested, and to **Closed** when its last order is settled.
- Project Imperium owns the instance status; a client never sets one directly.

### 3.7 Attribution and moving a tab

- Every instance records its opener and role, its optional client name, and its guest count, which may be edited while the instance is open.
- A staff tab has a **responsible employee**. Responsibility moves with the tab. The responsible employee may **hand the tab over** to another on-duty employee, who must **approve** the handover before it takes effect; after that the tab belongs to the receiver.
- The **opening employee or admin and above** may move a tab that has **no orders**. Once a tab has orders, only its **responsible employee or admin and above** may move it, together with its orders. Moving a tab to an **empty served point** needs no approval and does not change responsibility — the tab is simply relocated.
- Orders may be moved between staff tabs; only employee-opened tabs take part. The receiving tab's responsible employee approves, unless the mover is responsible for the destination; the orders subject owns the transfer and its approval rule.
- A **Host cannot move** a tab; the Host's tool is the reserved hold.

### 3.8 Empty instances

- An instance that recorded **no orders** and is closed is **discarded outright** rather than soft-deleted: it captured nothing, and keeping it would leave phantom sittings in availability, reports, and audits.
- This is a deliberate exception to the platform's soft-delete rule, which otherwise retains every domain document.

### 3.9 Deletion of a point

- A sales point is **soft-deleted**: it leaves service and its name is freed among active points, while its historical instances still belong to it and it can be reactivated.
- A point with an **open instance cannot be deleted** until that instance closes.
- Deleting a point retires its QR identity.

### 3.10 The work day

- Every instance belongs to the **work day** it opened in — the business-local calendar day — even if it stays open past midnight.
- The **first instance of a work day** opens that day's daily sales report; the business-reports subject owns the report itself.
- A work day's report closes only once no instance on that day has open orders.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Powers here |
| --- | --- |
| **Customer** | Self-orders by QR, at a kiosk, or for delivery where the point and business allow it; never opens a staff tab. |
| **Employee** | Opens and works staff tabs while on duty; takes orders, requests the bill, and settles and closes a tab. |
| **Manager** | Everything an employee can do, plus creating, editing, deactivating, and reactivating points, choosing their channels, enabling self-ordering, and placing or clearing a reserved hold. |
| **Admin/owner** | Full venue control, including every manager power and moving any tab. |

### Who can do what

| Activity | Who |
| --- | --- |
| Create, edit, deactivate, or reactivate a sales point; choose its channels | Managers and above |
| Enable self-ordering on a point | Managers and above |
| Place or clear a reserved hold | Host, managers, and above |
| Open a staff tab | Any **on-duty employee** |
| Self-ordering by QR, at a kiosk, or for delivery | Any customer |
| Request the bill | An employee on the tab |
| Move an empty tab | The **opening employee** or admin and above |
| Move a tab with orders, together with its orders | The **responsible employee** or admin and above |
| Hand a tab's responsibility to another on-duty employee | The responsible employee, with the receiving employee's approval |
| Move orders between staff tabs | The tab's staff for draft orders, managers and above for sent orders (which move with their whole batch); the receiving tab approves unless moving to their own tabs |
| Settle and close a tab | An employee on the tab |
| Discard an empty instance | An employee on the tab |
