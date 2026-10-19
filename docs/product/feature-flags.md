# Feature flags

> **About this document.** This is the **target-state source of truth** for feature flags in Project Imperium — the named catalogue, default-on behaviour, product outcomes when a flag is off, and composition with plan entitlements. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes feature flags as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **named platform feature flags** and what they mean for product availability. It covers:

- the **closed stage-1 catalogue** of named flags and their default state;
- **scopes** — platform-wide and per paying **Owner**;
- **effective flag** resolution when both scopes are set;
- **kill-switch** semantics — flags only narrow availability; they never unlock beyond the Owner's plan;
- **composition** with plan entitlements, base access layer, and per-user capabilities;
- **product outcomes** when a flag is off (including mid-session flips and the Core POS spine); and
- **who may read or edit** flags in the Superadmin console, and that edits are audited.

It deliberately does **not** cover:

- the **Superadmin console surface**, enrollment, console roles, or how operators navigate flag controls — the superadmin subject owns those. This subject owns the catalogue meaning and off outcomes those controls apply;
- the **plan catalogue, entitlement matrix, prices, and commission** — the monetization subject owns what each plan unlocks commercially. This subject only states that a flag never expands that matrix;
- **layer defaults and per-user capability grants** — the access-and-permissions subject owns those; this subject places the **feature-flag gate** before the plan entitlement gate in the shared composition order;
- **portfolio freeze, venue freeze, and Superadmin suspend** — monetization, platform-billing, and superadmin own those. This subject only states they are **orthogonal** to flags;
- **beta / grant flags**, per-venue or per-user flags, Owner self-serve flag UI, channel-specific flags, and automatic Owner notification on toggle — out of stage 1;
- **visual design and exact UI copy** — out of scope for the product set.

---

## 2. Domain model and vocabulary

### Entities

- **Feature flag** — a named platform capability switch from the closed catalogue. It is either **on** or **off** at a given scope. Stage-1 flags are **kill-switches**: they may hide or disable a capability that would otherwise be available; they never unlock a capability the Owner's plan does not entitle.
- **Feature-flag catalogue** — the closed list of named flags this subject owns. New flags are added only when a later product commitment introduces them and this catalogue is amended.

### Terms this subject introduces

- **Platform-wide flag** — the catalogue switch that applies to every Owner on the platform when set.
- **Per-Owner flag** — the catalogue switch that applies to one paying Owner's whole portfolio (every Business under that Owner).
- **Effective flag** — the on/off result for one Owner and one named flag after resolving platform-wide and per-Owner state (§3.2).
- **Feature-flag gate** — whether the effective flag for that capability is **on**. Evaluated **before** the plan entitlement gate.

Terms reused rather than redefined here: **Owner**, **Business**, **User**, **Superadmin**, **plan**, **entitlement matrix**, **portfolio freeze**, **venue freeze**, **base access layer**, **per-user capability**, **selling channel**, and **console operator**.

---

## 3. Capabilities

### 3.1 Kill-switches only

- Every stage-1 feature flag is a **kill-switch**. Turning a flag **on** never grants a capability the Owner's plan does not unlock.
- Intentional unlocks beyond a plan remain **plan change** or Superadmin **force-assign** (monetization and superadmin subjects) — not flags.
- **Selling channels** (dine-in POS, self-ordering, kiosk, delivery) are **not** individually flag-gated. Channel availability still follows order-flow, business enablement, and the Core POS spine rule in §3.6.

### 3.2 Scopes and effective flag

- Each catalogue flag may be set **platform-wide** and/or **per Owner**. There is **no** per-venue, per-Company, or per-user flag scope in stage 1.
- **Unset means on.** Fresh catalogue rows and scopes with no deliberate off are **on**.
- **Effective flag** for an Owner and named flag:
  1. If the platform-wide state is **off**, the effective flag is **off** (platform-wide off beats any per-Owner on).
  2. Else if that Owner's per-Owner state is **off**, the effective flag is **off**.
  3. Else the effective flag is **on**.
- Venue differences in availability come from plan, freeze/suspend, membership access, or business configuration — not from finer flag scopes.

### 3.3 Composition with plan, layer, and capability

For any gated power, Project Imperium evaluates in this order:

1. **Feature-flag gate** — if the effective flag for that capability is **off**, the power is unavailable (plan, layer, and capability grants do nothing for it).
2. **Plan entitlement** — if the Owner's plan does not unlock the feature, the power is unavailable.
3. **Effective layer defaults** — what the layer includes out of the box (access-and-permissions).
4. **Active capability grants/revokes** — for the active job role (access-and-permissions).

**Portfolio freeze**, **venue freeze**, and Superadmin **suspend** are **orthogonal**: any of them can block normal operation even when the effective flag is on and the plan entitles the feature. Clearing a freeze or resume does **not** turn a flag on; turning a flag on does **not** clear a freeze or suspend.

### 3.4 Stage-1 catalogue (defaults on)

Every flag below defaults **on**. Off means the capability is fully unavailable per §3.5–§3.6.

| Flag | Gates |
| --- | --- |
| **Core POS and menu** | Staff POS and menu ops spine; when off, also blocks self-channel ordering and checkout that depend on that spine (§3.6) |
| **Printers and screens** | Logical printers, print connectors, prep/delivery/pickup control screens |
| **Floor plans** | Floor-plan editor and Service floor maps that depend on floor-plan layout |
| **Promotions** | Promotion configuration and promotional discount application |
| **Ratings and comments** | Review invites, public ratings, business replies, abuse-removal requests from the venue |
| **Gift cards** | Issue, redeem, void, and Gift card tender flows |
| **Reservations and Host** | Reservations and Host seating surfaces |
| **Suppliers, purchases, and inventory** | Suppliers, supplier goods, purchases, and inventory |
| **Employees, schedules, and time control** | Employees, schedules, and time-control / attendance |
| **Payroll export** | Payroll preparation and accountant export |
| **Daily sales reports** | Daily sales report surfaces |
| **Weekly business reports** | Weekly business report surfaces |
| **Full monthly P&L and advanced metrics** | Monthly P&L and advanced business-metrics depth |

No stage-1 flags exist for: individual selling channels, Stripe Connect or payment-provider choice, Superadmin console access, creation quotas, retention constants, or platform billing collection.

### 3.5 Outcome when a flag is off

- The gated capability is **fully unavailable**: Manage and Service destinations for it are omitted, and mutating actions for it are rejected. There is **no** write path and **no** soft-degrade “visible but read-only Manage” for that capability while the flag is off.
- **Existing data is not purged** by a flag flip. Historical records remain stored under the owning feature subjects' retention rules. While the flag is off, staff do **not** enter that capability's Manage or Service surfaces; when the flag returns to on, normal read/write rules of those subjects apply again.
- **Monetization is unchanged** by a flag flip: subscription price, commission, entitlements, and billing continue as the monetization and platform-billing subjects define. A flag-off is not a downgrade and not a refund event.
- **Customers and ordinary staff** see a **silent omit** — no nav entry and no explain-why for the gated capability.
- **Admin / Owner** (and a Superadmin impersonation session into that venue) may see a short **platform unavailable** notice on Manage home or the subscription area when a capability is plan-entitled but effective-flag off — enough for support clarity. Flag **names** are not exposed to the venue, and there is **no** self-serve “request enable”.
- Stage 1 sends **no automatic** email or in-app Owner notification when Superadmin toggles a flag.

### 3.6 Mid-session flip and Core POS spine

- When Superadmin turns a flag **off** while someone is inside that capability, Project Imperium applies a **hard stop on the next mutating action** (aligned with realtime-and-concurrency blocked/stale behaviour): screens for the gated capability become non-actionable; **no new** entry into that capability is allowed.
- A mutation that **already started** as a single attempt under orders, payments, or another owning subject may **finish** under that subject's rules; the flag flip does not invent a second completion path.
- **Core POS and menu** off does **not** auto-void open bills or in-flight batches. It blocks **new** order lines, **new** sales-instance opens that depend on the spine, and **new** self-channel baskets/checkout that depend on the live menu/POS spine.
- Public discovery may still list the venue while Core POS and menu is off; **ordering and checkout are unavailable** on staff POS and on self-channels until the effective flag is on again.

### 3.7 Console read, edit, and audit

- **Any console operator** may **read** platform-wide and per-Owner flag state in the Superadmin console.
- **Console Manager** and **console Owner** may **edit** flags (platform-wide or per-Owner). Console Staff cannot edit. Venue Users never manage feature flags.
- Every flag edit is **audited**: who, when, which flag, which scope, and old → new state.

---

## 4. Roles and entitlements

Venue **base access layers** do not grant flag administration. Flag read/edit lives in the Superadmin realm.

### Base access layers (venue)

| Layer | Powers on this subject |
| --- | --- |
| **Customer** | None — flags are invisible; gated surfaces are omitted. |
| **Employee** | None for flag administration. Experiences silent omit when a flag is off. |
| **Supervisor** | Same as employee for this subject. |
| **Manager** | Same as employee for flag administration. Cannot toggle flags. |
| **Admin / Owner** | Cannot toggle flags. May see the short **platform unavailable** notice when a plan-entitled capability is effective-flag off. |

### Superadmin console

| Activity | Who |
| --- | --- |
| Read flag state (platform-wide or per-Owner) | Any console operator |
| Edit feature flags | Console Manager or console Owner |
| Grant a plan-gated capability via flag alone | No one — flags never expand the entitlement matrix |

### Who can do what

| Activity | Who |
| --- | --- |
| Turn a catalogue flag on or off | Superadmin console Manager or console Owner |
| See why a Manage capability is missing (platform unavailable) | Admin/Owner at the venue; Superadmin impersonation into that venue |
| Override plan entitlements with a flag | No one |
| Set a per-venue feature flag | No one in stage 1 |
| Receive automatic notice that a flag changed | No one in stage 1 (no automatic Owner notify) |
