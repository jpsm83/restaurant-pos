# Reservations

> **About this document.** This is the **target-state source of truth** for reservations in Project Imperium — the booking layer that takes a party from request through seating into live service. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes reservations as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **reservation**: a booking for a party at one Business, its status lifecycle, how customers and staff create and decide it, optional deposit handling on the booking, table assignment (including several points for one party), and the handoff into linked sales instances. It covers:

- the **reservation** itself — arrival time, internal end time, party size, guest contact, notes, status, optional linked user, assigned sales points, and deposit record;
- **business reservation configuration** — whether the venue accepts bookings, a temporary pause, default cover duration, customer-edit rules, and late-arrival grace;
- **customer-created and staff-created** requests and the **Accept / Request deposit** decision;
- the **status lifecycle**, including no-show and awaiting table;
- **multi-table assignment** with a hard no-overlap rule;
- the **seating handoff** when a waiter opens a reserved point as reservation guests or ordinary guests;
- the **shared deposit credit** across linked tabs at bill time; and
- which **notification and email** events the booking raises (delivery belongs to those subjects).

It deliberately does **not** cover:

- the **sales point**, **reserved hold** mechanic, **one-open rule**, and **tab move** rules — the sales-points-and-instances subject owns the anchor of service. This subject owns the booking, which points it claims, and when a hold overrun returns the booking to awaiting table.
- the **orders** and **bill lines** on each tab — the orders subject owns them. Each linked tab runs its own order and payment flow.
- **payment capture, change, and refunds** as platform payment mechanics — the payments-and-tax subject owns settlement. This subject owns that a deposit is recorded on the reservation and must appear as shared credit on linked tabs until applied at bill time.
- **gift cards** — a reservation deposit is not a gift card.
- **opening hours** as venue configuration — the business subject owns them. This subject requires the guest's arrival to fall inside those hours.
- **go-live and discovery** — the business and users subjects own when a venue may take public bookings. This subject respects that a venue that is not live cannot take customer requests.
- **KPI formulas** for no-show and cancellation rates — the business-metrics subject owns the catalogue. This subject defines the statuses those rates count.
- **email and notification delivery** — the emails and notifications subjects own templates, inbox, and channels. This subject names the events and what they must carry.

---

## 2. Domain model and vocabulary

### Entities

- **Reservation** — a booking for a party at exactly one **Business**. It carries the guest's **arrival time**, a staff-only **end time**, **party size**, **guest contact** (name and a way to reach them, including email), optional **notes**, a **status**, zero or more **assigned sales points**, an optional link to a **user** account, and an optional **deposit** with full payment details and remaining credit.

### Terms this subject introduces

- **Arrival time** — the date and time the guest sets for when the party will arrive. Shown to the guest.
- **End time** — the expected moment the assigned points become free again. Set by Host and above; **never shown to the guest**. Used only for floor planning and conflict checks.
- **Default cover duration** — a business-config span used to propose an end time from the arrival time; Host and above may override the end time per booking.
- **Party size** — how many guests the booking covers; required and at least one.
- **Guest contact** — the name and reachability (email, and phone when provided) for confirmation and deposit messages.
- **Accepts reservations** — the business-config switch that turns public and staff booking intake on or off for the venue.
- **Reservation pause** — a business-config temporary stop on new requests without flipping the permanent accepts switch.
- **Customer-edit window** — business config: either a number of hours before arrival during which the customer may edit (default **four hours**), or **customer edits disabled** entirely.
- **Grace period** — business-config minutes after arrival time after which the venue may treat the party as late; stated clearly in confirmation email. Project Imperium never auto-marks no-show.
- **Deposit** — an optional prepayment the venue may require before the booking becomes reserved. Recorded on the reservation with full payment details. Not a gift card.
- **Shared deposit credit** — the remaining deposit value shown on every sales instance linked to the reservation; reduced only when a tab applies some of it at bill time.
- **Awaiting deposit** — status after the venue has asked for a deposit and before it is paid.
- **Reserved** — status after the venue has accepted the booking (with no deposit, or after the deposit is paid).
- **Awaiting table** — status when the booking still needs a usable sales-point assignment after a hold was overrun by ordinary guests (or equivalent loss of assignment before seating).
- **Reservation guests** — the open-tab choice that links a new staff tab to this reservation.
- **Ordinary guests** — the open-tab choice that opens a walk-in tab on a point that was showing this booking's reserved label, without linking the tab.

Terms reused rather than redefined here: **Business**, **User**, **Customer**, **Employee**, **Host**, **Sales point**, **Served point**, **Sales instance**, **Staff tab**, **Reserved hold**, **Reservation link**, **Bill**, **Payment**, **soft delete**, **managers and above**, and **on duty**.

---

## 3. Capabilities

### 3.1 Business reservation configuration

- A business sets whether it **accepts reservations**, an optional **reservation pause**, a **default cover duration**, the **customer-edit window** (hours before arrival, default four, or customer edits off), and a late-arrival **grace period**.
- When accepts reservations is off, or a pause is on, **new customer requests are refused**. Staff tooling follows the same intake rules for new bookings unless Host and above are only managing existing ones.
- A venue that is **not live** (or otherwise not taking public bookings) cannot take **customer** requests; Host and above may still create and manage reservations internally for planning.
- The guest's **arrival time** must fall inside the venue's **opening hours** for that day.

### 3.2 Creating a reservation

- A **customer** requests a table from the Customer app while signed in. The booking starts as **Pending**. Party size, arrival time, contact, and optional notes are required as the product asks for them. **No sales point is assigned** at creation.
- **Host and above** may create a booking on the web (phone call, guest on premises, or planning). It starts as **Pending**, unless the creator **Accepts in the same step**, which moves it straight to **Reserved** with no deposit. Ordinary employees without Host cannot create bookings.
- Staff may attach an existing **user** or leave the guest as contact-only. Customer-app requests always attach the signed-in user.

### 3.3 Decision: accept or request a deposit

- **Host and above** decide a **Pending** booking: **Accept** (no deposit), **Request deposit** (amount chosen on that reply), or **Reject** (moves to **Cancelled** with a decision email).
- **Accept** moves the booking to **Reserved** and sends the **confirmation email**.
- **Request deposit** moves the booking to **Awaiting deposit** and sends the guest a **payment link**. Paying the deposit records full payment details on the reservation, moves it to **Reserved**, and sends the confirmation email. An unpaid awaiting-deposit booking **stays** until the guest pays or Host and above (or the customer) **cancel** it — there is no automatic expiry.
- A signed-in **customer** can **view and track** each of their bookings and its status in the Customer app.
- Paying a deposit requires the guest to **sign in or create an account** first; the booking then attaches to that account. When no deposit is required, account creation from the confirmation email is **optional**; the confirmation is still emailed.
- If the guest already has an account for that email, the booking is attached to it. A premises booking that names an email still receives confirmation by email and appears on the account when one exists or is created later via the invite link.

### 3.4 Status lifecycle

A reservation's status is one of:

| Status | Meaning |
| --- | --- |
| **Pending** | Requested; awaiting Host+ decision (including after a customer edit that re-pends). |
| **Awaiting deposit** | Deposit requested; unpaid. |
| **Reserved** | Accepted; deposit paid if one was required. |
| **Arrived** | Host+ marked the party checked in. |
| **Seated** | At least one linked staff tab was opened as reservation guests. |
| **Completed** | Every linked staff tab is closed. |
| **Cancelled** | Rejected or cancelled; terminal for the booking. |
| **No-show** | Party did not honour the booking; terminal. |
| **Awaiting table** | Needs a fresh sales-point assignment after assignment was lost (for example ordinary-guest overrun) before or without a usable linked tab. |

- **Host and above** may mark **Arrived** when the party checks in.
- **No-show** is set only by Host and above, on a reserved or arrived booking that was never seated as reservation guests. There is **no automatic no-show** timer; the grace period informs staff and the guest via email copy only.
- **Completed** is set when **every** sales instance linked to the reservation is closed.

### 3.5 Customer and staff edits

- **Host and above** may edit guest-visible fields and the internal end time at any pre-seated status without forcing Pending.
- When customer edits are enabled, the **customer** may edit guest-visible fields only until the **customer-edit window** before arrival. Every customer edit returns the booking to **Pending** and needs a new Accept or Request-deposit decision. A deposit already paid **stays on file** unless Host and above refund it, keep it, or request a different amount.
- Inside the cutoff — or when customer edits are disabled — the customer cannot edit; they contact the venue.
- Changing time or party size does not by itself clear a valid table assignment; Host and above must resolve any conflict the change creates under the no-overlap rule.

### 3.6 Cancel and deposit fate

- The **customer** may cancel while **Pending**, **Awaiting deposit**, or **Reserved** (before arrival / seating).
- **Host and above** may cancel at any pre-seated status.
- Once **Seated**, cancel is not used; the sitting ends through each linked tab, and the reservation becomes **Completed** when all linked tabs close.
- If a **deposit was paid** and the **venue** cancels, the deposit is **refunded**. If the **customer** cancels after **Reserved**, or the booking is marked **No-show**, the deposit is **forfeited to the business**, unless Host and above choose a manual refund.
- When the booking **Completes**, any **unused remaining deposit credit** is **refunded** to the guest (unless it was already forfeited under cancel or no-show rules).

### 3.7 Table assignment (one or many points)

- A reserved (or later pre-seated) booking may be assigned **one or more served sales points** by **Host and above**. Assignment is for business floor control; the guest is not shown which points were chosen.
- Every reservation has an **end time** set by Host and above (proposed from arrival + default cover duration, then adjustable). Conflict checks use the interval from **arrival time** through **end time** on each assigned point.
- **Overbooking a point is forbidden**: a point may be assigned only when no other reservation already claims it for an overlapping interval. Project Imperium **blocks** conflicting assignments.
- Each assigned point shows a **reserved** label that carries the booking's summary for the waiter (party size, name, arrival, notes, and related detail). The sales-points-and-instances subject owns how that label appears on the point; this subject owns which booking claims the point.
- Assignment before seating does **not** open a sales instance.
- Host and above may add or remove assigned points while pre-seated, still under the no-overlap rule. Clearing all points leaves the booking reserved or arrived but without a floor place until Host and above assign again — that is not by itself **Awaiting table**.

### 3.8 Seating handoff

- When a waiter (any on-duty employee opening the tab) opens a point that shows this booking's reserved label, Project Imperium asks **reservation guests** or **ordinary guests**.
- **Reservation guests** — opens a normal staff tab, sets the **reservation link**, copies useful guest details (name, party size as appropriate), and moves the booking to **Seated** on the first such open. Further assigned points may be opened the same way; each creates its **own** staff tab linked to the **same** reservation. Orders, billing, and payment on each tab run separately under the orders and payments-and-tax subjects.
- **Ordinary guests** — opens a walk-in tab with no reservation link. That point is **removed** from the reservation's assignment and its reserved label clears because the point is occupied. If the booking has **no** linked instance yet and no remaining usable assignment for the party, status becomes **Awaiting table** so Host and above can assign again. If other points remain assigned or tabs are already linked, only the overrun point is dropped and status stays as it was (reserved, arrived, or seated).
- Moving a linked tab to another served point follows the sales-points-and-instances move rules; the reservation's assigned set updates so the booking and its linked instances stay aligned.

### 3.9 Shared deposit on linked tabs

- A paid deposit is stored on the reservation with **full payment details** and a **remaining credit**.
- While any linked tab is open, **every** linked tab shows that **shared remaining credit**. Opening a tab or adding orders does **not** reduce it.
- At **bill / settlement** on a tab, staff may apply **some or all** of the remaining credit to that tab's payment. Each use reduces the shared remainder on every other linked tab for the same reservation.
- If the amount applied on a tab exceeds what that bill needs, change follows ordinary payment rules. If the bill is larger than the credit applied, the guest pays the remainder by other methods.
- The deposit is never a gift card and is never spent outside tabs linked to its reservation.

### 3.10 Notifications and emails this subject raises

| Event | Audience | Notes |
| --- | --- | --- |
| Reservation pending | Customer; the venue's Host and managers (in-app) | Includes a new request and a customer edit that re-pends |
| Deposit requested | Customer | Carries the payment link; account required before pay |
| Reservation decided (Reserved or Cancelled) | Customer | Confirmation or cancellation; confirmation states late-arrival / grace rules clearly; never shows internal end time |
| Awaiting table | Host and above | In-app only |

- Confirmation is always by **email** to the booking contact. Account invite links may accompany confirmation when the guest has no account; they are optional unless a deposit must be paid.
- Arrived, Seated, Completed, and No-show do not send customer emails from this catalogue.

### 3.11 Retention

- A reservation follows the platform **soft-delete** rule when removed from active use. History remains available for metrics such as no-show and cancellation rates.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Powers here |
| --- | --- |
| **Customer** | Requests a booking when the venue accepts reservations and is taking public bookings; tracks status; edits within the customer-edit window when enabled (re-pends); cancels per §3.6; pays a deposit when required (after sign-in or account creation). |
| **Employee** | Opens reserved points and chooses reservation guests or ordinary guests while on duty; works each linked tab's orders and bill. Cannot create or decide bookings unless they also hold Host (or higher) powers. |
| **Manager** | Everything an employee can do, plus every Host booking power, and setting reservation configuration. |
| **Admin/owner** | Everything a manager can do. |

### Who can do what

| Activity | Who |
| --- | --- |
| Set accepts reservations, pause, default cover duration, customer-edit window, grace period | Managers and above |
| Create a booking (Pending, or Accept in the same step) | Host and above |
| Accept, request a deposit, or reject a pending booking | Host and above |
| Assign or change sales points; set internal end time | Host and above |
| Mark arrived, no-show, or cancel (pre-seat) | Host and above |
| Edit a booking without forcing Pending | Host and above |
| View and track own bookings and status | The customer who owns or is linked to the booking |
| Customer-edit a booking (re-pends) | The customer, when edits are enabled and inside the window |
| Open a reserved point as reservation guests or ordinary guests | Any on-duty employee opening the staff tab |
| Apply shared deposit credit at bill time | Staff settling that tab |
| Refund or forfeit deposit outside the automatic rules | Host and above (manual override) |
