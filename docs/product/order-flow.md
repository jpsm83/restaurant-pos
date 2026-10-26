# Order flow

> **About this document.** This is the **target-state source of truth** for order flow in Project Imperium — the end-to-end service journey from opening a sitting through ordering, fulfilment, billing, payment, and close, and how each service surface walks that journey. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes order flow as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **service journey**: the sequencing of a sitting from open to close, and how each **surface** walks the same lifecycle. It covers:

- the **shared lifecycle stages** every surface uses;
- the **surface flows** — **dine-in** (staff POS), **QR self-ordering**, **kiosk**, and **delivery**;
- **to-go packaging** (stay vs packed to go) as a choice on orders, not as a channel or sales point;
- when a sitting may **bill**, **settle**, and **close** relative to fulfilment; and
- how **self-service** commits (pay first) versus how a **staff tab** runs open service; and
- that each self-service **ordering session** owns its own basket so concurrent customers never mix orders; and
- **clear basket** and **idle expiry** (including the **still-there** prompt) for unpaid self-service baskets; and
- the **handover pass** and **handover QR** journey at collection, including partial QR-ordering handover and whole-batch kiosk and delivery handover; and
- the delivery **courier request** at batch send and the optional **courier handover** call when staff record Delivered, for venues using a connected third-party provider; and
- **journey failure paths** at pay, print, prep print, and post-pay corrections (composing payments, printers, orders, and realtime rules); and
- enforcing the **self-channel alcohol age gate** at basket and pay (rule owned by the privacy, consent, and DSAR subject); and
- the **allergen filter journey** on staff tabs and self-channels (when the filter is used, when orders are auto-flagged, and the self-channel pre-pay confirmation); and
- blocking **send** or **pay** when a line's good is no longer orderable under day-of availability.

It deliberately does **not** cover:

- the **sales point and sales instance** model — types, channels a point accepts, the one-open rule, instance statuses, responsible employee, reserved hold, and handover verification of an identification code belong to the sales-points-and-instances subject. This subject sequences the journey those anchors support.
- the **order and batch** model — composition, drafting and sending, **guest allergen flags** on an order, pricing, promotions, void, invitation, cancellation, transfer, held batches, don't-make, and fulfilment statuses belong to the orders subject. This subject places those acts in the journey.
- **derived allergens, guest-facing allergen display, and allergen menu filter behaviour** — the business-goods subject. This subject places when staff and guests use the filter and when the pre-pay confirmation runs.
- **settlement mechanics** — payment methods, providers, splits, partial payments, tips, over-tender, refunds, and tax belong to the payments-and-tax subject. This subject owns when the journey reaches settlement and that the instance closes only when the outstanding balance is covered or surpassed.
- **customer bill and receipt documents** — content, numbering, and reprint/replacement identity belong to the **receipts-and-bills** subject. This subject places first Bill request and settlement close in the journey those documents attach to.
- **printers and screens** — routing, prep screens, the delivery screen, and the customer pickup board belong to the printers-and-screens subject. This subject names when fulfilment and handoff happen in the journey.
- **reservations** — booking, deposit, and seating choice (reservation guests vs ordinary guests) belong to the reservations subject. This subject continues from the staff tab that seating opens.
- **delivery and self-ordering configuration** — enabling delivery, radius, minimum order, and windows, and enabling self-ordering for the venue, belong to the business subject; which points accept which channels belong to the sales-points-and-instances subject.
- **inventory, notifications, emails, and reports** — their subjects own those effects; this subject only places the moments that trigger them.
- **live push, reconnect, and conflict outcomes** (stale actions, double-send, double-pay) and **ordering-session isolation** — the realtime-and-concurrency subject. This subject owns **Clear basket** and **basket idle expiry** on the journey.
- **open staff-tab ageing alerts or auto-close** — there are none; the sales-points-and-instances subject states that Occupied/Bill tabs are never auto-closed or auto-aged.
- **marketing consent, customer data export, privacy notice, and age-floor policy** — the privacy, consent, and DSAR subject. This subject only enforces the self-channel alcohol checkout block those rules require.
- **delivery provider catalogue, per-business connection, courier request/handover/cancellation calls, external delivery references, retries, and no-handover reconciliation** — the **delivery-integrations** subject. This subject owns when those moments occur in the journey.
- **handover pass token and verification rules** — the **sales-points-and-instances** subject. This subject sequences the handover moment and the surface behaviour.
- **full country alcohol / ID-at-table / ID-at-delivery / age-assurance packs** — deferred to a future **alcohol and age-assurance service compliance** subject; not invented here. Stage 1 keeps only the privacy age floors and the self-channel gate this subject enforces.

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
- **Pay-to-commit** — the self-service rule that a basket creates no sales instance, batch, or kitchen work until the customer pays in full by card (QR self-ordering, kiosk, and delivery). There is no pay-on-premises kiosk path and no cash on self-service.
- **Guest basket** — a customer ordering basket built **without** a signed-in User. Discovery and basket assembly are allowed unsigned; **sign-in or sign-up is required when payment is requested**, and the basket is preserved across that step.
- **Venue handoff (delivery)** — the moment venue staff mark a delivery order **Delivered** when it is handed to the courier; that completes Project Imperium's delivery journey. The courier may track last-mile in their own tools. A venue that records no staff handover has no handover action; the daily close reconciles the batch.
- **Handover pass** — the self-service batch's handover identity: an opaque token, the batch **identification code**, and — for QR self-ordering and kiosk — a **handover QR** on the customer receipt. Staff scan it, or enter the code as a fallback, before releasing the batch.
- **Courier request** — the delivery-integrations action that asks a connected provider to dispatch a courier when a paid delivery batch is sent to prep.
- **Courier handover** — the delivery-integrations action that tells a connected provider the batch was handed to its courier. It is raised only when a staff screen records Delivered.
- **Allergen pre-pay confirmation** — the required self-channel step immediately before payment in which the guest affirms they have reviewed allergen information for the basket and choose to proceed. It is a **double-check**, not a second allergen declaration and not a restamp of basket lines.
- **Clear basket** — the guest action that removes every line from the current self-service basket and leaves the **ordering session** open so they can start a fresh order without waiting for idle expiry.
- **Still-there prompt** — the confirmation shown after the basket idle window when Project Imperium asks whether the guest is still ordering before discarding the session.
- **Basket idle expiry** — ending an unpaid ordering session after idle time and an unanswered still-there prompt; no sales instance, stock move, or payment is created.

Terms reused rather than redefined here: **Business**, **Sales point**, **Sales instance**, **Staff tab**, **Channel**, **Order**, **Batch**, **Identification code**, **Fulfilment slice**, **Fulfilment status**, **Held batch**, **Bill**, **Payment**, **Outstanding balance**, **Reservation**, **on duty**, **ordering session**, **stale action**, **delivery method**, **Own delivery**, **courier provider**, **courier cancellation**, **Alcoholic drinks** tax category, **alcohol purchase age**, **allergen menu filter**, **guest allergen flags**, **availability state**, and **soft delete**.

---

## 3. Capabilities

### 3.1 Shared lifecycle

- Every sitting uses the same **lifecycle stages**: **Open**, **Build & send**, **Fulfil**, **Bill**, **Settle**, and **Close**. Surfaces differ in **who acts** and in **stage order**, not in a separate stage catalogue.
- A **staff tab** opens first, may loop **Build & send** and **Fulfil** many times, then **Bill**, **Settle**, and **Close**.
- A **self-service** sitting has no staff **Bill** status: the customer **builds** a basket, **Settles** (pay-to-commit) which **Opens** the instance and **Closes** it for billing in the same step, then **Fulfil** runs until handover. Payment is complete before the kitchen starts; venue work after pay is fulfilment only.
- The first **order send** or self-service **pay-to-commit** of a work day opens that day's daily sales report; the sales-reports subject owns the report.

### 3.2 To-go packaging

- **Takeaway is packaging, not a channel.** There is no takeaway sales point and no takeaway channel. A guest who wants food to go walks a normal dine-in or self-service journey; fulfilment packs **bags and cups** instead of **plates and glasses**.
- Packaging is marked **per order**. A sitting may mix stay and to-go lines.
- A sitting may carry a **packaging default** that new orders inherit; staff or the customer may override per order.
- On a **staff tab**, the employee sets the sitting default and per-order overrides.
- On **Self-ordering**, the customer sets packaging; the default at a table QR is **stay**.
- On **Kiosk**, the customer sets packaging; the default is **to-go**.
- On **Delivery**, every order is **to-go** — there is no stay choice.
- Prep tickets and screens show stay vs to-go so stations **pack accordingly**.

### 3.3 Allergen filter journey

Guest allergen handling starts with the **allergen menu filter** (business-goods). Structured flags on orders follow the orders subject.

- If the guest reports **no** allergen concern, staff or the guest leave the filter empty and ordering proceeds normally — no guest allergen flags on new lines.
- If the guest reports allergens, the filter is set **first** (staff via the POS **Allergen** control; guests via the self-channel filter). Matching goods and add-ons are hidden; every **new** order added while the filter is active is **auto-flagged** with that selection (orders subject). There is no separate “flag after the order is placed” step.
- Staff clear or change the filter between guests at a mixed table so later lines follow the new state. One batch may carry flagged and unflagged orders together.
- On **self-channels**, immediately before payment, the guest must complete the **allergen pre-pay confirmation** — a double-check that they have reviewed allergen information for the basket and choose to proceed. That step does **not** declare a new allergen set, does **not** restamp basket lines, and does **not** hard-block pay when the guest ordered something unsafe without using the filter; proceeding after confirmation is the guest's responsibility.
- Distance-selling (self-channels) keeps derived allergens visible on catalogue and basket lines **before purchase**; allergen information for sold goods is available again at **handover / delivery** on the customer documents the receipts-and-bills subject requires.

### 3.4 Day-of availability in the journey

- Catalogue surfaces show **Sold out** and **Manually unavailable** on-menu goods labelled and not orderable (business-goods).
- **Sending** a staff batch, or **paying** a self-service basket, is **blocked** for any line whose good is no longer orderable. The surface must refresh to current availability (realtime-and-concurrency) before the act can succeed.

### 3.5 Dine-in — staff POS

- An **on-duty employee** opens a **staff tab** on a served point from the POS (floor map on a wide viewport, or list/grid when narrow — the floor-plans subject) or by scanning the point's QR, as the sales-points-and-instances subject defines (including reservation guests vs ordinary guests when a reserved hold is present).
- Staff **build drafts**, **send batches** (ready-to-make or held), and may send **many batches** over the sitting. Multi-course timing uses **held / release** and further sends alone.
- Staff use the **Allergen** control when a guest reports allergens (§3.3) before adding that guest's lines; with nothing selected, the tab flows normally.
- Prep areas advance fulfilment; runners deliver stay items to the point and pack to-go items for handover at the table or counter as the sitting requires. Flagged order lines show clearly on prep tickets and screens (printers-and-screens).
- Staff may move the tab to **Bill** and **settle** even while some fulfilment slices are still in progress. Closing does not require every slice to be Delivered.
- While the tab is in **Bill**, staff may still **add and send** further orders; the bill updates.
- The tab **closes only when the outstanding balance is covered or surpassed** (payments-and-tax). Unpaid open orders are not walked out; voids, invitations, and cancellations (orders subject) are how lines leave the charge. An instance opened and closed with **no orders** is discarded. First Bill request and the closing receipt are issued per the receipts-and-bills subject.
- Tips, splits, and payment methods are taken at settlement as the payments-and-tax subject defines.
- While the staff tab is open, **Self-ordering cannot open** on that point. When the tab **closes** (or an empty tab is discarded), self-ordering may open again if the business and point allow it and no **reserved hold** remains (§3.6).
- Staff may record **Alcoholic drinks** tax-category lines on a staff tab without Project Imperium applying the self-channel alcohol age gate; venue responsibility at the table remains. The privacy, consent, and DSAR subject owns that distinction.

### 3.6 QR self-ordering

- Table self-ordering opens only when **all** of these hold: the **business** has self-ordering enabled, the **sales point** accepts the **Self-ordering** channel, **no staff tab** is open on that point, and the point has **no reserved hold** (manual or reservation-assigned).
- The customer scans the point's QR and starts an **ordering session** with its own **basket** (no sales instance yet). Many customers may scan the same point QR at once; each session’s basket is **isolated** — baskets never merge because they share a table. The guest may **Clear basket**, and unpaid sessions follow **still-there** and **basket idle expiry** (§3.12). The guest may use the **allergen menu filter** while browsing (§3.3). When they proceed to **pay**, Project Imperium requires **sign-in or sign-up** if they are not already signed in, **preserves that session’s basket**, runs the **allergen pre-pay confirmation**, then takes payment in full. Only after successful payment does Project Imperium create **that session’s** instance and batch and release work to the kitchen (**pay-to-commit**), with its own **identification code** and **handover pass**.
- If a **staff tab opens** or a **reserved hold** is placed on the point **while** an unpaid ordering session already has a basket, Project Imperium **keeps the basket** and **blocks pay-to-commit** (and blocks **new** self-ordering opens on that point) until the block clears. The guest may **Clear basket** or wait; the session is not force-discarded solely because the floor block appeared.
- A self-ordering basket or pay-to-commit that includes any **Alcoholic drinks** tax-category line is **blocked** unless the payer User's birth date shows age at least the **alcohol purchase age** (eighteen) — privacy, consent, and DSAR subject. Birth date must be present for that check.
- Fulfilment **delivers stay items to that QR point**. To-go lines on the same sitting are packed to go.
- The customer receives the **handover pass** on the receipt — in-app and by email — with the identification code and a **handover QR**. Staff scan the QR, or enter the code as a fallback, and select only the items whose slices are **Ready**; the batch may be handed over in parts. The pass stays valid until every non-void, non-invitation, non-cancelled line is Delivered. A manager and above may override a missing pass with a recorded override. The sales-points-and-instances subject owns the pass and verification rules.
- Billing **closes on full settlement** at pay-to-commit; fulfilment continues until handover. After that close, another order at the same point is a **new** ordering session, basket, and instance — a closed self-service sitting is never reopened to add lines.
- **Managers and above** may void, invite, or cancel lines on a paid self-service sitting; refunds follow the payments-and-tax subject. Ordinary employees fulfil and verify handover; they do not rewrite a paid self-service ticket.

### 3.7 Kiosk

- A **Kiosk** point is a self-service terminal on the same customer app. Each terminal use is one **ordering session** with its own basket, including **guest basket until identity at payment**, **Clear basket** and **basket idle expiry** (§3.12), the **allergen menu filter**, and the **allergen pre-pay confirmation**.
- Kiosk settlement is **always full digital**: identity at payment, then **pay-to-commit** via Stripe Connect; the instance, batch, identification code, and kitchen work exist only after successful capture. There is **no pay-on-premises kiosk mode**, no cash, and no counter payment.
- The same **self-channel alcohol age gate** as QR self-ordering applies at basket and pay/commit (§3.6).
- Fulfilment is **counter pickup**, not delivery to a table. Packaging defaults to **to-go**; the customer may override per order.
- The kiosk **prints a handover ticket** with the **handover pass** and identification code. The customer also receives the pass on the receipt in-app and by email. Staff scan the QR at the counter, or enter the code as a fallback. Kiosk handover is **whole-batch**: it is blocked until every slice is Ready, then one scan marks the whole batch Delivered.
- Billing closes on full settlement; fulfilment continues until counter handover. A later order is a new instance, batch, receipt, and pass.

### 3.8 Delivery

- When delivery is enabled, orders attach to the venue's **virtual Delivery point**. Many customers order at once; each starts an **ordering session** with its own basket. The customer may build a basket without signing in (with the **allergen menu filter** available), may **Clear basket**, and follows the same **still-there** / **basket idle expiry** rules (§3.12). They must meet the venue's delivery rules (radius, minimum, windows), and at **payment** must **sign in or sign up** if needed (basket preserved), complete the **allergen pre-pay confirmation**, then **pays in full**; only then does that session’s instance, batch, and kitchen work exist. Baskets never merge across sessions on the Delivery point.
- The same **self-channel alcohol age gate** as QR self-ordering applies at basket and pay (§3.6).
- Every delivery order is **to-go**. The venue's **delivery method** is **Own delivery** or one connected **third-party courier provider**. Prep runs as usual.
- When the paid batch is **sent to prep**, Project Imperium raises a **courier request** for a connected provider, carrying the batch's **ready time**. The request does not depend on a screen. With **Own delivery**, no provider is called. A failed request is retried and alerts managers; it never blocks preparation.
- When slices are **Ready**, venue staff may use the **delivery screen** or the **POS** to hand the whole batch to the courier and mark it **Delivered**. On a connected provider, that action also raises a **courier handover** call. Handover is **whole-batch**: it is blocked until every slice is Ready, then one action marks the whole batch Delivered.
- A venue that records **no staff handover** — no delivery screen and no POS action — cannot mark Delivered; no courier handover call is raised, the courier provider's own app records the pickup, and the daily close completes the batch. The courier **never** signs into Project Imperium or operates the delivery screen.
- The customer receives an **order reference** on the receipt — the identification code — with **no handover QR**. The delivery QR would have nothing to scan in the customer's hands, so it is hidden while the pass still exists for internal consistency.
- Billing closes on full settlement at pay-to-commit; fulfilment continues after payment until venue handoff. Allergen information for sold goods is available again on the customer receipt at that handover (receipts-and-bills).

### 3.9 Handover pass and QR

- The **handover pass** belongs to one self-service **batch**. It carries an opaque token, the batch **identification code**, and — for **QR self-ordering** and **kiosk** — a **handover QR**. The **delivery** receipt carries the identification code only, labelled **order reference**, and hides the QR.
- For **QR self-ordering** and **kiosk**, the customer receives the pass on the **receipt** at pay-to-commit, in-app and by email; a kiosk also prints it on the handover ticket. For **delivery**, the receipt and order history show the **order reference** only. A lost email does not require a reissue because the receipt is available in order history.
- A pass is valid until the batch is fully delivered or cancelled before handover. A refund alone does not invalidate it; the refund returns money without cancelling the order. It has no separate time expiry while the batch is open. Reprinting or replacing the receipt keeps the same pass and never issues a new QR.
- **QR self-ordering** is partial: staff scan the pass and select only the items whose slices are Ready; the pass remains valid for later scans until every non-void, non-invitation, non-cancelled line is Delivered.
- **Kiosk** and **delivery** are whole-batch: the scan or Delivered action is blocked until every slice is Ready, and one action marks the whole batch Delivered.
- Staff scan the QR in their **own signed-in Business session**, or enter the identification code as a fallback. A **manager and above** may override a missing pass and mark Delivered; the override is recorded. A duplicate scan is idempotent and never delivers twice.
- Void, invitation, and cancelled lines are excluded from handover; if every line leaves the charge, the pass is invalidated. The handover pass is **not** a fiscal identity and is never the bill or receipt number.

### 3.10 Billing, settlement, and close

- **Staff tabs** enter **Bill** when an employee on the tab requests the check; self-service sittings never use that status because they pay to commit.
- Settlement — whole or in parts, with optional tips and over-tender — belongs to the payments-and-tax subject. This subject requires that **every surface closes only when the outstanding balance is covered or surpassed**.
- A **self-service** instance is created only at successful pay-to-commit, so it never carries a partial balance.
- When a reservation left a **shared deposit credit**, it is applied at bill time as the reservations subject defines; order-flow only places that moment in the staff-tab journey.

### 3.11 Reservation seating into the journey

- Seating a reservation opens one or more **staff tabs** linked to the booking. From that open onward, each tab walks the dine-in journey in this subject. Completing the reservation when every linked tab closes belongs to the reservations subject.

### 3.12 Self-service basket: clear and idle expiry

These rules apply to every unpaid **ordering session** on **Self-ordering**, **Kiosk**, and **Delivery** — including a session whose basket is still empty after the guest started ordering.

- The guest may **Clear basket** at any time. That removes every line and keeps the same ordering session open so they can build a fresh order without paying or creating an instance.
- After **five minutes** with no basket activity, Project Imperium shows the **still-there prompt** (“Still there?”). Any confirmation or further basket activity **resets** the idle clock.
- If the guest does not respond for a further **two minutes**, **basket idle expiry** ends the ordering session and discards the unpaid basket. No sales instance, stock movement, or payment is created. The guest must start again (rescan the QR, begin a new kiosk use, or open delivery ordering again). Concurrent sessions on the same point stay isolated (realtime-and-concurrency).
- If the guest **leaves without paying** (closes the surface or otherwise ends the client session before pay-to-commit), the unpaid basket is discarded with that session the same way — no instance, stock, or payment.
- Clear basket and idle expiry never affect a sitting that has already **paid to commit**.

### 3.13 Journey failure paths

This subject composes failure outcomes already owned elsewhere so the journey has a defined fate. It invents no new money or print rules.

- **Payment decline or fail at settle / pay-to-commit.** The payment reads **failed**; no charge sticks for that attempt. On a **staff tab**, the instance stays open with the **outstanding balance** still owed; staff retry or use another method (payments-and-tax; a same-attempt retry does not double-charge — realtime-and-concurrency). On **self-service**, the basket and ordering session remain; the guest may retry pay or clear/leave; **no** sales instance is created until a successful pay-to-commit. The same fate applies when **gift-card** tender cannot cover the attempt (insufficient remaining balance, expired/voided/refunded card, or wrong issuing venue): no apply succeeds, outstanding stays owed or the self-service basket stays unpaid (gift-cards; payments-and-tax).
- **Receipt or bill print failure at close or Bill.** Settlement and close follow payments-and-tax once outstanding is covered; paper is not a precondition for the money outcome. Print follows backup then block with manager notify (printers-and-screens). Required content remains available on screen and by email (receipts-and-bills).
- **Prep printer failure after send.** The batch and identification code already exist; prep **screens** continue; staff retry print or a manager rebinds (printers-and-screens). The sitting does not auto-void.
- **Courier request, handover, or cancellation call failure.** The local delivery journey continues: the batch is still sent, prepared, and handed over. The provider call retries, the delivery screen shows the failure, and managers on duty are notified when retries give up. The daily close does not block and records the exception; a venue with no recorded handover finishes by the close sweep (delivery-integrations; sales-reports).
- **Good becomes unorderable after pay-to-commit or after send.** Catalogue blocks apply at **send** and **pay** (§3.4). After a successful pay or send, correcting an unmakeable line is a **manager** void, cancel, or refund path (orders; payments-and-tax) — there is **no** automatic refund or auto-cancel from this subject.
- **Disconnect or stale action mid-journey.** Writes are blocked or rejected as the realtime-and-concurrency subject defines; the client refreshes to server truth and the guest or staff retry the act.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Powers here |
| --- | --- |
| **Customer** | Walks self-ordering, kiosk, and delivery journeys; holds the handover pass where the receipt carries one; uses the allergen menu filter; clears the basket or answers the still-there prompt; completes allergen pre-pay confirmation; sets packaging on self-service orders; pays to commit; never opens or manages a staff tab. |
| **Employee** | Runs dine-in journeys while on duty: open, build and send, request bill, settle and close; uses the POS **Allergen** control; sets packaging on staff tabs; runs fulfilment and venue handoff under the job roles below; scans the handover pass or enters its code at handover; may retry a failed courier request or handover on the delivery screen. |
| **Supervisor** | Same floor journeys as employee, plus Host seating when using Host; may operate Service control screens by layer default. Does not void/invite/cancel sent or paid lines. |
| **Manager** | Everything an employee can do, plus correcting paid self-service lines (void, invite, cancel), the sent-order powers the orders subject grants, and overriding a missing handover pass with a recorded override. |
| **Admin/owner** | Full venue control over the journeys, including configuration owned by the business and sales-points subjects that gate the surfaces. |

### Job roles in this journey

| Job role | Role in the journey |
| --- | --- |
| **Waiter**, **Floor Staff**, **Bartender**, **Barista**, **Cashier** | Open and run staff tabs, take and send orders, request the bill, settle, set packaging, scan the handover pass or enter its code at the table or counter. |
| **Runner** | Run stay items to the point, pack and hand to-go items, operate the delivery screen, retry a failed courier request or handover, and mark delivery **Delivered** when handed to the courier. |
| **Host** | Seat reservation guests into staff tabs (reserved hold / open choice); does not move tabs once service is underway. |
| **Supervisor** (job role → supervisor layer) | Floor lead: Host seating and full Service screens by layer default; not manager corrections. |
| **Head Chef**, **Sous Chef**, **Line Cooks**, and other prep roles | Advance prep-area fulfilment slices; they do not own billing. |
| **Manager**, **Assistant Manager**, **MoD**, **General Manager**, **Owner**, **Admin** | Manager-and-above corrections and configuration gates as in the tables below. |

### Who can do what

| Activity | Who |
| --- | --- |
| Open and run a staff tab through bill, settle, and close | On-duty floor service roles on the tab (Waiter, Floor Staff, Bartender, Barista, Cashier, and managers and above) |
| Use the POS Allergen control (allergen menu filter) on a staff tab | Staff on the tab |
| Set sitting packaging default and per-order stay/to-go on a staff tab | Staff on the tab |
| Build a self-service basket, clear the basket, answer the still-there prompt, use the allergen filter, complete allergen pre-pay confirmation, set packaging, and pay to commit | The ordering customer |
| Enable self-ordering for the business | Managers and above (business subject) |
| Accept Self-ordering on a sales point | Managers and above (sales-points-and-instances subject) |
| Scan the handover QR or enter the identification code at handover | Staff fulfilling the order on an entitled handover surface |
| Override a missing handover pass and mark Delivered | Managers and above (recorded) |
| Mark delivery Ready → Delivered (handed to courier) | Runner and other staff allowed on the delivery screen |
| Retry a failed courier request or courier handover | Staff allowed on the delivery screen; managers and above |
| Void, invite, or cancel lines on a paid self-service sitting | Managers and above |
| Walk a courier through Project Imperium screens | Nobody — couriers stay on their own tools |
