# Operational reasons

> **About this document.** This is the **target-state source of truth** for operational reason catalogues in Project Imperium — the closed lists a venue picks from when voiding, inviting, manually discounting, refunding, or re-editing a submitted count. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes operational reasons as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **operational reason catalogues** used when staff must justify a controlled act. It covers:

- five **closed, platform-defined catalogues** — **void**, **invitation**, **manual discount**, **refund**, and **count re-edit**;
- the shared **selection rule** (required catalogue code; **Other** with an optional short free-text note);
- **who maintains** the catalogues and what happens when a code is **retired**;
- **customer visibility** (reasons are never guest-facing); and
- **reporting-by-reason** expectations for the four money and sales acts, versus audit-only use for count re-edit.

It deliberately does **not** cover:

- the **acts themselves** — voiding or inviting an order, applying a manual discount, issuing a refund, and re-editing a submitted count belong to the **orders**, **payments-and-tax**, and **inventories** subjects. This subject owns only the reason codes those acts require;
- **who may perform** those acts — base access layers and capabilities belong to the **access-and-permissions** subject and are restated on each owning subject;
- **other reason-bearing acts** — attendance reasons (time-control), purchase-edit and purchase-cancel reasons (purchases), month reopen (inventories), daily reopen (sales-reports), gift-card void (gift-cards), optional house paid-in/out reasons (employee cash-out), and similar. Those stay with their owning subjects and are **not** the five closed catalogues this subject owns;
- **KPI formulas and report roll-ups** — the **business-metrics**, **sales-reports**, and **business-reports** subjects own figures and periods; this subject states that reason code is a breakdown axis where those subjects already care about voids, invitations, manual discounts, and refunds;
- **visual design and exact UI copy** — out of scope for the product set.

---

## 2. Domain model and vocabulary

### Entities

- **Operational reason catalogue** — a closed, platform-defined list of reason codes for one controlled act. There are exactly five stage-1 catalogues: void, invitation, manual discount, refund, and count re-edit.
- **Operational reason** — one code from an operational reason catalogue, recorded on the act that required it. When the code is **Other**, it may carry an optional short free-text note.

### Terms this subject introduces

- **Reason code** — a named value from a closed operational reason catalogue. Venues select a code; they never invent one outside the catalogue.
- **Other note** — the optional short free-text explanation that may accompany the **Other** code. It is for staff audit only and is never a report dimension.
- **Retired reason code** — a code the product has removed from selectable lists. It remains readable on historical acts and in reports for past activity, but is not offered for new acts.

Terms reused rather than redefined here: **void**, **invitation**, **manual discount**, **refund**, **count**, **base access layer**, **managers and above**, **supervisor**, and **soft delete**.

---

## 3. Capabilities

### 3.1 Closed platform catalogues

- Each of the five catalogues is **closed and platform-defined**. A business neither adds, renames, nor removes a reason code.
- Every controlled act that requires an operational reason **must** record exactly **one** reason code from the catalogue that belongs to that act.
- Free-text alone is **never** a valid reason. The only free text allowed is the optional **Other note** when the selected code is **Other**.
- Catalogues are **amended only by product commitment** — by changing this subject when the product adds, renames meaning, or retires a code. Stage 1 has **no** venue catalogue editor and **no** Superadmin catalogue UI for operational reasons.
- A recorded act keeps the **reason code chosen at the time**. When a code is later **retired**, it stays readable on history and in reports for past acts, and is **not selectable** for new acts.

### 3.2 Visibility

- Operational reason codes and Other notes are **never shown to the customer** — not on bills, receipts, self-ordering, kiosk, delivery, or any other guest surface.
- Staff who may perform the act, or who may review the record or report that carries it, can see the reason code and any Other note.

### 3.3 Void catalogue

Used when a manager voids a sent order (orders subject). Selectable codes:

| Reason code |
| --- |
| Wrong item |
| Customer changed mind |
| Kitchen / prep error |
| Out of stock |
| Duplicate entry |
| Training / test |
| Other |

### 3.4 Invitation catalogue

Used when a manager marks a sent order as invitation / complimentary (orders subject). Selectable codes:

| Reason code |
| --- |
| Guest recovery |
| Staff / employee meal |
| Owner or manager discretion |
| VIP / marketing |
| Supplier or partner |
| Other |

### 3.5 Manual discount catalogue

Used when a manager applies a manual discount on an order (orders subject). Selectable codes:

| Reason code |
| --- |
| Guest recovery |
| Price match / missing promotion |
| Manager discretion |
| Service recovery |
| Other |

### 3.6 Refund catalogue

Used when a manager approves and issues a refund (payments-and-tax subject). Selectable codes:

| Reason code |
| --- |
| Customer dissatisfaction |
| Wrong order or charge |
| Item unavailable after payment |
| Duplicate charge |
| Cancelled after payment |
| Other |

### 3.7 Count re-edit catalogue

Used when supervisor layer or above re-edits a submitted physical count (inventories subject). Selectable codes:

| Reason code |
| --- |
| Miscount |
| Wrong unit |
| Wrong item |
| Goods arrived after count |
| Entry error |
| Other |

### 3.8 Reporting by reason

- Where sales and business reporting already present **void**, **invitation**, **manual discount**, or **refund** figures, operators can break those figures down **by reason code**.
- All acts recorded under **Other** bucket together under that code. The **Other note** is **not** a report dimension.
- **Count re-edit** reasons stay on the **inventory audit trail** only. They are **not** a sales-report or business-metrics dimension.
- The **reason** dimension and which KPIs support it are owned by the business-metrics subject; daily and roll-up report surfaces present the breakdowns those definitions allow.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Operational-reason powers |
| --- | --- |
| **Customer** | Never sees an operational reason code or Other note; never selects one. |
| **Employee** | Does not void, invite, manually discount, refund, or re-edit a count, so does not select these catalogues. May see a reason only where a report or audit surface their layer is allowed to open already exposes it. |
| **Supervisor** | Selects a **count re-edit** reason when re-editing a submitted count (inventories and access-and-permissions defaults). Does not select void, invitation, manual discount, or refund reasons unless a higher layer applies. |
| **Manager** | Selects void, invitation, manual discount, and refund reasons when performing those acts; selects count re-edit reasons when re-editing counts. |
| **Admin/owner** | Everything a manager can do for these catalogues. |

Catalogue **maintenance** (adding, renaming meaning, or retiring codes) is **not** a venue or Superadmin console power in stage 1; it is a **product amendment** of this subject.

### Who can do what

| Activity | Who |
| --- | --- |
| Select a void, invitation, or manual discount reason | Managers and above, when performing the act (orders subject) |
| Select a refund reason | The manager on duty, when approving and issuing the refund (payments-and-tax subject) |
| Select a count re-edit reason | Supervisor layer and above, when re-editing a submitted count (inventories subject) |
| See reason codes and Other notes on acts and reports | Staff who may perform or review those acts or open the report surfaces that include them |
| Add, rename, or remove a catalogue code at a venue | No one |
| Edit catalogues in the Superadmin console (stage 1) | No one |
| Amend the platform catalogues | Product commitment (change this subject) |
