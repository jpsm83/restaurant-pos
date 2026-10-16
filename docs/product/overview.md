# Project Imperium — Product Overview

> **About this document.** This is the **target-state source of truth** for what Project Imperium is. It is written for two readers: AI agents that build the product, and engineers onboarding onto it. It describes the product as it is *meant to be*, not as a status report — capabilities are stated as commitments, without built/planned tags. Product and domain vocabulary is defined here as it is introduced; engineering vocabulary (DTO, server-owned field, problem details, …) lives in the root `GLOSSARY.md`.

---

## 1. What Project Imperium is

Project Imperium is a **complete, real-time, cloud SaaS platform** for **bars and restaurants**: a full **restaurant management platform**, not merely a point-of-sale. It covers the whole operation — service, menu, supply, stock, people, and reporting — and extends outward to the venue's **customers** through self-ordering, delivery, to-go packaging, booking, ratings, and gift cards. The point of sale is one surface of one system; menu and costing, supply and stock, people and scheduling, and reporting run on the same platform.

It is built on four positioning pillars:

- **100% SaaS.** Nothing to install on a server. The product runs in the browser; there is no on-premise deployment.
- **Hardware-agnostic.** The customer brings their own hardware — desktop, laptop, tablet, phone, printer, or screen. Project Imperium sells no hardware and locks the venue into none; it works with whatever the venue already owns.
- **Online-only.** The product requires connectivity; there is no offline mode.
- **Multi-tenant.** A **Business** is the tenant and represents **one venue** (one physical restaurant or bar). The same platform serves many businesses with fully isolated data, and businesses can be grouped under an **Owner** across multiple venues.

Project Imperium is delivered as **three product surfaces over one shared platform**: the **Business** app (operations, where venues and owners work), the **Customer** app (the public, free side), and the **Superadmin** console (which runs the application business itself). See [§5](#5-access-roles-and-the-mode-chooser) and [§3](#3-tenant-identity-and-account-model).

### Positioning at a glance

| Dimension | Project Imperium |
| --- | --- |
| Delivery | Cloud SaaS, browser-based |
| OS / device | Any — PC, laptop, tablet, phone, network printer, screen |
| Connectivity | Online-only (no offline mode) |
| Tenancy | Multi-tenant; one **Business** = one venue; venues grouped under an **Owner** into **Companies** (tax entities) |
| Paid by | Businesses (subscription + commission); **customers are free** |
| Surfaces | Business · Customer · Superadmin |

### Core vocabulary

These terms are used with exactly these meanings throughout Project Imperium. Do not drift to synonyms.

| Term | Meaning |
| --- | --- |
| **Owner** | The account that owns one or more **Companies**. Created automatically when a user registers a business; holds the subscription and commission terms for its venues. |
| **Company** | The **tax entity** that groups one or more **Businesses** (venues) run as one legal unit. Holds the tax number; its venues may transfer stock internally. |
| **Business** | The **tenant** — one venue (restaurant/bar). All operational data is scoped to the business. |
| **User** | A person's global identity. **Every user is a customer**; some also hold business roles. |
| **Employee** | A person's membership in a Business — the full per-venue employment record (job role(s), status, contract, pay, vacation, HR identifiers). Links a **User** to a **Business**; the User itself holds only client/global identity. |
| **Customer** | A user acting as the final consumer (ordering, booking, rating). |
| **POS** | Point of sale — the staff-facing surface where an employee selects a sales point, takes orders, and bills. One surface of the platform, distinct from self-ordering, kiosk, and delivery; never the whole product. |
| **Sales point** | A place a customer sits or is served — a **type** (Table, Room, Bar, Seat, Counter, Spot, Kiosk, the virtual **Delivery** point, or Other) plus the **channels** it accepts (dine-in, self-ordering, kiosk, delivery). Holds its QR code. |
| **Channel** | How an order reached the venue — **dine-in**, **self-ordering**, **kiosk**, or **delivery**. A **sales point** declares which point-anchored channels it accepts. **To-go packaging** (stay vs packed to go) is not a channel; the order-flow subject owns it. |
| **Sales instance** | An open session/tab at a sales point that groups the orders for that sitting. |
| **Order** | One billable line: one main business good plus optional add-ons. Quantity is expressed as multiple orders. |
| **Batch** | A group of orders sent to the kitchen/bar together, sharing one **identification code**. |
| **Fulfilment slice** | The portion of a batch one **prep area** must prepare. Each slice carries its own **fulfilment status**: **Sent → Preparing → Ready → Delivered**, so areas (for example food and drinks) can finish on independent timelines. |
| **Business good** | A sellable menu item (simple, recipe/ingredient-based, or a set menu / combo). |
| **Supplier good** | A raw/purchased item from a supplier; the ingredient behind recipes and the unit of stock. |
| **Supplier** | A vendor the business buys from. |
| **Purchase** | A record of the goods a business buys from a supplier — from what it requests through to what it receives; feeds inventory. A **one-time purchase** records an ad-hoc expense with no supplier. |
| **Inventory** | The stock ledger per business: a **dynamic system count** per supplier good, **physical counts** with **deviation** per **count period**, and a monthly **resume**. |
| **Promotion** | A venue-defined price rule scoped to menu subcategories and a time window, applied to orders in real time. |
| **Reservation** | A table booking made by a customer or staff, optionally with a deposit at acceptance; hands off into live service across one or more sales points. |
| **Rating / Comment / Favorite** | Venue-level customer feedback and saved venues. |
| **Gift card** | A bearer budget card a business issues as a virtual card by email, identified by a QR code and a card number, spent whole in one settlement at its issuing venue before it expires. |
| **Shift session** | The actual, recorded attendance for one employee on one shift (sign-in/out, breaks). |
| **Daily / Weekly / Monthly report** | The aggregated sales and performance reports at each roll-up level. |
| **Notification** | A message Project Imperium delivers to a person's inbox. An **operational** notification carries a **severity** — **Info**, **Warning**, or **Emergency** — while a venue **engagement** message carries a **kind** — **Message**, **Promotion**, **Birthday**, or **Event**. |
| **Soft delete** | Project Imperium never hard-deletes domain documents: a server-owned deleted marker plus a timestamp are set, the document is retained and reactivatable, and uniqueness is enforced among active documents. Every model follows it, apart from deliberate exceptions — an empty sales instance is discarded, and a cancelled order is erased. |

---

## 2. Who it is for

Project Imperium serves six personas. Five map to one of the four **base access layers** ([§5](#5-access-roles-and-the-mode-chooser)); the sixth, the **Superadmin**, runs the platform's own application business in a separate realm.

- **Owner** — owns one or more venues, grouped into Companies. Registers the business, holds the subscription, and moves between venues through the owner shell. Also acts as an admin inside each venue.
- **Admin** — has **full control of the venue**: configuration, people, permissions, and every operation.
- **Manager** — runs day-to-day operations: schedules, purchasing, inventory, promotions, and report calculation/closure. Managers and above assign job roles and capabilities.
- **Employee** — delivers service (waiter, bartender, chef, cashier, host, …). Access to the business app is gated by the **schedule**.
- **Customer** — the final consumer. **Every user is a customer**, even one who registered a business. Uses the Customer app to discover venues, order, book, and rate.
- **Superadmin** — the platform operator. Runs the **application business**: accounts, plans, and platform analytics. Never operates a venue's day-to-day service.

---

## 3. Tenant, identity, and account model

Project Imperium's tenancy tree is:

```
Superadmin  (platform operator — the application business)
   └── Owner              (the paying account; one per person/company)
          └── Company     (the tax entity; holds the tax number)
                 └── Business    (one venue; the tenant)
                        └── all operational data scoped to the business
```

- **User → Employee → Business.** A **User** is a single global identity. An **Employee** record links that user to a business and carries job role(s), pay, and status. An owner across several venues is one user with an employee membership per venue.
- **User → Owner → Company → Business.** When a user registers a business, Project Imperium **automatically creates (or updates) an owner account** for them, taking the **Owner job role by default**. The Owner holds its **Companies**, the **subscription**, the **commission terms**, and other portfolio data.
- **One Business = one venue.** A multi-venue operator does not share one business record; each venue is its own **Business**, grouped under one **Owner** through a **Company**.
- **Company = tax entity.** A **Company** groups the venues run as one legal unit and holds their **tax number**. Every **Business** belongs to exactly one Company; a venue added to an existing Company shares its tax identity, while a venue added as a new Company is a separate taxpayer.
- **Everyone is a customer.** Creating a user — including registering a business — also grants the customer identity. There is no "business-only" user.
- **Tenant root.** Almost every domain collection carries a required, indexed link to its business; this is the isolation boundary. The **User** is the exception — it is global and joins a tenant only through **Employee**.

Owner-level resources — the **subscription**, **commission**, and portfolio navigation — scope to the **Owner**; the **inventory-transfer network** scopes to the **Company** (stock moves only within one tax entity); everything operational scopes to the **Business**.

---

## 4. Service surfaces

Project Imperium defines four canonical ways a venue can serve, plus a cross-cutting booking layer. ("Different ways to work and serve" = this set.)

1. **Dine-in — staff POS.** A waiter, bartender, or host opens a sales point (select it in the POS, or scan its QR) to open a **sales instance**, takes orders, and later bills and closes the table. This is the classic served-on-premises flow.
2. **QR self-ordering — on premises.** A customer at a sales point scans its QR code to self-order from the menu. The order is **delivered to that QR point** (the table/seat). Self-ordering requires the **business** to have self-ordering enabled and the **sales point** to accept that channel, and is unavailable while a staff member holds the table.
3. **Kiosk.** A **variant of the on-premises QR order** — a self-service terminal running the same web app. The difference is fulfilment: a kiosk order is **not delivered** anywhere; it is **picked up at the counter**.
4. **Delivery — customer-initiated.** A customer orders from the venue to be **delivered to an address**. Delivery is **per-venue** (each venue serves within its own radius and windows). Venue staff hand the packed order to a **third-party courier**; the courier's last-mile tools are outside Project Imperium. Guests who want food **to go** without delivery use ordinary dine-in or self-service with **to-go packaging** — there is no separate takeaway channel or sales point.
5. **Reservations** — the cross-cutting **booking layer** that hands off into service. A venue may **accept** a booking with no charge or **request a deposit** before it becomes reserved. See [§7](#7-the-business-platform).

Kiosk and QR ordering are not separate products — they are routes within the **Customer** app. Delivery is a configuration of the same platform (delivery enabled, delivery radius, minimum order, delivery windows, and a dedicated virtual delivery sales point). Self-ordering is likewise a venue configuration plus per-point channel acceptance. The shared service journey across surfaces is the order-flow subject.

---

## 5. Access, roles, and the mode chooser

Access control is **two-layer**:

- **Base access layers (control).** Exactly four layers define what a user may do at the highest level: **admin**, **manager**, **employee**, and **customer**. Admin has full venue control; manager runs operations; employee serves (schedule-gated); customer consumes.
- **Job roles (description).** A user's job is described by the canonical job-role list (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Operator, Employee, Cashier, Floor Staff, Bartender, Barista, Waiter, Head Chef, Sous Chef, Line Cooks, Kitchen Porter, Cleaner, Security, Host, Runner, Supervisor, Entertainer, Other). The job role tells you *what the person is*; the base layer tells you *what they may do*.
- **Permission assignment UI.** **Managers and above** use a UI to assign job roles and **per-user capabilities** — granting or revoking individual powers on top of the base layer's defaults.

**The mode chooser.** Because every user is a customer *and* may hold business roles, login routes by role:

- A user with **only** customer access goes straight to the Customer app.
- A user with **business access** sees a **chooser**: continue as **Customer** or continue into the **Business** app. Owner/manager/admin access is a form of business mode; the owner shell then handles multi-venue switching.
- Customer access is **always** available to every user.

**Schedule gating.** The **schedule is the plan**; **on duty** is a separate attendance fact (see [§6](#6-time-control-and-attendance)).

- Employees (any job role) **must appear on the schedule** for planning; time control compares actual attendance against that plan.
- A non-management employee **cannot access the business app unless they have a planned working shift for that time**. The employee option opens from **10 minutes before shift start**; if the user is **not scheduled**, they are taken straight to the Customer app (no chooser). Opening employee mode is **not** on duty.
- There is **no** late-unlock on the schedule. Lateness and real entry times belong to time control.
- **Managers, admins, and owners are never blocked.** They may access the business app and execute any task without being scheduled, though they must still appear on the schedule for planning (and so time control can see who was planned as management that day).

See [§6](#6-time-control-and-attendance) for the attendance model. The schedules subject is the source of truth for the rota itself.

---

## 6. Time control and attendance

Time control is a **plan-vs-actual** system, separate from the schedule:

- **Schedule (the plan).** Each business defines, per calendar day, one schedule of shift entries (working shifts with job role and start/end, vacation, and other leave). Schedule aggregates (staff count, vacation count, planned hours, planned labour cost) feed reporting. The schedule does **not** imply on-duty. Overnight working shifts belong to the day they start. The schedules subject owns the rota in full.
- **On duty (the actual).** A person becomes **on duty** by scanning a **daily QR code** held by managers on duty that day — not by opening employee mode. Sign-out is performed by a manager at the employee's request. Real entry and exit times are what attendance records. The time-control subject owns QR issue, scan-in, manager sign-out, breaks, worked hours, actual labour cost, and related alerts.
- **Shift session.** For each employee engagement, Project Imperium records a **shift session** projected from attendance events: planned window from the schedule, **actual sign-in / sign-out**, breaks, resulting **worked hours** and **labour cost**, and status. One open session per employee at a time prevents double sign-in.
- **Breaks.** An employee can **pause and resume** duty during a shift (lunch, rest, or other break). Paused time is excluded from worked hours but the employee remains signed in.
- **Overtime alert.** If an employee **other than an admin/owner** is still on duty after their scheduled end, the **admin on duty** is notified **every 5 minutes** until that employee signs off. (This reuses the platform's cooldown/idempotency notification behavior.)

All times are stored in UTC and interpreted in the **business timezone**. Actual worked hours and labour cost feed the monthly business report.

---

## 7. The Business platform

The Business app is the operational heart of Project Imperium. It comprises the **owner shell** (a venue switcher with tabs across an owner's businesses) and the per-venue workspaces below.

### Onboarding and configuration

- **Registering a business** is an action by an **already-registered user**; it creates the tenant, initialises the user's **Owner** account (on their first venue), and creates the owner's employee membership. A user who already owns venues chooses whether the new venue **joins an existing Company** or **forms a new one**. The business can be **saved as an incomplete draft** and edited over time; it collects profile (trade/legal name, logo, contact, phone), **currency** (one per business, chosen at onboarding), and address; the **timezone** is derived from the address. The **tax number** belongs to the venue's **Company**.
- **Go-live.** A business is **not live** until its **go-live checklist is complete** and its **contact email is verified**; an admin/owner then flips the **go-live toggle**. **Not live** means **absent from customer discovery** and **unable to take customer orders or bookings**, though the venue remains fully usable internally. A live business can also be taken **offline**, which is distinct from **closing** it.
- **Profile and discovery.** Public fields — cuisine type, categories, contact, and cached average rating and rating count — power customer discovery.
- **Opening hours** per weekday.
- **Delivery settings**: enable/disable, **delivery radius**, **minimum order**, and **per-day delivery windows**.
- **Tax**: a single **business-level tax configuration** — a **rate per tax category** (Food, Non-alcoholic drinks, Alcoholic drinks, Merchandise, Tobacco, Gift card, and Tip) — applied to orders and bills. Prices are **tax-inclusive**: the customer always sees the final price, and tax is computed on the amount actually paid after any discount.
- **Metrics and targets**: target cost percentages (food, beverage, labour, fixed), **supplier-good waste thresholds** by budget impact, the **start day of the reporting week**, and a **KPI catalogue** — every named metric with its canonical formula, the **dimensions** it can be sliced by, and an industry **benchmark**.
- **Subscription**: the plan is held on the **Owner** and covers its venues (see [§11](#11-monetization)).

### People, roles, and scheduling

- **Employees** are the full membership of a user in a business. The **User** holds only client/global identity; job roles, employment status, contract, pay (gross for labour cost, net for HR), vacation, HR identifiers, documents, termination, and rehire all live on the membership. The employees subject is the source of truth for that record.
- **Roles and permissions** follow the two-layer model in [§5](#5-access-roles-and-the-mode-chooser): base layers, job roles on the membership, and per-user capability assignment by managers and above.
- **Schedules** define each day's rota (working shifts with required role and start/end, vacation and other leave, day comments, copy/bulk edit, time-off requests). Project Imperium enforces no overlapping shifts and correct vacation accounting, and rolls up daily staff, vacation, planned hours, and planned labour-cost totals. The schedules subject is the source of truth.
- **Time control** records actual attendance (manager QR sign-in, manager sign-out, breaks, overtime) as described in [§6](#6-time-control-and-attendance).

### Menu — business goods

- Business goods are what the venue **sells**: **simple items**, **recipe/ingredient-based items**, and **set menus / combos**.
- Configuration includes name, keyword, main/sub category, **tax category**, **on-menu state** and **availability state**, selling price, images, description, **preparation time**, and optional **add-ons** (shared across the menu).
- Project Imperium derives **cost** and **allergens** from the supplier goods a good is built from — simple items, recipe-based items, and combos — **live** as prices and stock change; the venue sets the **selling price** freely.

### Supply and purchasing

- **Suppliers** are the vendors a business buys from (profile, address, contacts, tax number, in-use state).
- **Supplier goods** are the purchasable items and the unit of stock: category, measurement unit, purchase unit and purchase math (quantity ↔ total price → price per measurement unit), **budget impact**, allergens, **par level** and **minimum required**, images, and in-use state.
- **Purchases** carry a goods request from a supplier through to what was received: supplier, date, purchasing employee, lines with **requested** and **delivered** quantities (supplier good, quantity, price), receipt identification, and optional documents. Inventory is incremented on receipt, per line. **One-time purchases** record ad-hoc expenses with no supplier and no supplier-good tracking. Editing a received purchase requires a **reason** and is **audited** (who, when, before/after values).

### Inventory and transfers

- **Inventory** is the venue's stock ledger: a **dynamic system count** per supplier good (risen by received purchases and transfers in, lowered by orders and transfers out, restored on cancellation) and **physical counts** performed by staff, each carrying a **deviation** for the **count period** it closes.
- Counts happen **whenever the venue decides** — Project Imperium sets no schedule; a submitted count is **locked**, and its **re-edit** requires manager/supervisor authority and a **reason**, with an audit trail.
- A month's counts are aggregated into a **monthly resume**: a **manager closes** the month after reviewing it, and the month's closing count is taken on the **morning of the first day of the following month**. Closing locks the month; only the **general manager** reopens it, with a reason.
- Project Imperium surfaces **low-stock alerts** (below a good's **minimum required**) and **negative-stock alerts**, notified to the managers on duty, plus a **variance report** comparing theoretical usage (from recipes) against actual usage (opening + purchases + transfers in − transfers out − closing) and **waste** graded by budget impact.
- **Inventory transfers** move supplier goods between **venues of the same Company only**, valued **at cost**, adjusting **both venues' inventories** and leaving a full **audit trail** (who, when, quantity, value). A transfer is not a sale and not a purchase and carries no tax. Manager-and-above authorization is required.

### Service — sales points, sessions, orders, billing

- **Sales points** represent where guests sit or are served: their **type** (Table, Room, Bar, Seat, Counter, Spot, Kiosk, the virtual Delivery point, or Other) and the **channels** they accept (dine-in and self-ordering on served points, kiosk, delivery). Each carries its **QR code** and printer routing.
- **Opening** a sales point (from the POS or by scanning its QR) opens a **sales instance**. A served point holds **at most one open staff tab at a time**, and an open staff tab blocks customer self-ordering there; the self-service channels (self-ordering, kiosk, delivery) pay to close and may run several at once. Staff-opened tables are service-only (customers cannot self-order at them).
- **Orders** attach to the sales instance. Each order is one main good plus optional add-ons; promotions apply to the main good. Who created it, and in what role, is taken from the session.
- **Lifecycle**: add, transfer between tables, and — for managers and above — **cancel** (removing it and restoring inventory), **void** with a required reason (kept in reporting), and mark **invitation/complimentary**.
- **Billing**: review the tab, split bills as supported, then take **payments per method** with optional **tips**, record the payment-method breakdown, and **close** the instance when all orders are paid.
- **Printers and screens** route prep and customer tickets by category, subcategory, and sales point; bind logical printers through local print connectors; offer backup printers and per-employee print permissions; and run configurable prep-area main/sub screens, a delivery screen, and a customer pickup board. Fulfilment status advances per prep-area slice (**Sent → Preparing → Ready → Delivered**).
- The **first sales instance of the day** automatically opens the daily sales report (see Reporting).

### Payments and tax

- Payment **methods are recorded** for reporting: cash, card (Visa, Mastercard, American Express, Discover, Diners Club, Maestro), crypto (Bitcoin, Ethereum, Litecoin, Ripple, Cardano, Polkadot, Dogecoin), gift card, and other (Voucher, PayPal, Venmo, Apple Pay, Google Pay, Samsung Pay).
- **Direct payment processing** is provided through **third-party providers** (e.g. PayPal, Skrill, Stripe) for in-app customer payment and in-POS capture, including split/partial payments, refunds, and provider-settled payouts.
- **Tax** follows the business-level configuration above: a rate per tax category, applied to a tax-inclusive price.

### Promotions

- Promotion types: **percentage discount**, **fixed price**, **2×1**, **3×2**, **second item half price**, and **full complimentary**.
- A promotion is created **disabled** and turned on with an **enabled** switch; enabling is blocked when it would overlap in time another enabled promotion whose **menu subcategory** scope intersects it.
- Scoping: an **active period**, **daily hours**, **weekdays**, the **menu subcategories** they apply to, and an option to **apply to delivery**.
- Promotions are applied **in real time** as staff or customers build orders.

### Gift cards

- **Gift cards** are issued and held by the **business**, identified by a **QR code** and a **card number**, and delivered as a **virtual card by email** — there is no physical card. They are a **bearer instrument** — whoever holds the card may spend it. A gift card carries a **value** in the business currency, is **non-reloadable**, is **spent whole in one settlement**, is redeemable **only at the issuing venue**, and **expires**, its unspent value forfeited to the business. A card is bought as a **paid** card (taxed at the **Gift card** rate) or **granted** by the business as an **invitation**, and redeemed as a **Gift card** payment. Its minimum value and validity period are business configuration; its purchase and redemption are recorded in the daily report.

### Reservations

- Reservations are a **booking layer** a venue may turn on or pause in business configuration. A **customer** requests from the Customer app (**Pending**); **Host and above** create on the web and may Accept in the same step. Host and above **Accept** (no deposit) or **Request deposit**; paying the deposit — or accepting without one — moves the booking to **Reserved** and sends confirmation by email.
- Lifecycle: pending → awaiting deposit (when requested) → reserved → arrived → seated → completed, with cancelled, no-show, and awaiting table when assignment is lost.
- The guest sets **arrival time**; Host and above set an internal **end time** (not shown to the guest) and may assign **one or more** sales points with a hard no-overlap rule. Opening a reserved point asks **reservation guests** or **ordinary guests**; linked tabs each run their own orders and payments under the same reservation. A paid deposit appears as **shared credit** on linked tabs and is applied at bill time.
- Moving a reservation's assigned point moves its linked sales instance (and vice versa).

### Reports and metrics

- **Daily sales report** — opens automatically on the first sale of the day. It accumulates **per-employee**, **delivery**, **self-ordering**, and **kiosk** buckets (sales, tips, goods sold/voided/invited, payment methods), plus **business totals** (net paid, cost of goods, profit, customers served, average spend, Project Imperium commission), with operational breakdowns by employee, sales point/channel, payment method, and item. Managers **calculate**, **reconcile**, and **close** it; closure requires no open orders and locks the day.
- **Weekly business report** — aggregates closed daily reports for the venue's configured reporting week, focused on operational performance (fixed and extra monthly costs excluded), and carries the full set of **dimension breakdowns**. It closes automatically when a new reporting week begins.
- **Monthly business report** — aggregates the month's daily reports plus inventory variance and waste, purchasing, and labour cost, then compares **targets vs actuals** across food/beverage/labour/fixed cost and waste. It includes break-even, net profit, and a metrics-comparison section, with the full dimension set plus supplier breakdowns. It closes at the month boundary once all daily reports and the **inventory month** are closed.
- **Reporting exports** are available across these reports, powered by the shared advanced-table engine used as the blueprint for report tables.
- **Business metrics** — the full **KPI catalogue** (profitability, cost, sales quality, labour, inventory and purchasing, menu engineering, operations, customer, and promotion/bar controls), each with its canonical formula, supported **dimensions**, and an industry **benchmark**, plus the cost targets and waste thresholds — are defined in the business-metrics subject; the reports subject owns how they are gathered, grouped, closed, and presented.

### Notifications

- Each user has an **inbox** with per-notification read and deleted state, shared by customers and employees through their user identity.
- Delivery is **persistence-first** — in-app notifications are stored and are the source of truth — with **email** and **live WebSocket** push when the recipient is online. Nothing is lost if a user is offline.
- **Operational** events include reservations pending/deposit-requested/decided (and Awaiting table for Host and above), low-stock alerts, weekly/monthly report-ready, business profile updates, and the overtime alerts in [§6](#6-time-control-and-attendance).
- **Engagement** events let a venue message its customers — **promotions, birthdays, and events** — alongside operational alerts.

---

## 8. The Customer app

The Customer app is the free, public side of Project Imperium — the venue's customers. It is where the "final user" features live.

- **Account.** Sign up and sign in, manage profile, verify email, reset password. Every user is a customer.
- **Discovery.** Browse venues by cuisine type, categories, rating, and location (geo radius), and view a venue's public profile and menu.
- **Ordering across every service surface**: **QR self-ordering** at a table (delivered to the QR point), **kiosk** ordering (counter pickup), and **delivery** (to an address), with optional **to-go packaging** on dine-in and self-service. Orders can be paid **in-app** via third-party providers.
- **Reservations.** Request a table (when the venue accepts bookings), pay a deposit when asked, and track status.
- **Ratings.** Give a venue a **0–5 star** rating, optionally tied to an order.
- **Comments.** Leave a **text review on the venue**.
- **Favorites.** Save **venues** for quick access.
- **Gift cards.** Buy a gift card for themselves or for someone else, receive and hold virtual cards identified by QR code and card number, and redeem them at the issuing venue before expiry.
- **Order history and receipts**, delivered in-app and by email.
- **Notifications** in the same inbox model, including venue engagement messages.
- **Mode switch.** If the user also holds business roles, they can switch to the business app (schedule permitting — see [§5](#5-access-roles-and-the-mode-chooser)).
- **Real-time order status**, updated live.

---

## 9. The Superadmin console

The Superadmin console runs the **application business** — Project Imperium itself — not any venue. It is a separate surface with its own authentication realm (separate credentials, MFA, and access restrictions), distinct from the business and customer sessions.

- **Owner account management.** Superadmin manages **Owners** as the paying accounts: subscription, commission terms, and account lifecycle (approve/suspend/resume/delete), with visibility into the Businesses beneath each Owner.
- **Plan catalog.** Management of the subscription plan catalog and assignment of plans to Owners.
- **Commission configuration.** The commission rate per plan.
- **Feature flags and platform configuration.**
- **Support tooling**, including scoped impersonation for debugging a venue.
- **Platform-wide analytics** across Owners and venues.
- Superadmin manages **Owners and their Businesses**; it never operates a venue's day-to-day service.

---

## 10. Real-time and communication

Project Imperium is **live by design**: sales points, sales instances, order status, stock movement, and notifications update continuously across the API and UI. Operationally this means:

- The point-of-sale state (open tables, order status, stock movement) is reflected in real time.
- In-app notifications are persisted first, then pushed live over WebSocket, so online users see them instantly and offline users see them on return.
- Core business actions are never blocked by communication failures; email has retry behavior, and noisy events (low-stock, overtime) use cooldown and idempotency.

---

## 11. Monetization

- **Businesses pay; customers are free.**
- **Subscription.** An **Owner** subscribes to a **tiered plan** — **Free, Basic, Premium, Enterprise** — managed from the Superadmin catalog. The plan covers the Owner's venues and determines which features are available.
- **Commission.** Project Imperium also earns a **commission on transactions**, and the commission rate **varies by subscription tier**. Commission is **fixed by the plan** and is therefore **not a user-editable field**; it is reported as platform revenue, not as a venue input. A day's commission is worked out when that day's sales report closes and is **charged separately** to the business — never netted out of what the venue's customers paid, and never routed through a merchant account.

---

## 12. Platforms and constraints

- **Responsive web app.** Project Imperium runs in any modern browser on desktop, laptop, tablet, or phone. There is currently no installable PWA requirement and no native app; a native version may follow later using the same logic.
- **Customer-brought hardware.** The venue chooses its devices, printers, and screens. Project Imperium sells none of them.
- **Online-only.** Connectivity is required; there is no offline mode.
- **Language and currency.** The UI ships in **English and Spanish** (more languages later); each business selects **one currency** at onboarding.

---

## 13. What Project Imperium is not

- **Not only a point-of-sale.** The point of sale is one surface; Project Imperium also runs the menu and its costing, supply and stock, people and scheduling, and reporting.
- **Not proprietary hardware.** Project Imperium does not lock venues to a specific device, printer, or screen, and sells no hardware.
- **Not a hardware vendor.** Project Imperium is software only.
- **Not offline.** There is no offline mode; the product is online-only.
- **Not a multi-vendor marketplace.** Customers order from a specific venue; delivery is per-venue, not a marketplace spanning venues.
- **Not self-hosted.** There is no on-premise or self-managed deployment; Project Imperium is cloud SaaS.

(Direct payment processing and delivery **are** in scope — delivered through third-party providers.)
