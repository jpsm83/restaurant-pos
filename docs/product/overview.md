# POS — Product Overview

> **About this document.** This is the **target-state source of truth** for what POS is. It is written for two readers: AI agents that build the product, and engineers onboarding onto it. It describes the product as it is *meant to be*, not as a status report — capabilities are stated as commitments, without built/planned tags. Read this first, then see [Where to go next](#14-where-to-go-next). Product and domain vocabulary is defined here as it is introduced; engineering vocabulary (DTO, server-owned field, problem details, …) lives in the root `GLOSSARY.md`.

---

## 1. What POS is

POS is a **complete, real-time, cloud SaaS platform** for **bars and restaurants**. It covers the whole operation — service, menu, supply, stock, people, and reporting — and extends outward to the venue's **customers** through self-ordering, takeaway, delivery, booking, ratings, loyalty, and gift cards.

It is built on four positioning pillars:

- **100% SaaS.** Nothing to install on a server. The product runs in the browser; there is no on-premise deployment.
- **Hardware-agnostic.** The customer brings their own hardware — desktop, laptop, tablet, phone, printer, or screen. POS sells no hardware and locks the venue into none; it works with whatever the venue already owns.
- **Online-only.** The product requires connectivity; there is no offline mode.
- **Multi-tenant.** A **Business** is the tenant and represents **one venue** (one physical restaurant or bar). The same platform serves many businesses with fully isolated data, and businesses can be grouped under an **Owner** across multiple venues.

POS is delivered as **three product surfaces over one shared platform**: the **Business** app (operations, where venues and owners work), the **Customer** app (the public, free side), and the **Superadmin** console (which runs the application business itself). See [§5](#5-access-roles-and-the-mode-chooser) and [§3](#3-tenant-identity-and-account-model).

### Positioning at a glance

| Dimension | POS |
| --- | --- |
| Delivery | Cloud SaaS, browser-based |
| OS / device | Any — PC, laptop, tablet, phone, network printer, screen |
| Connectivity | Online-only (no offline mode) |
| Tenancy | Multi-tenant; one `Business` = one venue; venues grouped under an `Owner` |
| Paid by | Businesses (subscription + commission); **customers are free** |
| Surfaces | Business · Customer · Superadmin |

### Core vocabulary

These terms are used with exactly these meanings throughout POS. Do not drift to synonyms.

| Term | Meaning |
| --- | --- |
| **Owner** | The account that owns one or more **Businesses**. Created automatically when a user registers a business; holds the subscription and commission terms for its venues. |
| **Business** | The **tenant** — one venue (restaurant/bar). All operational data is scoped by `businessId`. |
| **User** | A person's global identity. **Every user is a customer**; some also hold business roles. |
| **Employee** | A person's membership in a Business, carrying their **job role(s)**, pay, and employment status. Links a `User` to a `Business`. |
| **Customer** | A user acting as the final consumer (ordering, booking, rating, loyalty). |
| **Sales point** | A place a customer sits or is served — table, room, bar seat, counter, spot, or the virtual **delivery** point. Holds the venue's QR code. |
| **Sales instance** | An open session/tab at a sales point that groups the orders for that sitting. |
| **Order** | One billable line: one main business good plus optional add-ons. Quantity is expressed as multiple orders. |
| **Business good** | A sellable menu item (simple, recipe/ingredient-based, or a set menu / combo). |
| **Supplier good** | A raw/purchased item from a supplier; the ingredient behind recipes and the unit of stock. |
| **Supplier** | A vendor the business buys from. |
| **Purchase** | A record of goods received from a supplier; feeds inventory. |
| **Inventory** | The monthly stock ledger per business, combining a dynamic system count with physical counts. |
| **Promotion** | A time/day-scoped price rule applied to selected business goods. |
| **Reservation** | A free table booking made by a customer or staff; hands off into live service. |
| **Rating / Comment / Favorite** | Venue-level customer feedback and saved venues. |
| **Loyalty** | A per-customer, per-venue membership tracking spend and rewards. |
| **Gift card** | A bearer value token owned by a business, identified by a QR code, with an expiry date. |
| **Shift session** | The actual, recorded attendance for one employee on one shift (sign-in/out, breaks). |
| **Daily / Weekly / Monthly report** | The aggregated sales and performance reports at each roll-up level. |
| **Soft delete** | POS never hard-deletes domain documents: a server-owned deleted marker plus a timestamp are set, the document is retained and reactivatable, and uniqueness is enforced among active documents. Every model follows it. |

---

## 2. Who it is for

POS serves five personas. Each maps to one of the four **base access layers** ([§5](#5-access-roles-and-the-mode-chooser)).

- **Owner** — owns one or more venues. Registers the business, holds the subscription, and moves between venues through the owner shell. Also acts as an admin inside each venue.
- **Admin** — has **full control of the venue**: configuration, people, permissions, and every operation.
- **Manager** — runs day-to-day operations: schedules, purchasing, inventory, promotions, and report calculation/closure. Managers and above assign job roles and capabilities.
- **Employee** — delivers service (waiter, bartender, chef, cashier, host, …). Access to the business app is gated by the **schedule**.
- **Customer** — the final consumer. **Every user is a customer**, even one who registered a business. Uses the Customer app to discover venues, order, book, rate, and collect rewards.
- **Superadmin** — the platform operator. Runs the **application business**: accounts, plans, and platform analytics. Never operates a venue's day-to-day service.

---

## 3. Tenant, identity, and account model

POS's tenancy tree is:

```
Superadmin  (platform operator — the application business)
   └── Owner              (the paying account; one per person/company)
          └── Business    (one venue; the tenant)
                 └── all operational data scoped by businessId
```

- **User → Employee → Business.** A `User` is a single global identity. An `Employee` record links that user to a business and carries job role(s), pay, and status. An owner across several venues is one user with an employee membership per venue.
- **User → Owner → Business.** When a user registers a business, POS **automatically creates (or updates) an `Owner` model** for them, taking the **Owner job role by default**. The Owner holds the **array of businesses** it controls, the **subscription**, the **commission terms**, and other portfolio data.
- **One Business = one venue.** A multi-venue operator does not share one business record; each venue is its own `Business`, grouped under one `Owner`.
- **Everyone is a customer.** Creating a user — including registering a business — also grants the customer identity. There is no "business-only" user.
- **Tenant root.** Almost every domain collection carries a required, indexed `businessId`; this is the isolation boundary. The `User` is the exception — it is global and joins a tenant only through `Employee`.

Owner-level resources (subscription, commission, portfolio navigation, and the inventory-transfer network) scope to the **Owner**; everything operational scopes to the **Business**.

---

## 4. Service surfaces

POS defines four canonical ways a venue can serve, plus a cross-cutting booking layer. ("Different ways to work and serve" = this set.)

1. **Dine-in — staff POS.** A waiter, bartender, or host opens a sales point (select it in the POS, or scan its QR) to open a **sales instance**, takes orders, and later bills and closes the table. This is the classic served-on-premises flow.
2. **QR self-ordering — on premises.** A customer at a sales point scans its QR code to self-order from the menu. The order is **delivered to that QR point** (the table/seat). Self-ordering is only enabled where the venue has turned it on for that sales point, and is unavailable while a staff member holds the table.
3. **Kiosk.** A **variant of the on-premises QR order** — a self-service terminal running the same web app. The difference is fulfilment: a kiosk order is **not delivered** anywhere; it is **picked up at the counter**.
4. **Takeaway / Delivery — customer-initiated.** A customer orders from the venue to be **delivered to an address** or **picked up on premises**. Delivery is **per-venue** (each venue serves within its own radius and windows) and dispatched through **third-party courier tools**.
5. **Reservations** — the cross-cutting **booking layer** that hands off into service. Reservations are **free**: no charge is applied. See [§7](#7-the-business-platform).

Kiosk and QR ordering are not separate products — they are routes within the **Customer** app. Delivery is a configuration of the same platform (`acceptsDelivery`, delivery radius, minimum order, delivery windows, and a dedicated virtual delivery sales point).

---

## 5. Access, roles, and the mode chooser

Access control is **two-layer**:

- **Base access layers (control).** Exactly four layers define what a user may do at the highest level: **admin**, **manager**, **employee**, and **customer**. Admin has full venue control; manager runs operations; employee serves (schedule-gated); customer consumes.
- **Job roles (description).** A user's job is described by `userRolesEnum` (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Operator, Employee, Cashier, Floor Staff, Bartender, Barista, Waiter, Head Chef, Sous Chef, Line Cooks, Kitchen Porter, Cleaner, Security, Host, Runner, Supervisor, Entertainer, Other, …). The job role tells you *what the person is*; the base layer tells you *what they may do*.
- **Permission assignment UI.** **Managers and above** use a UI to assign job roles and **per-user capabilities** — granting or revoking individual powers on top of the base layer's defaults.

**The mode chooser.** Because every user is a customer *and* may hold business roles, login routes by role:

- A user with **only** customer access goes straight to the Customer app.
- A user with **business access** sees a **chooser**: continue as **Customer** or continue into the **Business** app. Owner/manager/admin access is a form of business mode; the owner shell then handles multi-venue switching.
- Customer access is **always** available to every user.

**Schedule gating.** The **schedule is the plan**; signing in as an employee is what puts a person **on duty**.

- Employees (any job role) **must appear on the schedule**; the schedule is also how time control works.
- A non-management employee **cannot access the business app unless they are scheduled for that time**. The employee option opens from **10 minutes before shift start**; if the user is **not scheduled**, they are taken straight to the Customer app (no chooser).
- If an employee is **late**, employee access is **blocked**; a **manager unlocks the button** on the schedule record so the employee can enter — but the **real entry time is preserved** regardless, so time control stays honest.
- **Managers, admins, and owners are never blocked.** They may access the business app and execute any task without being scheduled, though they must still appear on the schedule **for time control**.

See [§6](#6-time-control-and-attendance) for the attendance model.

---

## 6. Time control and attendance

Time control is a **plan-vs-actual** system, separate from the schedule:

- **Schedule (the plan).** Each business defines, per calendar day, one schedule containing each employee's shift: job role, planned start/end, and vacation flags. Schedule aggregates (staff count, vacation count, planned labour cost) feed reporting. The schedule does **not** imply on-duty.
- **Shift session (the actual).** For each employee and shift, POS records a **shift session**: planned start/end, **actual sign-in / sign-out**, breaks, resulting **worked hours** and **labour cost**, and status (`Scheduled`, `SignedIn`, `Completed`, `Absent`, `Locked`). One open session per employee at a time prevents double sign-in.
- **Time-clock ledger.** Every punch — sign-in, sign-out, and **break start/end** — is stored as an immutable event; the shift session is a projection of it. This preserves the **real entry time** even when a manager unlocks a late entry.
- **On duty.** A person is **on duty** while they hold an open shift session. On-duty state drives operational attribution (sales, tips) and gatekeeping.
- **Breaks.** An employee can **pause and resume** duty during a shift (lunch, rest, or other break). Paused time is excluded from worked hours but the employee remains signed in.
- **Overtime alert.** If an employee **other than an admin/owner** is still on duty after their scheduled end, the **admin on duty** is notified **every 5 minutes** until that employee signs off. (This reuses the platform's cooldown/idempotency notification behavior.)

All times are stored in UTC and interpreted in the **business timezone**. Actual worked hours and labour cost feed the monthly business report.

---

## 7. The Business platform

The Business app is the operational heart of POS. It comprises the **owner shell** (a venue switcher with tabs across an owner's businesses) and the per-venue workspaces below.

### Onboarding and configuration

- **Registering a business** is an action by an **already-registered user**; it creates the tenant, initialises the user's `Owner` account (on their first venue), and creates the owner's employee membership. The business can be **saved as an incomplete draft** and edited over time; it collects profile (trade/legal name, logo, contact, phone, tax number), **currency** (one per business, chosen at onboarding), and address; the **timezone** is derived from the address.
- **Go-live.** A business is **not live** until its **go-live checklist is complete** and its **contact email is verified**; an admin/owner then flips the **go-live toggle**. **Not live** means **absent from customer discovery** and **unable to take customer orders or bookings**, though the venue remains fully usable internally. A live business can also be taken **offline**, which is distinct from **closing** it.
- **Profile and discovery.** Public fields — cuisine type, categories, contact, and cached `averageRating` / `ratingCount` — power customer discovery.
- **Opening hours** per weekday.
- **Delivery settings**: enable/disable, **delivery radius**, **minimum order**, and **per-day delivery windows**.
- **Tax**: a single **business-level tax configuration** (rate plus price-inclusive/exclusive handling) applied to orders and bills. Multi-component or per-item taxation is out of scope for now.
- **Metrics and targets**: target cost percentages (food, beverage, labour, fixed), **supplier-good waste thresholds** by budget impact, and the **start day of the reporting week**.
- **Subscription**: the plan is held on the **Owner** and covers its venues (see [§11](#11-monetization)).
- **Credentials**: sign-in email verification, email change, and password reset.

### People, roles, and scheduling

- **Employees** are linked to existing users; each carries job role(s), `active` status, join date, contract hours, vacation allowance/balance, salary (frequency + gross/net), documents, and optional termination date.
- **Roles and permissions** follow the two-layer model in [§5](#5-access-roles-and-the-mode-chooser): base layers, job roles, and per-user capability assignment by managers and above.
- **Schedules** define each day's shifts (employee, role, start/end, vacation). POS enforces no overlapping shifts and correct vacation accounting, and rolls up daily staff, vacation, and labour-cost totals.
- **Time control** records actual attendance, breaks, and overtime as described in [§6](#6-time-control-and-attendance).

### Menu — business goods

- Business goods are what the venue **sells**: **simple items**, **recipe/ingredient-based items**, and **set menus / combos**.
- Configuration includes name, keyword, main/sub category, `onMenu` and `available` flags, selling price, images, description, allergens, delivery time, and optional add-ons.
- For recipe and combo items, POS derives **cost price** from ingredients, derives **allergens**, and suggests a **selling price** from a desired gross margin.

### Supply and purchasing

- **Suppliers** are the vendors a business buys from (profile, address, contacts, tax number, in-use flag).
- **Supplier goods** are the purchasable items and the unit of stock: category, measurement unit, purchase unit and purchase math (quantity ↔ total price → price per measurement unit), **budget impact**, allergens, **par level** and **minimum required**, inventory schedule, images, and in-use flag.
- **Purchases** record what was received: supplier, date, purchasing employee, lines (supplier good, quantity, price), receipt identification, and optional documents. Inventory is incremented per line. **One-time purchases** record ad-hoc expenses without supplier-good tracking. Line edits require a **reason** and are **audited** (who, when, before/after values).

### Inventory and transfers

- **Inventory** is monthly per business: a **dynamic system count** per supplier good (incremented by purchases, decremented by orders, restored on cancellation) and **physical counts** performed by staff with **deviation** tracking.
- Count **re-edits** require manager/supervisor authority and a **reason**, with an audit trail.
- POS surfaces **low-stock alerts** (below par/minimum, notified to managers on duty) and a **variance report** comparing theoretical usage (from recipes) against actual usage (opening + purchases − closing).
- A manager **closes** the month, which locks it and **automatically rolls the next period forward**.
- **Inventory transfers** move supplier goods between **venues of the same Owner only**, valued **at cost**, adjusting **both venues' inventories** and leaving a full **audit trail** (who, when, quantity, value). Manager-and-above authorization is required.

### Service — sales points, sessions, orders, billing

- **Sales points** represent where guests sit or are served (table, room, bar, seat, counter, spot, delivery, other). Each carries the venue's **QR code**, a **self-ordering** flag, and printer routing.
- **Opening** a sales point (from the POS or by scanning its QR) opens a **sales instance**; at most one non-closed instance exists per sales point per work day. Staff-opened tables are service-only (customers cannot self-order at them).
- **Orders** attach to the sales instance. Each order is one main good plus optional add-ons; promotions apply to the main good. Identity is taken from the session (`createdByUserId`, `createdAsRole`).
- **Lifecycle**: add, transfer between tables, and — for managers and above — **cancel** (removing it and restoring inventory), **void** with a required reason (kept in reporting), and mark **invitation/complimentary**.
- **Billing**: review the tab, split bills as supported, then take **payments per method** with optional **tips**, record the payment-method breakdown, and **close** the instance when all orders are paid.
- **Printers** route kitchen/bar tickets by category, subcategory, and sales point, with backup printers and per-employee print permissions.
- The **first sales instance of the day** automatically opens the daily sales report (see Reporting).

### Payments and tax

- Payment **methods are recorded** for reporting: cash, card (Visa, Mastercard, American Express, Discover, Diners Club, Maestro), crypto (Bitcoin, Ethereum, Litecoin, Ripple, Cardano, Polkadot, Dogecoin), and other (Voucher, PayPal, Venmo, Apple Pay, Google Pay, Samsung Pay).
- **Direct payment processing** is provided through **third-party providers** (e.g. PayPal, Skrill, Stripe) for in-app customer payment and in-POS capture, including split/partial payments, refunds, and provider-settled payouts.
- **Tax** follows the single business-level configuration above.

### Promotions

- Promotion types: **percentage discount**, **fixed price**, **2×1**, **3×2**, **second item half price**, and **full complimentary**.
- Scoping: active period, weekdays, the **business goods** they apply to, and an option to **apply to delivery**.
- Promotions are applied **in real time** as staff or customers build orders.

### Loyalty and gift cards

- **Loyalty** is per customer **and per venue**: spending at a venue builds that venue's loyalty. Each venue runs a **Loyalty Program** that defines the **levels** (by spend/visits) and the **reward per level** — a **discount** or a **gift card**. Redemption is **only at the granting venue**; there is no portfolio-wide loyalty.
- A customer's loyalty is a balance-and-ledger record: earn/redemption history is immutable and auditable, so points always reconcile.
- **Gift cards** are created and held by the **business**, identified by a **QR code**. They are a **bearer instrument** — whoever holds the code holds the card. A gift card carries a **fixed value** redeemable across **multiple orders** until depleted, is redeemable **only at the issuing venue**, is **non-reloadable**, and has an **expiry date**.

### Reservations

- Reservations are a **free** booking layer, created by a **customer** (status `Pending`, reviewed by managers) or by **staff** (created `Confirmed` when the staff member's effective role permits).
- Lifecycle: `Pending` → `Confirmed`/`Cancelled`, then `Arrived` → `Seated` → `Completed`, with `NoShow` available.
- **Seating** a reservation creates a **sales instance** and links it to the reservation; the first order attributes consumption to the reservation; full payment completes it.
- Moving a reservation's table moves its sales instance (and vice versa).

### Reports and metrics

- **Daily sales report** — opens automatically on the first sales instance of the day. It accumulates **per-employee**, **delivery**, and **self-ordering** buckets (sales, tips, goods sold/voided/invited, payment methods), plus **business totals** (net paid, cost of goods, profit, customers served, average spend, POS commission). Managers **calculate**, **reconcile**, and **close** it; closure requires no open orders and locks the day.
- **Weekly business report** — aggregates calculated/closed daily reports for the venue's configured reporting week, focused on operational performance (fixed and extra monthly costs excluded). It closes automatically when a new reporting week begins.
- **Monthly business report** — aggregates the month's daily reports plus inventory variance and waste, purchasing, and labour cost, then compares **targets vs actuals** across food/beverage/labour/fixed cost and waste. It includes break-even, net profit, and a metrics-comparison section. It auto-closes at the month boundary once all daily reports are closed.
- **Reporting exports** are available across these reports, powered by the shared advanced-table engine used as the blueprint for report tables.
- **Business metrics formulas** (profitability, cost and sales quality, break-even, operational efficiency, and promotion/bar controls) are defined in the business-metrics subject, alongside the cost targets and waste thresholds.

### Notifications

- Each user has an **inbox** with per-notification `read` and `deleted` state, shared by customers and employees through their user identity.
- Delivery is **persistence-first** — in-app notifications are stored and are the source of truth — with **email** and **live WebSocket** push when the recipient is online. Nothing is lost if a user is offline.
- **Operational** events include reservations pending/decided, low-stock alerts, weekly/monthly report-ready, business profile updates, and the overtime alerts in [§6](#6-time-control-and-attendance).
- **Engagement** events let a venue message its customers — **promotions, birthdays, and events** — alongside operational alerts.

---

## 8. The Customer app

The Customer app is the free, public side of POS — the venue's customers. It is where the "final user" features live.

- **Account.** Sign up and sign in, manage profile, verify email, reset password. Every user is a customer.
- **Discovery.** Browse venues by cuisine type, categories, rating, and location (geo radius), and view a venue's public profile and menu.
- **Ordering across every service surface**: **QR self-ordering** at a table (delivered to the QR point), **kiosk** ordering (counter pickup), and **takeaway / delivery** (to an address or picked up on premises). Orders can be paid **in-app** via third-party providers.
- **Reservations.** Request a table (free) and track its status.
- **Ratings.** Give a venue a **0–5 star** rating, optionally tied to an order.
- **Comments.** Leave a **text review on the venue**.
- **Favorites.** Save **venues** for quick access.
- **Loyalty.** Earn rewards at venues by spending, and redeem the reward configured for the reached level (a discount or a gift card).
- **Gift cards.** Receive/hold gift cards identified by QR code and redeem them at the issuing venue before expiry.
- **Order history and receipts**, delivered in-app and by email.
- **Notifications** in the same inbox model, including venue engagement messages.
- **Mode switch.** If the user also holds business roles, they can switch to the business app (schedule permitting — see [§5](#5-access-roles-and-the-mode-chooser)).
- **Real-time order status**, updated live.

---

## 9. The Superadmin console

The Superadmin console runs the **application business** — POS itself — not any venue. It is a separate surface with its own authentication realm (separate credentials, MFA, and access restrictions), distinct from the business and customer sessions.

- **Owner account management.** Superadmin manages **Owners** as the paying accounts: subscription, commission terms, and account lifecycle (approve/suspend/resume/delete), with visibility into the Businesses beneath each Owner.
- **Plan catalog.** Management of the subscription plan catalog and assignment of plans to Owners.
- **Commission configuration.** The commission rate per plan.
- **Feature flags and platform configuration.**
- **Support tooling**, including scoped impersonation for debugging a venue.
- **Platform-wide analytics** across Owners and venues.
- Superadmin manages **Owners and their Businesses**; it never operates a venue's day-to-day service.

---

## 10. Real-time and communication

POS is **live by design**: sales points, sales instances, order status, stock movement, and notifications update continuously across the API and UI. Operationally this means:

- The POS state (open tables, order status, stock movement) is reflected in real time.
- In-app notifications are persisted first, then pushed live over WebSocket, so online users see them instantly and offline users see them on return.
- Core business actions are never blocked by communication failures; email has retry behavior, and noisy events (low-stock, overtime) use cooldown and idempotency.

---

## 11. Monetization

- **Businesses pay; customers are free.**
- **Subscription.** An **Owner** subscribes to a **tiered plan** — **Free, Basic, Premium, Enterprise** — managed from the Superadmin catalog. The plan covers the Owner's venues and determines which features are available.
- **Commission.** POS also earns a **commission on transactions**, and the commission rate **varies by subscription tier**. Commission is **fixed by the plan** and is therefore **not a user-editable field**; it is reported as platform revenue, not as a venue input. Where possible it is collected automatically through the integrated payment provider, and invoiced otherwise.

---

## 12. Platforms and constraints

- **Responsive web app.** POS runs in any modern browser on desktop, laptop, tablet, or phone. There is currently no installable PWA requirement and no native app; a native version may follow later using the same logic.
- **Customer-brought hardware.** The venue chooses its devices, printers, and screens. POS sells none of them.
- **Online-only.** Connectivity is required; there is no offline mode.
- **Language and currency.** The UI ships in **English and Spanish** (more languages later); each business selects **one currency** at onboarding.

---

## 13. What POS is not

- **Not proprietary hardware.** POS does not lock venues to a specific device, printer, or screen, and sells no hardware.
- **Not a hardware vendor.** POS is software only.
- **Not offline.** There is no offline mode; the product is online-only.
- **Not a multi-vendor marketplace.** Customers order from a specific venue; delivery is per-venue, not a marketplace spanning venues.
- **Not self-hosted.** There is no on-premise or self-managed deployment; POS is cloud SaaS.

(Direct payment processing and delivery **are** in scope — delivered through third-party providers.)

---

## 14. Where to go next

- The user-flow document — the day-to-day journey from onboarding through service, purchasing, inventory, reporting, and the customer experience.
- The business-metrics subject — the cost targets, supplier-good waste thresholds, reporting-week start day, and the KPI dictionary with its canonical formulas.
- The per-feature product-document template and conventions (`_template.md`).

Architecture decisions are recorded as ADRs under `docs/adr/`; engineering vocabulary is in the root `GLOSSARY.md`. Each product document is listed in `AGENTS.md`.
