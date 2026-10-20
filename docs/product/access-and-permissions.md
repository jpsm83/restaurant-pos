# Access and permissions

> **About this document.** This is the **target-state source of truth** for access and permissions in Project Imperium — base access layers, effective-layer resolution, the per-user capability mechanism and catalogue, and the assignment rules managers use on a membership. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes access and permissions as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **who may do what inside a venue**, as a fixed platform model — not a venue-authored security system:

- the **five base access layers** — **admin**, **manager**, **supervisor**, **employee**, and **customer** — and what each means at the highest level;
- **effective layer** resolution from job roles, working shifts, and optional layer override;
- the **job-role → default layer** map;
- **per-user capabilities** — named grant or revoke overrides from a fixed platform catalogue, each bound to a job role on the membership;
- the **assignment surface** on the membership (Manage → People): job roles, layer override, and capability checklist;
- **who may assign** access to whom (each layer sets only layers below it; only the owning user creates or demotes admin);
- how access composes with **feature flags**, **plan entitlements** (Owner subscription), and **mode eligibility** consequences.

It deliberately does **not** cover:

- the global **User**, credentials, sessions, ownership transfer, favorites, or account lifecycle — the users subject owns those. This subject supplies the layer and capability rules mode eligibility and chrome consume.
- **staff multi-session**, **personal-device-only** Business work, and the exclusion of shared staff devices, PIN, quick-switch, and in-app lock identity — the staff-sessions subject. Layers and capabilities always apply to the **signed-in User** on that person's own session; there is no device-shared actor.
- the **Employee** membership record itself — hire, HR, pay, vacation, termination, rehire, and storing job roles on the membership — the employees subject owns that. This subject reads those roles and owns how they map to layers and capabilities.
- **navigation chrome** — Customer | Business toggle, Service / Manage / Me, guards, and destinations — the user-navigation subject owns those surfaces; this subject states which effective layer and capabilities make them available.
- the **daily schedule** and which job role a working shift carries — the schedules subject owns that; this subject consumes the shift role for effective layer and active capabilities.
- **attendance** (on duty, late lock, QR) — the time-control subject owns those.
- **feature behaviour** inside each gated power (voiding an order, closing a report, editing stock) — each feature subject owns behaviour and restates who may act; this subject owns the shared layer/capability vocabulary and the authoritative capability catalogue index.
- **plan catalogue prices and which ops features a plan unlocks** — the monetization subject owns entitlements; this subject only states that plan gates run after feature flags and before layer and capability.
- the **feature-flag catalogue, kill-switch outcomes, and effective-flag resolution** — the feature-flags subject owns those; this subject only places the feature-flag gate first in the composition order.
- the **Superadmin** console's own roles — the superadmin subject owns that separate realm.

Project Imperium does **not** offer custom roles, free-form permission matrices, or per-screen visualization configuration. Configuration is only: assign canonical job roles, optionally override base layer within the rules below, and grant or revoke named capabilities from the platform catalogue.

---

## 2. Domain model and vocabulary

### Entities

This subject introduces **no new persistent tenant entity**. Access facts live on the **Employee** membership (job roles, optional layer override, capability grants) that the employees subject stores. This subject owns the meaning of those facts.

### Terms this subject introduces

- **Base access layer** — exactly one of **admin**, **manager**, **supervisor**, **employee**, or **customer**. The highest-level classification of what a person may do. *Customer* is always present on every User; the other four come from a venue membership (and, during a shift, from that shift's job role).
- **Effective layer** — the base access layer that applies **right now** at a venue: from the working shift's job role while on a working shift; otherwise from the membership (highest among role defaults, unless an explicit layer override is set).
- **Layer override** — an optional, deliberate base-layer value stored on the membership that wins over the job-role default map until cleared.
- **Per-user capability** — a named power from the **platform capability catalogue**, granted or revoked on a membership and **bound to one of that membership's job roles**. Capabilities never invent powers outside the catalogue.
- **Capability grant** — a (capability, job role) binding on one membership: grant or revoke that capability when that job role is the active role for resolution.
- **Platform capability catalogue** — the closed list of named capabilities this subject indexes. Feature subjects own how each power behaves; new capabilities are added to this catalogue when a feature subject introduces them.
- **Plan entitlement gate** — whether the Owner's subscription plan unlocks a feature for the venue at all. Evaluated **after** the feature-flag gate (feature-flags subject) and **before** layer defaults and capabilities.

Terms reused rather than redefined here: **User**, **Owner**, **Business**, **Employee** (membership), **job role**, **working shift**, **entry window**, **mode** (Customer | Business), **Service**, **Manage**, **Me**, **Suspended**, **Terminated**, soft delete, and **feature-flag gate**.

---

## 3. Capabilities

### 3.1 Fixed model, not venue-authored RBAC

Access is a **platform vocabulary** every venue shares:

1. **Base access layers** (control) — what the person may do at the highest level.
2. **Job roles** (description) — what the person is at the venue; stored on the membership; feed default layer and shift work.
3. **Per-user capabilities** — named grant or revoke overrides on top of layer defaults, from the fixed catalogue only.

Venues do **not** create custom roles, invent permission flags, or configure arbitrary screen visibility matrices.

### 3.2 The five base access layers

Ordered for business memberships **admin > manager > supervisor > employee**. **Customer** sits outside membership.

| Layer | Meaning |
| --- | --- |
| **Customer** | Every User. Public Customer surface; never a membership layer. |
| **Employee** | Floor and self-service staff. **Schedule-gated** Business entry. Default Service is **POS** (plus **Me**); other Service destinations and elevated ops need catalogue grants (or a job-role entitlement such as Host). **No Manage.** |
| **Supervisor** | Floor lead. **Schedule-gated** Business entry (same entry window as employee). **No Manage.** **Full Service** by default (POS, Host, prep screens, delivery screen, customer pickup board, Attendance for **own** scan-in) and **print permission**. Does **not** present the venue daily attendance QR (manager+ only — time-control subject). Selected elevated defaults (for example inventory count re-edit). Further powers only via catalogue grant/revoke. |
| **Manager** | Day-to-day administration and operations. **Always** may enter Business (not schedule-gated). **Manage** header and full Service by default. Assigns access for layers below manager. |
| **Admin** | Full venue control, including ownership-adjacent acts the feature subjects reserve for admin/owner. **Always** may enter Business. **Manage** and full Service. The owning user is admin at every venue they own. |

**Manage** visibility follows **effective layer** only: **manager** or **admin**. Supervisor and employee never see Manage, regardless of capabilities. Revoking capabilities on a manager or admin never hides the Manage header; it only removes the specific catalogue powers revoked.

### 3.3 Job-role → default layer map

This subject owns the default map. The employees subject stores which roles sit on the membership; the schedules subject selects which role a working shift uses.

| Job roles | Default base layer |
| --- | --- |
| Owner, Admin | **admin** |
| General Manager, Manager, Assistant Manager, MoD | **manager** |
| Supervisor | **supervisor** |
| Every other canonical job role (Operator, Employee, Cashier, Floor Staff, Bartender, Barista, Waiter, Head Chef, Sous Chef, Line Cooks, Kitchen Porter, Cleaner, Security, Host, Runner, Entertainer, Other, …) | **employee** |

A membership may hold several job roles. Changing job roles **recomputes** the default layer from this map. An explicit **layer override**, if set, wins until cleared.

### 3.4 Effective layer resolution

1. **On a working shift:** the schedule's job role for that shift maps through §3.3 (then override if set on the membership) to the **effective layer** for the shift's duration — chrome and powers follow that layer (for example a manager-membership person on a Waiter shift is effective **employee**: no Manage until the shift ends).
2. **Not on a working shift:** effective layer is the **highest** among the membership's job-role defaults (admin over manager over supervisor over employee), unless a **layer override** is set — then the override is the effective layer.
3. **No membership** → **customer** only.
4. **Suspended** or **Terminated** membership blocks Business access for that venue; layer resolution alone does not reopen it (employees subject).

### 3.5 Mode eligibility (consequence)

Exactly two modes exist — Customer and Business — owned as surfaces by the user-navigation subject. This subject states the eligibility rule those surfaces enforce:

- **Customer** mode is always available to every signed-in user.
- **Manager** and **admin** effective eligibility for Business: may enter Business **without** a planned shift or entry window (unless Suspended or Terminated).
- **Supervisor** and **employee**: Business only when a **planned working shift** has an open **entry window** (from 10 minutes before planned start until 2 hours after planned start), or an open shift session already exists — same schedule gate; supervisors are **not** excused from the schedule.
- Opening Business is **not** on duty (time-control subject).

### 3.6 Feature flags, then plan entitlements

Composition order for any gated power:

1. **Feature-flag gate** — if the effective feature flag for that capability is off, the power is unavailable (plan, layer, and capability grants do nothing for that feature). Catalogue, scopes, and off outcomes belong to the feature-flags subject.
2. **Plan entitlement** — if the Owner's plan does not unlock the feature, the power is unavailable (capability grants do nothing for that feature).
3. **Effective layer defaults** — what the layer includes out of the box.
4. **Active capability grants/revokes** — for the active job role (§3.7).

### 3.7 Per-user capabilities (mechanism)

- Capabilities are **grant or revoke** relative to the layer's defaults for powers that appear in the catalogue.
- Each grant on a membership is bound to **one of that membership's job roles**.
- **On a working shift:** only grants bound to **that shift's job role** are active.
- **Off-shift:** only grants bound to job roles whose default layer (or override outcome) matches the **effective layer** are active — so a Line Cook–bound prep-screen grant is inactive while the person is off-shift at manager effective layer.
- Capabilities **never** invent powers outside the catalogue.
- Capabilities **never** open **Manage** for supervisor or employee effective layer.
- Capabilities **never** create ownership, transfer a business, or bypass acts reserved for the owning user / admin-only rules in feature subjects (for example rehire).

### 3.8 Platform capability catalogue (v1 index)

This subject owns the authoritative list. Feature subjects own behaviour for each power and may introduce a new named capability later; when they do, the capability is added here.

**Service / floor** (typically bound to an employee-layer job role; supervisor/manager/admin layers include the full Service set by default without needing these grants):

| Capability | Effect |
| --- | --- |
| Open prep screens | May open prep-area control screens under Service |
| Open delivery screen | May open the delivery screen under Service |
| Open customer pickup board | May open the customer pickup board under Service |
| Open Attendance | May open Attendance under Service to **scan in / attempt duty**. Presenting the venue's daily attendance QR for others remains manager-layer only (time-control subject) |
| Print permission | May issue or reprint customer and prep tickets (supervisor layer and above have this by default; employees need the grant) |

**Ops grants** (often bound to employee or used to extend supervisor; manager/admin have view/86 by layer default where feature subjects say so):

| Capability | Effect |
| --- | --- |
| Mark / clear manual unavailability | May 86 a business good and clear the mark (subject to component rules in the business-goods subject) |
| View inventory | May view stock, counts, variance, waste, and value |
| View daily sales report | May view and export the daily sales report |
| View weekly and monthly business reports | May view and export those reports (cost entry and closures stay manager+) |

**Job-role and layer defaults (not separate catalogue flags):**

- **Host** under Service — **Host** job role, and anyone whose effective layer already includes full Service (supervisor, manager, admin).
- **Inventory count re-edit** (with reason and audit) — **supervisor** layer and above (manager, admin), migrating the former “Supervisor job role only” special case into the supervisor **layer** default.

### 3.9 Assignment surface

Managers and above configure access **on the membership** under **Manage → People** (the employee record):

- canonical **job roles**;
- optional **layer override**;
- **capability checklist** (grant or revoke), each row bound to one of that person's job roles.

There is no separate venue-wide roles matrix and no custom-role builder.

### 3.10 Who may assign what

**Each layer sets only layers below it — never its own peer:**

| Actor | May set layer override to | May edit access on |
| --- | --- | --- |
| **Manager** | supervisor, employee | Memberships whose target layer after the change is below manager; may demote a manager-layer person to supervisor or employee; may not promote anyone to manager or admin |
| **Admin** (non-owner) | manager, supervisor, employee | Memberships below admin; may not set or clear **admin** on anyone |
| **Owning user** (admin at owned venues) | admin, manager, supervisor, employee | Everyone at that venue, including creating or demoting **admin** |

Additional rules:

- **Supervisors** and **employees** do not assign job roles, layer overrides, or capabilities.
- Promoting someone to **manager** requires an **admin** (or owner).
- Creating or demoting **admin** requires the **owning user**.
- Job-role assignment follows the same actor rules as layer/capability edits on that membership.
- Ownership of the business is never granted by layer or capability; transfer and close remain owning-user acts (users subject).

### 3.11 Manager-in-charge on the plan

Any day schedule that includes at least one working shift must include at least one working shift whose job role resolves to **manager** or **admin**. **Supervisor** does **not** satisfy manager-in-charge. The schedules subject enforces the rule; this subject defines which layers count.

### 3.12 Self-view

An ordinary employee or supervisor may see their own job roles and that they hold elevated Service or catalogue grants as they appear in the product (destinations they can open). They do not administer peers' access. Managers and above see and edit access on memberships they are allowed to configure (§3.10).

---

## 4. Roles and entitlements

### Base access layers

| Layer | Powers on this subject |
| --- | --- |
| **Customer** | No venue access configuration. |
| **Employee** | Uses Business under schedule gate; POS and Me by default; catalogue grants only when bound and active. |
| **Supervisor** | Schedule-gated; full Service defaults; no Manage; selected elevated defaults; catalogue grant/revoke on top; does not assign access. |
| **Manager** | Always Business; Manage + full Service; assigns job roles, overrides, and capabilities for layers below manager. |
| **Admin** | Everything a manager can do on access, plus configure managers; full venue control. Only the **owning user** creates or demotes admin. |

### Job roles

Stored on the membership (employees subject). Default layer from §3.3. Shift role selects effective layer and active capability set.

### Per-user capabilities

The catalogue in §3.8. Assignment in §3.9–§3.10. Active set in §3.7.

### Who can do what

| Activity | Who |
| --- | --- |
| Assign job roles on a membership | Managers and above, within §3.10 |
| Set or clear layer override | Managers and above, within §3.10 bounds |
| Grant or revoke a catalogue capability (bound to a job role) | Managers and above, within §3.10 |
| Create or demote admin layer | Owning user only |
| Promote to manager layer | Admin or owning user |
| See Manage header | Effective manager or admin only |
| Enter Business without schedule / entry window | Effective manager or admin only |
| Enter Business under entry window / open session | Effective supervisor or employee (and manager/admin anytime) |
| Satisfy manager-in-charge on a day plan | Working shift resolving to manager or admin — not supervisor |
| Invent custom roles or permission flags | No one |
