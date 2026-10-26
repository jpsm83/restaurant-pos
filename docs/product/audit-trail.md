# Audit trail

> **About this document.** This is the **target-state source of truth** for the audit-trail model in Project Imperium — the shared who/what/when record left when a controlled act must be reconstructable. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes audit trails as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **unified audit model**: what an **audit entry** is, when an act must leave one, what guests never see, who may read trails, how entries relate to **operational reason catalogues**, and which **retention class** trails follow. It covers:

- the **audit entry** shape — who, what, when, and payload (before/after values; reason code and optional Other note when a reason is required);
- the **audit rule** — which kinds of acts must be audited, without cataloguing every concrete act;
- **append-only** integrity — corrections are new audited acts, never edits to prior entries;
- **visibility and read defaults** for guests, floor staff, managers, and Superadmin console trails;
- **retention and export** relative to the plan quotas and data retention subject; and
- that **operational reason codes** (and Other notes) are a **primary audited payload** when an act uses a catalogue.

It deliberately does **not** cover:

- **which concrete acts are audited** — each owning subject (orders, payments-and-tax, inventories, purchases, gift-cards, sales-reports, employee cash-out, feature-flags, superadmin, and others) names its audited acts and any explicit exceptions (for example a fulfilment gesture that is not audited);
- **catalogue contents and maintenance** for void, invitation, manual discount, refund, count re-edit, and further reason-bearing catalogues — the **operational reasons** subject owns closed lists, Other-note rule, retirement, and reporting-by-reason;
- **who may perform** the underlying acts — base access layers and capabilities belong to the **access-and-permissions** subject and the owning feature subjects;
- a **venue-wide searchable audit-log application** in stage 1 — trails are object- and report-attached, plus Superadmin console trails for platform support acts;
- **visual design and exact UI copy** — out of scope for the product set.

---

## 2. Domain model and vocabulary

### Entities

- **Audit entry** — one append-only record of a controlled act: who performed it, what was done to which business object(s), when, and the payload needed to reconstruct the change.
- **Audit trail** — the ordered history of audit entries on one business object, report surface, or Superadmin console scope.

### Terms this subject introduces

- **Actor** — who the entry attributes the act to: the signed-in **User** for floor and Manage acts; a clear **system** actor for platform/automated acts; and, when support **impersonation** is in force, the same User with an impersonation mark so the act is not treated as the user's unaided intent.
- **Audited payload** — the reconstructable detail on an entry: before/after values when stored values change; and, when the act requires a reason, the **reason code** and optional **Other note** from the operational reasons subject.

Terms reused rather than redefined here: **User**, **Business**, **Customer**, **managers and above**, **supervisor**, **base access layer**, **operational reason**, **reason code**, **Other note**, **soft delete**, **operational** and **legal and financial** retention, **data-integrity rule**, **impersonation session**, and **Superadmin**.

---

## 3. Capabilities

### 3.1 When an act must leave an audit entry

- Project Imperium leaves an **audit entry** when the act is a **controlled correction**, a **money, tax, or settlement** change, a **privilege or support** action, or an act a sibling already commits as **audited**.
- Ordinary day-of service work — creating, sending, or fulfilling orders, and similar — is **not** audited merely for happening.
- Explicit sibling exceptions stand (for example a fulfilment force-ready that the printers-and-screens subject states is not audited).
- A normal **handover pass** scan, a fallback handover by entering the identification code, and a **delivery provider** request, handover, or cancellation attempt are **not** audit entries. The scan and the provider attempt are operational fulfilment and integration events recorded on the batch and in the delivery sync log. A **manager-and-above override** that marks Delivered without a pass **is** audited with its actor, time, batch, and override note.
- This subject states the rule; owning subjects apply it to their acts.

### 3.2 Audit entry shape

Every audit entry carries at least:

- **Who** — the **actor** (signed-in User, system, or impersonation-marked User);
- **What** — the act kind and the business object(s) touched;
- **When** — the time of the act;
- **Payload as needed** — before/after values when a correction changes stored values; and a reason payload when the act requires a reason.

### 3.3 Reasons as audited payload

- When an act **requires a reason**, that reason is part of the **audited payload**: the catalogue **reason code** and optional **Other note**.
- Selection, catalogue contents, retirement, and maintenance belong to the **operational reasons** subject. Free-text alone is never a valid reason. Reason codes and Other notes are **never** a substitute for recording who, what, and when.

### 3.4 Append-only integrity

- Audit entries are **append-only**. Project Imperium does not edit, overwrite, or hard-delete them as a staff or console action.
- A wrong prior state is fixed by a **new audited act** (reverse, re-edit, amending event) that sits beside or references the prior entry.
- There is **no** staff “clear audit” action. Soft-delete and later retention purge of a parent record follow the plan quotas and data retention subject when the data-integrity rule allows; that path does not invent a separate staff purge of the trail alone.

### 3.5 Where trails surface

- Stage 1 has **no** dedicated venue-wide audit-log application and **no** portfolio-wide searchable audit browser for Owners.
- Trails are **object- and report-attached**: history on the count, purchase, refund, gift card, day reopen, cash movement, handover override, and so on, plus any roll-up a sibling already surfaces (for example cash-movement audit on the daily sales report, or delivery-integration exceptions on that report).
- The Superadmin console keeps its own trails for platform acts such as feature-flag edits, delivery provider catalogue edits, and impersonation sessions.

### 3.6 Visibility

- **Customers never see** audit entries, reason codes, Other notes, before/after correction payloads, or staff attribution of controlled acts — not on bills, receipts, self-ordering, kiosk, delivery, or any other guest surface.
- **Default read** for a Business: **managers and above** may read audit entries for acts in that venue’s domain.
- **Supervisors and employees** see audit detail only where a sibling already exposes it (for example a count re-edit they performed, or their own cash-movement history).
- **Superadmin** operators read platform and console audit trails in the Superadmin console. They do not gain a general power to browse venue floor audit unless a scoped support path the superadmin subject already grants is in force.
- There is no stage-1 cross-Company audit browser beyond each Business an admin already administers.

### 3.7 Retention and export

- An audit entry follows the **retention class of the business record it belongs to**, under the **data-integrity rule**. Project Imperium does not invent a third retention class for audit. When the parent is a money, tax, settlement, inventory-value, or closed-report record, the trail is **legal and financial** with that parent; when the parent is configuration or support-ops (for example a feature-flag console edit), the trail is **operational** with that parent.
- Operators do not physically remove audit trails as a product action. Soft-delete and later **retention purge** of a parent follow the plan quotas and data retention subject when integrity allows.
- Staff audit trails are **business records**, not customer-portable content. A customer **DSAR** export does **not** include venue audit entries, reason codes, or Other notes. Owner/Admin venue or portfolio export may include audit material that belongs to that Business under the data-retention export shape, still never as a guest-facing package.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Audit-trail powers |
| --- | --- |
| **Customer** | Never sees an audit entry, reason code, Other note, or controlled-act attribution. Never an audit actor for staff controlled acts. |
| **Employee** | Does not gain a general audit browser. Sees audit detail only where a sibling already exposes it for acts they perform or their own history. |
| **Supervisor** | Same default as employee for general read; sees trails siblings already expose for supervisor-layer acts (for example count re-edit). |
| **Manager** | Reads audit entries for the Business for acts in that venue’s domain; creates entries by performing audited acts they are entitled to. |
| **Admin/owner** | Everything a manager can do for venue audit trails at Businesses they administer. No stage-1 cross-Company audit browser beyond those Businesses. |

Superadmin console operators read and produce **console** audit entries (flags, impersonation, and similar) under the superadmin and feature-flags subjects. Catalogue maintenance for operational reasons remains a **product amendment**, not a venue or console catalogue editor in stage 1.

### Who can do what

| Activity | Who |
| --- | --- |
| Leave an audit entry by performing an audited act | Whoever the owning subject already entitles to that act (attributed to the signed-in User, or system / impersonation-marked as this subject requires) |
| Read venue object- and report-attached audit trails | Managers and above at that Business; supervisors and employees only where a sibling already exposes the detail |
| Read Superadmin console audit trails | Superadmin console operators per the superadmin and feature-flags subjects |
| Edit, overwrite, or clear an audit entry | No one |
| Browse a dedicated venue-wide or portfolio-wide audit-log app (stage 1) | No one |
| See audit material on any guest surface | No one |
| Include venue audit trails in a customer DSAR package | No one |
| Include Business audit material in Owner/Admin venue or portfolio export | Owner/Admin export under the plan quotas and data retention subject |
