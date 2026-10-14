# Suppliers

> **About this document.** This is the **target-state source of truth** for the suppliers a venue buys from in POS. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes suppliers as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **vendor relationship**: the suppliers a business buys from, and the actions a venue takes toward them. It owns:

- the supplier **profile** — the vendor's name and note;
- the supplier **address**;
- the supplier **contacts**;
- the supplier **tax number**;
- the supplier **in-use lifecycle** — **in use** and **out of use** — and the supplier's **deletion**;
- the **supplier-to-goods relationship** as seen from the vendor — the goods a supplier offers;
- the supplier's **purchase history** as presented on the vendor; and
- the **supplier-facing action** of composing a goods request for a vendor and sending it.

It deliberately does **not** cover:

- the **goods themselves** — the supplier-goods subject owns a good's measurement unit, purchase unit and price math, budget impact, allergens, par level and minimum, and the good's own in-use state. This subject owns the supplier and names the supplier-to-goods relationship; it exposes a read of a supplier's goods but does not define them.
- the **purchase record** — a purchase's lines and their requested-versus-delivered quantities, receipt photos, the inventory increment, one-time purchases, delivery acceptance, and the reason-and-audit rule for line edits belong to the purchases subject. This subject owns the supplier-facing request action and the vendor's view of the resulting history.
- **business goods** (sellable items and their recipes) that consume supplier goods — the business goods subject owns them.
- the **waste thresholds** keyed to a supplier good's budget impact — the business-metrics subject owns them.
- **messages directed at POS users** — inbox notifications and account, operational, and engagement emails belong to the notifications and emails subjects. Supplier correspondence is addressed to **third parties** and is this subject's.
- the **Business** and its tenancy — the business subject owns it.
- **amounts payable to a supplier** — accounts payable and supplier invoices as financial obligations are not part of POS.

---

## 2. Domain model and vocabulary

### Entities

- **Supplier** — a vendor a business buys from. A supplier belongs to **exactly one Business**; it is **never shared across businesses** and is never visible to customers. It carries a name, an optional note, an optional address, a list of contacts, an optional tax number, and an **in-use state**. A supplier owns its own goods.
- **Supplier address** — the supplier's structured postal address. It is **descriptive only**.
- **Supplier contact** — a person at the supplier, carrying a name and optional phone, email, and role/label. At most one contact is **primary**.
- **Supplier goods** — the goods a supplier offers. Every supplier good belongs to **exactly one** supplier, and a supplier owns its own list. The good's own fields are introduced and owned by the supplier-goods subject; this subject only names the relationship.

### Terms this subject introduces

- **In use** — a supplier the venue currently buys from; offered wherever a supplier is selected.
- **Out of use** — a supplier the venue no longer buys from. It is **withdrawn from new selection** but keeps its history and can be returned to use. Out of use is **not** deletion.
- **Primary contact** — the one contact on a supplier designated as the default recipient; a supplier may have none.
- **Tax number** — the supplier's tax identifier.
- **Goods request** — the supplier-facing ask by which a venue proposes goods to buy from a supplier and sends it; it is the **pre-delivery state of a purchase**.

"Vendor" is prose for a **Supplier**. The **Business**, the **Supplier good**, and the **Purchase** are established core terms; this subject does not redefine them.

---

## 3. Capabilities

### 3.1 The supplier profile

A business keeps its own list of suppliers.

- Every supplier carries a **name**, which is required, and an optional free-text **note**.
- The name is **not** required to be unique: a venue may legitimately keep two suppliers of the same name. The supplier is told apart by its record, not by its name.
- Suppliers are **internal to the business** — invisible to other venues and never shown to customers.

### 3.2 The supplier address

- A supplier carries **one optional structured address** — country, state, city, street, building number, optional unit, complement, post code, region, and details.
- The address is **descriptive only**: unlike the business's own address it derives **no timezone**, carries **no coordinates**, and plays **no part in discovery**.

### 3.3 Contacts

- A supplier carries a **list of contacts**; each contact is a **name** with optional **phone**, **email**, and **role/label**.
- **At most one** contact is marked **primary**.
- A supplier with **no contacts** is valid; the list is convenience, not a requirement.

### 3.4 Tax number

- A supplier's **tax number** is **optional**.
- When present it must be **unique within the business** among **active** suppliers — two venues may each keep a supplier with the same identifier, but one venue may not hold two active suppliers with it.
- Soft-deleting a supplier **frees** its tax number for reuse.

### 3.5 In-use and out of use

The in-use state is the supplier's lifecycle, separate from its existence.

- A supplier is **in use** or **out of use**; a venue sets the state deliberately.
- A supplier **cannot be taken out of use while any of its goods is in use** on a business good. The venue must first remove those goods from the business goods that use them, or point those recipes at another supplier's good, before the supplier can be withdrawn.
- An **out-of-use** supplier is **withdrawn from new selection** — it is not offered when composing a goods request, when recording a purchase, or when choosing a supplier for a new supplier good — and it keeps **all** of its history.
- An out-of-use supplier can be **returned to use** at any time.
- **Out of use is not deletion**: the supplier and its history remain whole, and nothing is retired.

### 3.6 The supplier's goods

- A supplier offers **its own goods**; every supplier good belongs to **exactly one** supplier. Two suppliers selling the same item hold **two independent goods**, each priced and configured on its own.
- Because the goods belong to the supplier, selecting a good is always a choice made **within one supplier's list**.
- The good's own fields belong to the supplier-goods subject; this subject only names the relationship.
- This subject exposes a read of **the goods a supplier offers** so the vendor's page can show its list.

### 3.7 Purchase history

- The vendor's page presents that supplier's **purchase history**: each purchase with its lines and their **requested** and **delivered** quantities, its prices, its total, its date, who recorded it, and its **receipt photos** (a purchase may carry **several**).
- Purchases that are still **awaiting delivery** are surfaced separately from those already received.
- The purchase record itself — its lines, the requested-versus-delivered values, photos, acceptance, and inventory effect — is the **purchases subject's**. This subject only renders that history against the supplier.

### 3.8 Requesting goods from a supplier

A venue composes a **goods request** for a supplier and sends it to the vendor.

- The request is built from **that supplier's own goods only**; a supplier with no goods cannot be requested from. Every line shows a good and a **quantity in its purchase unit**, with the price and the line total shown **when known**.
- A request needs **at least one line**.
- The request is sent by **email as an Excel or CSV attachment** to a **chosen contact**, defaulting to the supplier's **primary contact**, or it is **downloaded** for the venue to send itself. Downloading is always available, so a supplier with no email can still be requested from.
- The request is the **pre-delivery state of a purchase**. What was **requested** against what was **delivered**, the **receipt photos**, the **manual acceptance** of the delivery, and the resulting **inventory increment** belong to the purchases subject.
- A **sent** request is fixed; the only later change is the arrival step the purchases subject describes, where the user matches the record to the goods that physically arrived — a reason-and-audited edit — before manually accepting the delivery.

### 3.9 Deletion

- A supplier is deleted by **soft delete**; the record is retained and marked deleted, never hard-removed.
- A supplier is **deletable only when none of its goods is used in any business good**. If one of its goods feeds a business good, deletion is **blocked**.
- The block **warns**, naming the **business goods** made from that supplier's good and telling the venue to point those recipes at a good from **another supplier** first. Once no business good uses the supplier's goods, the deletion proceeds.
- Owning goods or having purchase history does **not** block deletion on its own. Deleting a supplier also **soft-deletes its goods**, which belong to that supplier alone, while its purchases and requests **remain as history**.
- Deletion is distinct from taking a supplier **out of use**: out of use is a reversible lifecycle move, deletion is terminal.

---

## 4. Roles and entitlements

Suppliers are an internal, operational surface: never visible to customers, and the record itself is never exposed to the supplier. A supplier receives only the correspondence the venue sends it.

### Base access layers

| Layer | Supplier powers |
| --- | --- |
| **Customer** | None. Suppliers are never visible to customers. |
| **Employee** | None by default; individual supplier capabilities may be granted. |
| **Manager** | Manages suppliers — profile, address, contacts, tax number, and in-use state — composes and sends goods requests, and views a supplier's goods and purchase history. |
| **Admin/owner** | Everything a manager can do, plus full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| Add, edit, or take a supplier out of use / back into use | Managers and above |
| Edit a supplier's address, contacts, tax number, and note | Managers and above |
| View a supplier's goods and purchase history | Managers and above |
| Compose and send a goods request to a supplier | Managers and above |
| Delete a supplier (blocked while its goods feed a business good) | Managers and above |
| View suppliers | Employees with the granted capability, and managers and above |

Supplier management sits with the managers who run purchasing and inventory, consistent with the rest of the supply and stock surfaces.
