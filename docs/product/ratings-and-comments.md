# Ratings and comments

> **About this document.** This is the **target-state source of truth** for ratings and comments in Project Imperium — venue-level customer reviews after a paid visit, how they are invited, how they surface on the business, and how the venue replies or requests removal. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes ratings and comments as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **venue reviews**: the customer feedback a live venue collects after a closed sales instance, and how that feedback appears to other customers and to the venue. It covers:

- the **review** itself — a required **score** and optional **text**, always tied to one closed **sales instance**;
- **eligibility** — only after the instance's bill is fully settled and the instance is closed;
- **review invites** — the **receipt QR** printed at close, the **delivery review email**, and review from **order history**;
- **invite lifetime** — unused expiry and one-shot spend on submit;
- **sign-in and sign-up** through the invite when the guest has no account yet;
- **public surfacing** on the venue's discovery profile and the **cached average rating and rating count** published onto the business;
- the venue's **one reply** per review;
- **abuse removal** requested by the venue and decided by **superadmin**; and
- the **notification and email events** this subject raises (delivery owned by the notifications and emails subjects).

It deliberately does **not** cover:

- **favorites** — saving venues for quick access is a per-user bookmark, not feedback. It belongs with the users subject, not here.
- the **sales instance, bill, settlement, and close** — the sales-points-and-instances, order-flow, and payments-and-tax subjects own opening, settling, and closing a sitting. This subject reads a closed, settled instance as the unit a review attaches to.
- **orders as billable lines** — the orders subject owns individual lines. A review is **not** per order line; it is once per sales instance bill.
- **producing the receipt** — the **receipts-and-bills** subject owns receipt content, numbering, and that a closed meal receipt carries the **review QR**; the printers-and-screens subject owns paper print and layout; order-flow owns when the sitting closes. This subject requires that the closed-instance receipt carry a **review QR** beside the bill information.
- **discovery browse and filters** — the business subject owns discovery fields and that average rating and rating count are server-owned caches; this subject **publishes** those caches whenever reviews change.
- **customer KPIs** (average rating, review volume, rating distribution) — the business-metrics subject owns their formulas and presentation in reports; this subject is the source of the underlying reviews.
- **inbox, severities, and email sending** — the notifications and emails subjects own delivery; this subject names which review events fire and who they address.
- the **superadmin console** surfaces beyond the removal decision — the superadmin subject owns that console; this subject states that superadmin accepts or rejects a venue's removal request.

---

## 2. Domain model and vocabulary

### Entities

- **Review** — one customer's scored feedback on one **Business**, for exactly one closed **sales instance**. It carries a required **score**, optional **text**, the **author**, the **sales instance** (and thus the receipt / ticket context), an optional **business reply**, and timestamps. Soft-delete applies under the platform convention.
- **Business reply** — the venue's single public text response to one review.

### Terms this subject introduces

- **Score** — an integer from **0** through **5** inclusive; whole stars only.
- **Review text** — the optional free-text comment on the venue that accompanies the score.
- **Review invite** — a one-time link that opens review for a specific closed sales instance: the **receipt QR**, the matching link in a **delivery review email**, or the same eligibility opened from **order history**.
- **Receipt QR** — the review invite printed on the sales receipt when a sales instance closes, beside the bill information.
- **Delivery review email** — the operational email that invites the customer to review a delivery sitting a few hours after handover.
- **Invite lifetime** — how long an unused review invite stays valid from instance close (**30 days**); submitting a review **spends** every invite for that instance.
- **Average rating** — the mean of the venue's non-deleted review scores, cached on the business for discovery; only Project Imperium updates it.
- **Rating count** — the number of non-deleted reviews for the venue, cached on the business for discovery; only Project Imperium updates it.
- **Removal request** — a venue's ask that **superadmin** soft-delete a review for abuse.
- **Author label** — the short public name shown with a review (for example the author's first name).

Terms reused rather than redefined here: **Business**, **Customer**, **Sales instance**, **Bill**, **Order**, **Channel**, **Delivery**, **managers and above**, **soft delete**, **go-live** / **live** venue, and **discovery**.

---

## 3. Capabilities

### 3.1 The review

- A review belongs to exactly one **Business** and exactly one closed **sales instance**. It is venue-level feedback about the visit, not a rating of a single order line.
- Every review has a required **score** (integer **0–5**) and may carry optional **review text**.
- Every review **keeps a durable reference to its sales instance** (the ticket / receipt context) so managers can open the visit data when they act on the feedback.
- A review records its **author** (the signed-in customer who submitted it) and when it was submitted.
- Only **live** venues receive reviews; a draft or offline venue is not reviewable.

### 3.2 Eligibility and cardinality

- A sales instance becomes reviewable only when its **bill is fully settled** — every line is paid, invitation, voided, or otherwise leaves **no open balance** — and the instance is **closed**. Settlement paths (payment, invitation, and the rest) belong to the orders and payments-and-tax subjects; this subject only requires that close happened with a zero balance.
- There is **at most one review per sales instance**. The same customer may review the same venue again on a **later** closed instance.
- An instance closed with **no orders** is discarded by the sales-points-and-instances subject and never becomes reviewable.

### 3.3 Invites: receipt QR, delivery email, order history

- **On close**, when the **customer receipt** is issued, Project Imperium includes a **receipt QR** beside the bill information. That QR is the review invite for that sales instance. This applies to meal sittings that receive a customer receipt (dine-in, QR table service, kiosk, delivery, and other surfaces) per the receipts-and-bills subject.
- **Delivery.** When a delivery sitting reaches **handover** and still has no review, Project Imperium sends a **delivery review email** to the attributed customer **three hours after handover**. The email carries the review invite for that instance. If a review already exists, the email is skipped.
- **Order history.** A signed-in customer may open review from **order history** for any of their eligible closed instances that still have no review and whose invite has not expired, without needing the printed QR or the email.
- All three paths share the same eligibility rules and the same one-review-per-instance rule.

### 3.4 Sign-in, sign-up, and who may submit

- Only a **signed-in customer** may submit a review.
- A guest who scans the receipt QR (or opens the email invite) **without an account** may **create an account through that same invite**, then submit the review for that instance.
- When the sales instance already has an **attributed customer**, only that customer may submit (after sign-in). When the sitting has **no attributed customer** (for example a walk-in settled without an account), the signed-in user who completes the invite — including after **sign-up via the receipt QR** — becomes the author and is bound to that instance.

### 3.5 Invite lifetime and one-shot spend

- An unused review invite remains valid for **30 days** from instance close, then **expires**.
- When a review is successfully submitted, **every invite for that instance is spent** — the receipt QR and any matching email or history action no longer accept a second submit.
- After submit, the review is **immutable** for the customer: no edit and no self-delete.

### 3.6 Public surfacing and cached aggregates

- Reviews are **public** on the venue's discovery profile: each shows its **score**, optional **text**, **date**, and **author label**.
- Project Imperium maintains **average rating** and **rating count** on the business as cached aggregates for discovery. Only Project Imperium updates them. They are recomputed whenever a review is added or soft-deleted so discovery and the business-metrics customer KPIs stay consistent.
- Soft-deleted reviews do not appear publicly and do not count toward the aggregates.

### 3.7 Business reply

- **Managers and above** may post **exactly one business reply** per review — public text under that review.
- The same managers may **edit** that reply afterward. There is never a second reply thread; one review, one reply.
- Ordinary employees do not author or edit replies.

### 3.8 Abuse removal

- Customers never delete their own reviews.
- **Managers and above** may file a **removal request** for abuse, still able to see the review's sales-instance context while they act.
- **Superadmin** **accepts or rejects** the request.
- An accepted removal **soft-deletes** the review and its business reply (if any) and **recomputes** average rating and rating count. A rejected request leaves the review public.

### 3.9 Notifications and email

This subject raises the following events; the notifications and emails subjects own inbox persistence, live push, and mailbox delivery:

| Event | Who is notified | Channel |
| --- | --- | --- |
| New review | The venue's managers and above | In-app |
| Business reply posted or edited | The reviewing customer | In-app + email |
| Removal request decided | The managers who requested removal | In-app |
| Delivery review invite | The attributed delivery customer | In-app + email (three hours after handover, if still unreviewed) |

- No blast goes to all staff on a new review. Peer customers are not notified when someone else reviews the venue.

---

## 4. Roles and entitlements

The owning user is an admin at every venue they own. Job roles and per-user capabilities follow the global access model; this subject does not add a separate capability flag for reviews.

### Base access layers

| Layer | Review powers |
| --- | --- |
| **Customer** | Submits a review for an eligible closed sales instance (after sign-in or sign-up via invite); reads public reviews on discovery; reads their own reviews as read-only; receives the delivery review invite and reply notifications. |
| **Employee** | Everything a customer can do as a person; does **not** manage the venue's reviews, replies, or removal requests while acting as ordinary staff. |
| **Manager** | Reads the venue's reviews with sales-instance context; posts and edits the one business reply; files removal requests; receives new-review and removal-decision notifications. |
| **Admin/owner** | Everything a manager can do. |
| **Superadmin** | Accepts or rejects removal requests. Does not author customer reviews or venue replies. |

### Who can do what

| Activity | Who |
| --- | --- |
| Submit a review for an eligible closed sales instance | Signed-in customer (sign-up via the same invite allowed) |
| Edit or delete own review after submit | No one (immutable; removal only via §3.8) |
| Read public reviews on discovery | Anyone who can see the venue's public profile |
| Read reviews with ticket / sales-instance context in the business app | Managers and above |
| Post or edit the one business reply | Managers and above |
| Request review removal for abuse | Managers and above |
| Accept or reject a removal request | Superadmin |
| Receive new-review notification | The venue's managers and above |
| Receive business-reply notification | The reviewing customer |
| Receive removal-decision notification | The managers who filed the request |
| Manage favorites | Out of scope — users subject |
