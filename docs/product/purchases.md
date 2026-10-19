# Purchases

> **About this document.** This is the **target-state source of truth** for purchases in Project Imperium — the goods a venue buys from a supplier, from what it requests to what it receives. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes purchases as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **purchase record**: what a business asks a supplier for, what actually arrives, and how receiving feeds stock. It owns:

- the purchase's **origins** — composed from a sent **goods request**, or recorded directly at receipt;
- the purchase's **lifecycle** — **awaiting delivery**, **received**, and **cancelled**;
- the **purchase lines** — the supplier good, the **requested quantity**, the **delivered quantity**, and the price paid;
- **delivery acceptance** and the **inventory increment** it triggers;
- the **purchase total**, and the purchase as the venue's **price history**;
- the **receipt identification** and the purchase's **documents**;
- **one-time purchases** — ad-hoc expenses with no supplier-good tracking;
- **editing** a purchase with a **reason** and an audit record;
- **cancelling** a purchase that never arrived; and
- the purchase's interaction with a **closed inventory month**.

It deliberately does **not** cover:

- the **supplier** — its profile, address, contacts, tax number, in-use lifecycle, the composition and sending of a goods request, and the vendor's view of its goods and purchase history all belong to the suppliers subject. This subject owns what happens to a purchase **once it exists**; the suppliers subject owns the request action that may create it.
- the **supplier good** — its identity, unit of stock, purchase unit and price math, budget impact, allergens, par level and minimum, in-use state, and deletion belong to the supplier-goods subject. A purchase line names a supplier good but never defines or changes it.
- the **stock ledger and counting** — the dynamic system count, physical counts, count-period deviation, variance, waste computation, when each good was last counted, the monthly resume and its **close and reopen**, and **inventory transfers** between venues of one Company — belong to the inventories subject. This subject owns the increment a receipt contributes; the inventories subject owns the ledger it lands in. A transfer is not a purchase and carries no tax.
- the **waste thresholds** a good's budget impact selects — the business-metrics subject owns them.
- the **business** and its currency — the business subject owns them; a purchase prices in the business's single currency.
- **notifications** — the messages a venue or its staff receive belong to the notifications subject.
- **tax on sales, payments, and supplier invoicing** — the payments-and-tax subject owns sales tax, and **amounts payable to a supplier** and supplier invoices are not part of Project Imperium. A purchase carries no separate tax.

---

## 2. Domain model and vocabulary

### Entities

- **Purchase** — the record of a business's acquisition from a supplier, from what it asks for to what it receives. It belongs to **exactly one Business** and **exactly one Supplier**, except a **one-time purchase**, which has no supplier. It carries its lines, its date, the **purchasing employee**, a receipt identification, optional documents, a **total**, and a **state**. It is internal to the business and never visible to customers.
- **Purchase line** — one supplier good on a purchase, carrying the quantity requested, the quantity delivered, and the price paid for it. Every line belongs to exactly one purchase.
- **One-time purchase** — a purchase with **no supplier and no lines**: a single ad-hoc business expense.

### Terms this subject introduces

- **Awaiting delivery** — a purchase born from a sent goods request that has not yet been received; its stock has not moved.
- **Received** — a purchase whose goods are in hand; its delivered goods have been added to stock.
- **Cancelled** — a purchase withdrawn before it was received; it is kept as history and never affects stock.
- **Delivery acceptance** — the act of confirming what physically arrived and receiving it.
- **Arrival step** — recording the goods that physically arrived against a sent purchase, before accepting it.
- **Requested quantity** — the quantity of a good a purchase asked the supplier for.
- **Delivered quantity** — the quantity of a good that actually arrived.
- **Purchasing employee** — the employee who records a purchase.
- **Purchase price** — the price paid, per **unit of stock**, for a line's good; the venue's historical price for that purchase.
- **Receipt identification** — the reference that identifies a purchase — its own or the supplier's.
- **Purchase edit** — a change made to a purchase that is already a record, carrying a **reason** and an audit record.

Terms reused from other subjects rather than redefined here: **Business**, **Supplier**, **Supplier good**, **unit of stock**, **purchase unit**, **price per unit of stock**, the supplier's **in use** and **out of use** (suppliers), a supplier good's **in use** and **not in use** (supplier goods), **goods request** (suppliers), the **dynamic system count** (inventories), and **soft delete** (ADR-0003).

"Vendor" is prose for a **Supplier**. "Stock" is prose for the quantity a business holds of a supplier good.

---

## 3. Capabilities

### 3.1 Where a purchase comes from

- A purchase has **two origins**. It is either born from a **sent goods request** — the ask a venue composes and sends a supplier, which is the pre-delivery state of a purchase — or **recorded directly**, when goods arrive without a prior request through the platform.
- A purchase **born from a request** begins **awaiting delivery**: the venue has asked for goods and not yet received them.
- A purchase **recorded directly** begins **received**: the goods are already in hand, so the purchase is captured at receipt in one step. Such a purchase is recorded **without a reason**, because it is not yet a record being changed.
- Every purchase belongs to one business, carries its own date, and names the **purchasing employee** who recorded it.
- A purchase selects one **in-use supplier**. A supplier taken **out of use** is withdrawn from new purchases but keeps its past purchases as history; a supplier good that is **not in use** is still offered for purchase — only a **deleted** good is no longer offered.

### 3.2 The purchase line

- A purchase carries **at least one line** — except a one-time purchase, which has none. Each line names **one supplier good**.
- A line holds the **requested quantity** (what the purchase asked for) and the **delivered quantity** (what arrived), both expressed in the good's **unit of stock**. The good's **purchase unit** is shown only to help the venue enter quantities.
- A **partial** or **over** delivery is normal: a line may be delivered short of, equal to, or beyond what was requested. A purchase has **no part-received state** — what matters is the delivered quantity recorded for it.
- A received purchase may carry a line that was **never requested**, added when the goods arrived.
- A purchase **never moves to another supplier**, and a line **never points at more than one good**. Two suppliers selling the same item mean two separate purchases.

### 3.3 The arrival step and delivery acceptance

- A purchase born from a request becomes **received** only through **delivery acceptance**.
- Before accepting, the venue performs the **arrival step**: it matches the record to the goods that physically arrived and sets each line's delivered quantity. Because a sent purchase is already a record, **recording delivered quantities that differ from what was requested carries a reason and is audited**; accepting a delivery that matches the request needs no reason.
- **Acceptance adds each delivered quantity to the business's stock for that good**, into the inventory month the purchase's date falls in. A purchase that is only awaiting delivery, or was cancelled, **never moves stock**.
- A purchase **recorded directly** is received at the moment it is recorded, and its stock moves then.
- The increment belongs to the purchase; the **ledger** it lands in — the dynamic system count, the counts, and the count periods — belongs to the inventories subject.

### 3.4 The price and the total

- Each line records the **purchase price**: what the venue paid **per unit of stock** for that good, in the business's single currency.
- A purchase **does not change the supplier good's own price**. The good keeps its one current price; the purchase is the venue's **history** of what it actually paid.
- The purchase **total** is derived from its lines and is never entered by hand; a one-time purchase's total is the amount of the expense.
- A purchase carries **no separate tax**: the price paid is the price paid.

### 3.5 Receipt and documents

- A purchase other than a one-time purchase carries a **receipt identification** — its own reference or the supplier's — which is **unique within the business**, so the same receipt cannot be recorded twice.
- A purchase may carry **documents** — receipt photos or files. A purchase may hold **several**, added when the receipt arrives; documents are **optional**.

### 3.6 One-time purchases

- A **one-time purchase** records an **ad-hoc business expense** that is not tracked against a supplier good — a market run, a sundry purchase, an item bought outside the goods list.
- It has **no supplier and no lines**, and it **never moves stock**. It carries a date, the **purchasing employee**, an amount, a description, and optional documents.
- It is received at the moment it is recorded, because the expense has already happened.

### 3.7 Cancelling a purchase

- An **awaiting-delivery** purchase that will not arrive may be **cancelled**, with a **reason** — for example, *not delivered*.
- Cancelling is **terminal**: the purchase is **kept as history** — it documents that a request was made — and it **never touches stock**.
- A purchase that is already **received cannot be cancelled**. It is corrected by editing, never by removing it.

### 3.8 Editing a purchase

- A purchase that is already a record — a **sent request**, or a **received** purchase — is **corrected, never removed**: no purchase is hard-deleted, and a received purchase is never removed at all.
- A purchase **awaiting delivery** is fixed; the only change is the **arrival step** (§3.3). Its lines are not otherwise rewritten and its requested quantities are not changed.
- Editing a **received** purchase always carries a **reason**, records **who** made the change, **when**, and the **before and after of every line it changed**, and keeps the purchase's **entire edit history** — each edit is retained, never overwritten.
- Editing a received purchase **updates stock for the change**: raising a delivered quantity adds the difference, lowering it removes the difference, adding or removing a line adds or removes its quantity, and a price-only correction updates the purchase's value without moving stock. Changing a received purchase's **date** moves its stock into the month the new date falls in, and is blocked when that month is closed.
- The **reason belongs to the edit**: a single edit carries **one reason** and the line-by-line changes it made, rather than a reason per line.

### 3.9 The closed month

- An inventory **month** is **closed** — locked — on the inventories subject's terms. Closing a **count period** inside the month does **not** lock purchases; only the month close does. A month may be read for audit or the books at any range, whether or not it is closed.
- Once a month is **closed**, every purchase whose date falls in it is **read-only**: it cannot be edited, cancelled, or accepted, and its stock figures are frozen.
- Correcting a purchase in a closed month requires the month to be **reopened deliberately** by a membership with the **General Manager** or **Owner** job role, with a reason; only then does the purchase become editable again.

---

## 4. Roles and entitlements

Purchases are an internal, operational, management surface: never visible to customers, and never exposed to a supplier — a supplier receives only the goods requests the venue sends it, which the suppliers subject owns.

### Base access layers

| Layer | Purchase powers |
| --- | --- |
| **Customer** | None. Purchases are never visible to customers. |
| **Employee** | None. Purchases are not delegated to employees. |
| **Supervisor** | None. Purchases stay manager+ (no Manage). |
| **Manager** | Records, receives, edits, cancels, and views purchases; records one-time purchases. |
| **Admin/owner** | Everything a manager can do, plus full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| Record a purchase — directly, or by sending a goods request | Managers and above |
| Perform the arrival step and accept a delivery | Managers and above |
| Edit a purchase, with a reason | Managers and above |
| Cancel an awaiting-delivery purchase, with a reason | Managers and above |
| Record or edit a one-time purchase | Managers and above |
| View purchases and their edit history | Managers and above |
| Reopen a closed inventory month so a purchase can be corrected | General Manager or Owner job role (the inventories subject's action) |

Purchase management sits with the managers who run purchasing and stock, consistent with the supplier and supplier-good surfaces.
