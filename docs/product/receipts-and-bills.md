# Receipts and bills

> **About this document.** This is the **target-state source of truth** for customer receipts and bills in Project Imperium — the customer-facing check and settlement proof, their required content, numbering, and reprint and replacement identity. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes receipts and bills as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **customer bill** and **customer receipt** as issued documents: what they contain, when they are issued, how they are numbered, and how reprints and replacements keep identity reconcilable. It covers:

- the **bill** — the pre-settlement check presented when a staff tab requests the bill;
- the **receipt** — the post-settlement proof issued when a sales instance (or gift-card deposit checkout) is fully settled;
- **required content** for each document kind, including the **handover pass** and **handover QR** on self-service receipts;
- **bill numbers** and **receipt numbers**, and how they relate to (and differ from) batch **identification codes** and the handover pass;
- **reprint** of an unchanged document; and
- **replacement** when a previously issued document's underlying bill or payments change (including after a reopened work day).

It deliberately does **not** cover:

- the **bill as line aggregation** — composition of orders, voids, invitations, cancellations, transfers, and discounts belong to the **orders** subject. This subject presents that aggregation as a customer document.
- **settlement** — payment methods, splits, partial payments, tips, over-tender, refunds, and tax calculation belong to the **payments-and-tax** subject. This subject records on the document what that settlement produced.
- the **service journey** — when a tab enters Bill, settles, and closes belong to the **order-flow** subject. This subject owns the documents those moments issue.
- **printing and routing** — which receipt printer, backup, print failure, and **print permission** belong to the **printers-and-screens** subject. That subject may arrange the **layout** of the fields this subject requires; it does not add or remove required content.
- **notifications and emails** — delivering a receipt in-app or by email belongs to the **notifications** and **emails** subjects. Their payload must satisfy this subject's receipt content; they do not invent a thinner email-only set.
- **prep tickets**, **kiosk handover tickets**, and the **customer pickup board** — printers-and-screens.
- the **gift-card virtual card** email and card identity — the **gift-cards** subject. This subject owns the **deposit receipt** that proves payment for a paid card; gift-cards owns delivering the card itself.
- **platform billing documents** — the **platform-billing** subject.
- **batch identification codes** — the **orders** subject issues them for kitchen and handover; they may appear on bill and receipt content but are never the fiscal document number.
- **handover pass verification and the handover action** — the **sales-points-and-instances** and **order-flow** subjects own scanning, fallback code entry, partial versus whole-batch handover, and invalidation. This subject owns the pass and QR as receipt content.
- **delivery provider calls** — the **delivery-integrations** subject owns courier requests, handover calls, cancellations, and retries. This subject owns what the receipt shows.
- the **review invite** mechanics beyond requiring the **review QR** on a meal receipt — the **ratings-and-comments** subject.
- **daily reopen** of a work day — the **sales-reports** subject. This subject states how document identity follows an amended bill or payment after reopen.
- the **cash-out resume** and **cash-movement receipt** (employee wallet documents) — the **employee cash-out** subject owns those documents, their numbers, and reprint rules. They are not customer bills or receipts.

---

## 2. Domain model and vocabulary

### Entities

- **Customer bill** — the pre-settlement check document for one **sales instance**. It presents the instance's open bill for payment. It carries a **bill number**.
- **Customer receipt** — the post-settlement proof document for one fully settled **sales instance**, or for one **gift-card deposit checkout**. It carries a **receipt number**.

### Terms this subject introduces

- **Bill number** — the platform-issued identity of a customer bill for one Business. Unique within that Business's bill sequence; never chosen by a client.
- **Receipt number** — the platform-issued identity of a customer receipt for one Business. Unique within that Business's receipt sequence; never chosen by a client.
- **Reprint** — a further print or delivery of an **unchanged** current bill or receipt that keeps the **same** number and is marked as a reprint.
- **Replacement** — a new bill or receipt issued because the underlying lines or payments **changed** after a prior document was issued. It receives a **new** number and states that it **supersedes** the prior number; the prior number remains on file.
- **Deposit receipt** — a customer receipt for a paid **gift-card deposit checkout** (not a meal sales instance). It has no review QR, no handover pass, and no bill document.
- **Handover pass** — the self-service batch's handover identity: an opaque token, the batch identification code, and — for QR self-ordering and kiosk — a **handover QR**. It is receipt content, not a fiscal number.
- **Handover QR** — the QR on a QR self-ordering or kiosk receipt that encodes the handover pass token. Staff scan it at handover. It is **not** the **review QR**.
- **Order reference** — the customer-facing label for the batch identification code on a **delivery** receipt. Delivery receipts carry no handover QR.

Terms reused rather than redefined here: **Business**, **Sales instance**, **Sales point**, **Order**, **Batch**, **Identification code**, **Bill** (aggregation), **Payment**, **Tip**, **Outstanding balance**, **Gift card**, **Review QR**, **print permission**, **edited flag**, **soft delete**, **business currency**, and **trade name**.

---

## 3. Capabilities

### 3.1 Document kinds

- Project Imperium issues two customer document kinds for ordinary service: the **customer bill** (pre-settlement check) and the **customer receipt** (post-settlement proof).
- A **staff tab** may receive a bill when the sitting first enters **Bill** / requests the check, and a receipt when settlement closes the instance.
- A **self-service** sitting (self-ordering, kiosk, delivery) **never** receives a customer bill; it receives a **receipt** at pay-to-commit when the instance closes for billing.
- A **gift-card deposit checkout** receives a **deposit receipt** on settlement and **no** customer bill.
- Prep tickets, kiosk handover tickets, gift-card virtual-card mail, and platform billing documents are not customer bills or receipts under this subject.

### 3.2 When documents are issued

- A **bill number** is assigned on the **first Bill request** for that sales instance — whether the check is shown on screen, printed, or later emailed — not at open, and not only at first paper print.
- A **receipt number** is assigned when the sales instance (or deposit checkout) **fully settles**: outstanding balance reaches zero, or tender **surpasses** outstanding under payments-and-tax over-tender rules.
- Guests may pay a shared tab with **different methods at different times**. Partial payments do **not** each produce a receipt. The bill gathers progress until the amount is covered or surpassed; **one receipt** is issued for that sales instance at full close, listing every payment that closed it.
- A split arrangement does not multiply receipts: there is still **one receipt per sales instance** at full settlement.

### 3.3 Bill required content

Every customer bill carries at least:

- **venue identity** — trade name, address, the Company's **legal name**, and the Company's **tax number**;
- **datetime** of issue (and the work day in the business timezone);
- **sales-point** context for the sitting;
- **line items** — each main good and its add-ons, with void and invitation lines listed, flagged, and uncharged;
- **discounts and promotions** applied;
- **tax breakdown** by tax category on amounts still chargeable;
- **outstanding balance**;
- every **batch identification code** on the instance; and
- the **bill number**.

After one or more **partial payments**, a reprinted or re-shown bill also carries **payments applied so far** (method, amount, tip) and the **remaining outstanding**. A bill never carries a **review QR** and is never the settlement proof.

### 3.4 Receipt required content

Every **meal** customer receipt carries at least:

- everything a bill carries for that instance at close (lines, discounts, identification codes, venue identity, sales-point context);
- each line's **derived allergens** (or the explicit none state) from the business-goods subject — so allergen information is available again at **handover or delivery** for self-channel sittings (distance-selling: before purchase on catalogue and basket, and again at fulfilment handoff);
- **every payment** that closed the sitting (method, amount, tip);
- **gift-card tender** when used — amount applied and enough card identity to reconcile with the gift-cards subject (without exposing secrets beyond what that subject already shows a holder);
- **tax breakdown** on amounts **actually paid**;
- **zero outstanding** (or close after over-tender, with owed / tendered / change or tip as below);
- the **receipt number**;
- for a **QR self-ordering** or **kiosk** meal sitting, the **handover pass**: the batch **identification code** and the **handover QR**, in a clearly labelled **Handover** block; for a **delivery** meal sitting, the **order reference**; and
- the **review QR** required by the ratings-and-comments subject, in a separate **Review us** block.

A **delivery** receipt still carries the handover pass internally for consistency, but it renders the **order reference** only: the identification code and no handover QR, with no “show this QR” instruction. A **deposit receipt** carries venue identity, datetime, amount paid, tender, receipt number, and gift-card identity as the gift-cards subject defines for the new card. It carries **no** review QR, no handover pass, and no meal line items.

The **handover QR** and the **review QR** are different codes with different jobs. Only the review QR is the review invite; only the handover QR releases a batch.

When tender **surpasses** outstanding, the receipt shows amount **owed**, amount **tendered**, and either **change returned** or the surplus taken as **tip** — whichever the guest chose at settlement (payments-and-tax).

### 3.5 Numbering

- Each Business has **two** lifelong sequences: one for **bill numbers** and one for **receipt numbers**. Numbers are platform-issued, monotonic per sequence, and do not reset each work day.
- Bill numbers and receipt numbers are **independent**. A bill number never becomes a receipt number.
- **Batch identification codes** remain a third scheme owned by orders. They appear on bill and receipt content for kitchen and handover reconciliation; they are never the bill or receipt number.
- The **handover pass** is not a fourth document number. It is an opaque handover token tied to one batch, and it never appears in the bill or receipt sequence.

### 3.6 Reprint

- Reprinting or re-delivering an **unchanged** current bill or receipt keeps the **same** number and is marked **reprint**. A reprint is not a new fiscal document.
- A reprint or re-delivery keeps the **same handover pass and QR** for that batch. It never issues a new handover token, and a reprint after the batch is fully delivered still resolves to the delivered state.
- Who may trigger a paper reprint follows **print permission** (printers-and-screens). Customers may receive another copy of their own receipt through in-app order history or email without consuming a new number.

### 3.7 Unpaid bill updates vs paid immutability

- While the sales instance is **not** fully paid and closed, the **customer bill** stays the live check for that sitting under the **same bill number** assigned on first Bill request. Staff may still void, invite, cancel, or add lines (orders subject). After any such change, the waiter **must reprint or re-show** the bill; content **updates** under that **same** number and is marked **reprint** — it is not a new bill number.
- Once the sitting is **fully paid and closed**, the issued **bill** (final check state) and **receipt** are **immutable snapshots** of what the customer was shown and settled. Cancelling or amending lines later does not rewrite those bodies. Issued paid documents remain reconstructible even if a cancelled order is hard-deleted (orders; ADR-0003).
- **Replacement with a new number** that **supersedes** a prior number applies when a **closed** work day is **reopened** and an already-settled bill or payment is amended (sales-reports edited path), or when a **receipt** must be re-issued after such an amendment. The superseded number stays on file. Reprints of the **current** post-reopen version use the current number.
- Replacement aligns with the durable **edited** flags on bill, payment, and daily sales report owned by sales-reports; this subject does not own reopen itself.

### 3.8 Channels and layout

- Required content applies whether the document is **shown on screen**, **printed**, or **emailed**. There is no thinner content set for email.
- The **Handover** block appears on a self-service receipt as follows: heading **“Handover QR”** with instruction **“Show this QR when we hand over your order.”** for QR self-ordering; the same heading with **“Show this QR at the counter to collect your order.”** for kiosk; and **“Order reference”** with **“We’ll hand your order to the courier. Keep this reference.”** for delivery. The review block is separate and always labelled **“Review us”**.
- This subject owns **what** must appear; the printers-and-screens subject owns **how** those fields are laid out on paper (platform layout only — no venue template editor) and which receipt printer prints them. Layout must not omit or invent required content.
- A venue that issues printed bills or receipts needs a usable receipt-printer path as printers-and-screens requires. The same required content is also available in-app and by email.

### 3.9 Retention

- Issued bills and receipts are retained with the legal and financial class under the plan quotas and data retention subject. Soft-delete of a sales instance or payment never erases the need to reconstruct what the customer was shown. **Paid and closed** document bodies are the snapshots that satisfy that need.

---

## 4. Roles and entitlements

| Layer | Receipts and bills powers |
| --- | --- |
| **Customer** | Receives own bill (when a staff tab shows or shares it) and own receipt (in-app, email, or print at the venue), including the self-service handover pass where the receipt carries one; may request another copy of their own receipt from order history; never issues another guest's document or changes numbering. |
| **Employee** | Requests the bill on a tab they run; takes payments that lead to receipt issue; prints and reprints customer bills and receipts only with **print permission**. |
| **Supervisor** | Same as employee for bill request and settlement on tabs they may run; print permission by layer default. |
| **Manager** | Everything a supervisor can do; may act on reopen-driven replacements when amending bills and payments under sales-reports and orders rules. |
| **Admin/owner** | Full venue control over the same operational acts; no separate numbering configuration — sequences are platform-owned per Business. |

### Who can do what

| Activity | Who |
| --- | --- |
| First Bill request (assigns bill number) | On-duty staff who may move the tab to Bill (order-flow) |
| Issue receipt at full settlement | Automatic with settlement close; staff or customer completes payment per payments-and-tax |
| Print or reprint bill or receipt on paper | Users with **print permission** |
| Receive own receipt in-app or by email, including the handover pass | The ordering / paying customer (emails and notifications) |
| Scan the handover QR or enter the identification code at collection | Staff fulfilling the batch on an entitled handover surface (sales-points-and-instances) |
| Issue deposit receipt on gift-card purchase | Automatic with deposit settlement (gift-cards + payments-and-tax) |
| Replacement after amended bill or payment | Follows who may change the bill or payment; document identity updates automatically |

Job roles follow the floor hierarchy for tabs and settlement. This subject adds no separate capability beyond relying on **print permission** for paper issue and reprint.
