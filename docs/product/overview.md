# Project Imperium — Product Overview

> **About this document.** This is the **target-state source of truth** for what Project Imperium is. It is written for two readers: AI agents that build the product, and engineers onboarding onto it. It describes the product as it is *meant to be*, not as a status report — capabilities are stated as commitments, without built/planned tags. Product and domain vocabulary is defined here as it is introduced; engineering vocabulary (DTO, server-owned field, problem details, …) lives in the root `GLOSSARY.md`.

---

## 1. What Project Imperium is

Project Imperium is a **complete, real-time, cloud SaaS platform** for **bars and restaurants**: a full **restaurant management platform**, not merely a point-of-sale. It covers the whole operation — service, menu, supply, stock, people, and reporting — and extends outward to the venue's **customers** through self-ordering, delivery, to-go packaging, booking, ratings, and gift cards. The point of sale is one surface of one system; menu and costing, supply and stock, people and scheduling, and reporting run on the same platform.

It is built on four positioning pillars:

- **100% SaaS.** The product runs in the cloud and in the browser; there is no on-premise deployment of Project Imperium. The only local helper a venue may run is the **print connector** when it wants paper on ordinary local printers (printers-and-screens subject) — that helper is not a self-hosted copy of the product.
- **Hardware-agnostic and minimum kit; one staff session per browser.** Staff sign in with **their own** email and password on a **personal or venue-provided** browser device. Each browser session belongs to **exactly one** User — no shared staff login, PIN, or quick-switch. The venue chooses **how little or how much** hardware to bring — phones, optional prep/customer screens, optional printers, optional customer kiosks, and print connectors only when paper needs them. Project Imperium sells no hardware, locks the venue into no brand, and does **not** impose device counts or station layouts. The staff-sessions and printers-and-screens subjects own these rules.
- **Online-only.** The product requires connectivity; there is no offline mode.
- **Multi-tenant.** A **Business** is the tenant and represents **one venue** (one physical restaurant or bar). The same platform serves many businesses with fully isolated data, and businesses can be grouped under an **Owner** across multiple venues.

Project Imperium is delivered as **three product surfaces over one shared platform**: the **Business** app (operations, where venues and owners work), the **Customer** app (the public, free side), and the **Superadmin** console (which runs the application business itself). See [§5](#5-access-roles-and-mode) and [§3](#3-tenant-identity-and-account-model).

### Positioning at a glance

| Dimension | Project Imperium |
| --- | --- |
| Delivery | Cloud SaaS, browser-based; optional local print connector for paper |
| OS / device | Staff: personal or venue-provided browser device; one User per session. Venue chooses minimum kit: optional printers, prep/customer screens, customer kiosk, print connector when paper needs it. No shared staff login; no imposed device counts. |
| Connectivity | Online-only (no offline mode) |
| Tenancy | Multi-tenant; one **Business** = one venue; venues grouped under an **Owner** into **Companies** (tax entities) |
| Paid by | Businesses (subscription + commission); **customers are free** |
| Surfaces | Business · Customer · Superadmin |

### Core vocabulary

These terms are used with exactly these meanings throughout Project Imperium. Do not drift to synonyms.

| Term | Meaning |
| --- | --- |
| **Owner** | The account that owns one or more **Companies**. Created automatically when a user registers a business; holds the subscription and commission terms for its venues. |
| **Company** | The **tax entity** that groups one or more **Businesses** (venues) run as one legal unit. Holds the **tax number** and **legal name**; its venues may transfer stock internally. Every Owner has at least one Company; every Company has at least one Business. |
| **Business** | The **tenant** — one venue (restaurant/bar). All operational data is scoped to the business. |
| **User** | A person's global identity. **Every user is a customer**; some also hold business roles. |
| **Employee** | A person's membership in a Business — the full per-venue employment record (job role(s), status, contract, pay, vacation, HR identifiers). Links a **User** to a **Business**; the User itself holds only client/global identity. |
| **Customer** | A user acting as the final consumer (ordering, booking, rating). |
| **POS** | Point of sale — the staff-facing surface where an employee selects a sales point, takes orders, and bills. On a wide viewport its home is the venue **floor plan** map; on a narrow viewport it falls back to a list/grid. One surface of the platform, distinct from self-ordering, kiosk, and delivery; never the whole product. |
| **Floor plan** | A named level or area of a venue (main floor, terrace, basement, …) with an optional uploaded or drawn **background** and **vector markers** placing sales points, printers, and screens. Many floors per business. The floor-plans subject owns layout; Service maps on POS and Host use it day-of. |
| **Print connector** | A small always-on helper on a local venue device (normally headless — not a staff PC) that is the primary bridge from Project Imperium to ordinary local printers: after pairing to the business it reports reachable physical printers, receives print work from the cloud, and drives the hardware. Staff devices do not talk to printers directly. The printers-and-screens subject owns the rules. |
| **Sales point** | A place a customer sits or is served — a **type** (Table, Room, Bar, Seat, Counter, Spot, Kiosk, the virtual **Delivery** point, or Other) plus the **channels** it accepts (dine-in, self-ordering, kiosk, delivery). Holds its QR code. |
| **Channel** | How an order reached the venue — **dine-in**, **self-ordering**, **kiosk**, or **delivery**. A **sales point** declares which point-anchored channels it accepts. **To-go packaging** (stay vs packed to go) is not a channel; the order-flow subject owns it. |
| **Delivery method** | How a venue fulfils delivery: **Own delivery** or one connected third-party **courier provider**. One method is active at a time. |
| **Own delivery** | The venue arranges its own courier outside Project Imperium; no provider is called. |
| **Courier provider** | A third-party delivery company in the global provider catalogue. A Business may connect one at a time through its **Delivery partner** settings. |
| **Courier provider connection** | A Business's connection to one provider, with write-only credentials, a connection status, and the external delivery references of its deliveries. |
| **Sales instance** | An open session/tab at a sales point that groups the orders for that sitting. |
| **Order** | One billable line: one main business good plus optional add-ons. Quantity is expressed as multiple orders. |
| **Batch** | A group of orders sent to the kitchen/bar together, sharing one **identification code**. A self-service batch also carries one **handover pass**. |
| **Handover pass** | The self-service batch's handover identity: an opaque token, the batch **identification code**, and — for QR self-ordering and kiosk — a **handover QR** on the customer receipt. A delivery receipt shows the identification code as the **order reference** and no handover QR. |
| **Handover QR** | The QR that encodes the handover pass. Staff scan it in their own signed-in Business session, or enter the identification code as a fallback, to set the selected Ready items or the whole batch **Delivered**. It is distinct from the sales point's QR, the gift card's QR, and the receipt's **review QR**. |
| **Bill** | The aggregation of a sales instance's batches for settlement, and — when staff request the check — the customer **bill** document that presents it before payment. The orders subject owns the aggregation; the receipts-and-bills subject owns the customer document, its **bill number**, and required content. |
| **Receipt** | The customer proof of settlement issued when a sales instance (or gift-card deposit checkout) is fully paid. Carries a **receipt number**, settlement detail, the self-service **handover pass** where applicable, and — for meal sittings — the **review QR**. Distinct from a batch **identification code** and from prep or handover tickets. |
| **Fulfilment slice** | The portion of a batch one **prep area** must prepare. Each slice carries its own **fulfilment status**: **Sent → Preparing → Ready → Delivered**, so areas (for example food and drinks) can finish on independent timelines. |
| **Business good** | A sellable menu item (simple, recipe/ingredient-based, or a set menu / combo). |
| **Supplier good** | A raw/purchased item from a supplier; the ingredient behind recipes and the unit of stock. |
| **Supplier** | A vendor the business buys from. |
| **Purchase** | A record of the goods a business buys from a supplier — from what it requests through to what it receives; feeds inventory. A **one-time purchase** records an ad-hoc expense with no supplier. |
| **Inventory** | The stock ledger per business: a **dynamic system count** per supplier good, **physical counts** with **deviation** per **count period**, and a monthly **resume**. |
| **Promotion** | A venue-defined price rule scoped to menu subcategories and a time window, applied to orders in real time. |
| **Reservation** | A table booking made by a customer or staff, optionally with a deposit at acceptance; hands off into live service across one or more sales points. |
| **Rating / Comment / Favorite** | Venue-level customer **review** (score and optional text) and saved-venue favorites. Reviews are owned by the ratings-and-comments subject; favorites with the users subject. |
| **Gift card** | A bearer stored-value (deposit) card a business issues as a virtual card by email, identified by a QR code and a card number, with a remaining balance redeemable in one or more settlements at its issuing venue before it expires. |
| **Shift session** | The actual, recorded attendance for one employee on one shift (sign-in/out, breaks), projected from the **time-clock ledger**. |
| **Time-clock ledger** | The append-only attendance event record (sign-in, breaks, unlock, sign-out, corrections) from which shift sessions are projected. |
| **Daily attendance QR** | The venue's one attendance QR for a calendar day; scanning it is how a person becomes on duty. |
| **Late lock** | After planned start, an employee- or supervisor-layer person who has not signed in cannot scan until a manager unlocks them; the scan still records real time. |
| **Entry window** | For a planned working shift, from 10 minutes before planned start until 2 hours after planned start — when an employee- or supervisor-layer person may enter **business mode** to attempt duty. |
| **Mode** | Whether a signed-in person is working in the **Customer** app or the **Business** app. Only two modes exist; there is no separate employee mode. |
| **Base access layer** | Exactly one of **admin**, **manager**, **supervisor**, **employee**, or **customer**. Highest-level control of what a person may do; the access-and-permissions subject owns resolution and the capability catalogue. |
| **Service** (nav) | Business left-menu header for day-of destinations — POS, Host when entitled, and when entitled control screens and attendance. |
| **Manage** (nav) | Business left-menu header for administration groups and top-level items (including Floor plans). Effective **manager or admin** only; supervisors do not see Manage. |
| **Me** (nav) | Business left-menu header for self-only destinations (own schedule, notifications, personal details). |
| **Daily / Weekly / Monthly report** | The aggregated sales and performance reports at each roll-up level. |
| **Notification** | A message Project Imperium delivers to a person's inbox. An **operational** notification carries a **severity** — **Info**, **Warning**, or **Emergency** — while a venue **engagement** broadcast carries a **kind** — **Promotion**, **Birthday**, or **Event**. |
| **Conversation** | A staff messaging thread among **Active** Employees of one **Business** (one-to-one or group). Customers have no conversations; customer↔venue dialogue is reviews. The conversations subject owns the rules. |
| **Marketing consent** | A per-person, platform-global opt-in (off by default) that must be on before a venue may send engagement **broadcasts** (Promotion, Birthday, Event). Distinct from the **engagement mute**. The privacy, consent, and DSAR subject owns the rule; notifications and emails enforce the gate. |
| **Ordering session** | The client session that owns one self-service **basket** from the start of ordering until pay-to-commit, **Clear basket** (session continues), **basket idle expiry** (session ends), or the guest leaves without paying. Concurrent sessions never share a basket because they share a sales point. The realtime-and-concurrency and order-flow subjects own the rule. |
| **Stale action** | A mutating attempt the server rejects because the client's view no longer matches server truth or the lifecycle no longer allows the act. The realtime-and-concurrency subject owns conflict outcomes. |
| **Soft delete** | Ordinary delete marks a domain document deleted with a timestamp, retains it, and allows reactivation where the product promises it; uniqueness is among active documents. Routes and operators do not physically remove domain documents, apart from deliberate exceptions — an empty sales instance is discarded, and a cancelled order is erased. **Retention purge** (plan quotas and data retention subject) may later physically remove soft-deleted records after class delays when the **data-integrity rule** allows. |
| **Operational reason** | A code from a closed platform catalogue required on void, invitation, manual discount, refund, count re-edit, gift-card void, or daily reopen (further catalogues may be product-amended). Guests never see it; it is a primary audited payload when required; reporting may break money/ops figures down by reason code. The operational reasons subject owns the catalogues. |
| **Audit entry** | An append-only who/what/when record of a controlled act. Guests never see it. The audit-trail subject owns the shared model; owning subjects name which acts are audited. |
| **Audit trail** | The ordered history of **audit entries** on a business object, report surface, or Superadmin console scope. |
| **Employee cash session** | The open financial wallet for one on-duty employee: settled staff-taken payments, proofs, and cash movements not yet included in an approved **cash-out**. Distinct from a **shift session**. |
| **Cash-out** | Supervisor-or-above approval that the employee has handed remaining expected business cash, matching electronic proofs, and cash-movement receipts for an uncashed window; issues a durable **cash-out resume** and clears that financial obligation. |
| **Expected business cash** | House-owed cash for an uncashed window after peer/house cash movements: bill cash minus cash refunds, plus cash received in, minus cash moved out. Excludes personal float and off-record cash tips. |
| **Peer cash-in** | Receiver-recorded cash-only transfer of expected business cash between two on-duty employees (optional per Business). |
| **House paid-in / paid-out** | Supervisor-recorded cash movement between an on-duty wallet and the house; always available. |
| **Cash-movement receipt** | Numbered proof of a peer cash-in, house paid-in/out, or reverse; separate sequence from cash-out resumes and customer bills/receipts. |
| **Cash drawer** | Optional physical latch wired to a receipt printer's drawer-kick port. Hardware only: a **drawer kick** opens whatever is attached on money events or manual open; there is no drawer entity, balance, or obligation. The printers-and-screens subject owns the kick and the per-staff **closing receipt printer override**. |

---

## 2. Who it is for

Project Imperium serves seven personas. Six map to the **base access layers** ([§5](#5-access-roles-and-mode)); the seventh, the **Superadmin**, runs the platform's own application business in a separate realm.

- **Owner** — owns one or more venues, grouped into Companies. Registers the business, holds the subscription, and moves between venues through the owner shell. Also acts as an admin inside each venue.
- **Admin** — has **full control of the venue**: configuration, people, permissions, and every operation.
- **Manager** — runs day-to-day operations: schedules, purchasing, inventory, promotions, and report closure. Managers and above assign job roles and capabilities (within the access-and-permissions subject's assignment rules).
- **Supervisor** — floor lead: elevated Service powers, no Manage, still **schedule-gated** for Business entry. The access-and-permissions subject owns the supervisor layer defaults.
- **Employee** — delivers service (waiter, bartender, chef, cashier, host, …). Access to the business app is gated by the **schedule**.
- **Customer** — the final consumer. **Every user is a customer**, even one who registered a business. Uses the Customer app to discover venues, order, book, and rate.
- **Superadmin** — Imperium staff operating the **application business** from a **separate Superadmin console** (own web app and auth realm): paying accounts, plans, flags, support, and portfolio analytics. Never operates a venue's day-to-day service; never a mode on the Customer \| Business chooser.

---

## 3. Tenant, identity, and account model

Project Imperium's tenancy tree is:

```
Superadmin  (platform operator — the application business)
   └── Owner              (the paying account; one per person/company)
          └── Company     (the tax entity; holds tax number and legal name)
                 └── Business    (one venue; the tenant)
                        └── all operational data scoped to the business
```

- **User → Employee → Business.** A **User** is a single global identity. An **Employee** record links that user to a business and carries job role(s), pay, and status. An owner across several venues is one user with an employee membership per venue.
- **User → Owner → Company → Business.** When a user registers a business, Project Imperium **automatically creates (or updates) an owner account** for them. The Owner holds its **Companies**, the **subscription**, the **commission terms**, and other portfolio data. Registration does **not** create an Employee membership; the Owner operates via **Owner access** (admin-equivalent within plan entitlements). An Owner joins the workforce only if they later create a membership on a paid plan.
- **One Business = one venue.** A multi-venue operator does not share one business record; each venue is its own **Business**, grouped under one **Owner** through a **Company**.
- **Company = tax entity.** A **Company** groups the venues run as one legal unit and holds their **tax number** and **legal name**. Every **Owner** has at least one Company; every Company has at least one **Business**. A venue added to an existing Company shares that tax identity (and may transfer stock); a venue added as a new Company is a separate taxpayer. Venue **trade name**, address, phone, and contact email stay on the **Business**.
- **Everyone is a customer.** Creating a user — including registering a business — also grants the customer identity. There is no "business-only" user.
- **Tenant root.** Almost every domain collection carries a required, indexed link to its business; this is the isolation boundary. The **User** is the exception — it is global and joins a tenant only through **Employee**.

Owner-level resources — the **subscription**, **commission**, and portfolio navigation — scope to the **Owner**; the **inventory-transfer network** scopes to the **Company** (stock moves only within one tax entity); everything operational scopes to the **Business**.

---

## 4. Service surfaces

Project Imperium defines four canonical ways a venue can serve, plus a cross-cutting booking layer. ("Different ways to work and serve" = this set.)

1. **Dine-in — staff POS.** A waiter, bartender, or host opens a sales point (select it in the POS, or scan its QR) to open a **sales instance**, takes orders, and later bills and closes the table. This is the classic served-on-premises flow.
2. **QR self-ordering — on premises.** A customer at a sales point scans its QR code to self-order from the menu. The order is **delivered to that QR point** (the table/seat). Self-ordering requires the **business** to have self-ordering enabled and the **sales point** to accept that channel, and is unavailable while a **staff tab** is open on that point or the point shows a **reserved hold**. After payment, the customer receives a **handover pass** with a **handover QR**; staff scan it and hand over only the items that are Ready.
3. **Kiosk.** A **variant of the on-premises QR order** — a self-service terminal running the same web app. The difference is fulfilment: a kiosk order is **not delivered** anywhere; it is **picked up at the counter**. The customer receives the **handover pass** on the receipt and printed ticket; staff scan it at the counter and hand over the whole batch once every item is Ready.
4. **Delivery — customer-initiated.** A customer orders from the venue to be **delivered to an address**. Delivery is **per-venue** (each venue serves within its own radius and windows). The venue's **delivery method** is **Own delivery** or one connected **third-party courier provider**. When the paid batch is sent to prep, a connected provider receives a **courier request**; when staff mark the batch **Delivered** on a screen, the provider receives a **courier handover** call. A venue that records no staff handover skips that call, the provider's own app records pickup, and the daily close completes the batch. Imperium's delivery job ends at venue handoff; last mile is the courier company's responsibility. Delivery receipts carry an **order reference** and no handover QR. Guests who want food **to go** without delivery use ordinary dine-in or self-service with **to-go packaging** — there is no separate takeaway channel or sales point.
5. **Reservations** — the cross-cutting **booking layer** that hands off into service. A venue may **accept** a booking with no charge or **request a deposit** before it becomes reserved. See [§7](#7-the-business-platform).

Kiosk and QR ordering are not separate products — they are routes within the **Customer** app. Delivery is a configuration of the same platform (delivery enabled, delivery method, delivery radius, minimum order, delivery windows, and a dedicated virtual delivery sales point). Self-ordering is likewise a venue configuration plus per-point channel acceptance. The shared service journey across surfaces is the order-flow subject; the courier provider boundary is the delivery-integrations subject.

---

## 5. Access, roles, and mode

Access control is a **fixed platform model** (not venue-authored RBAC). The access-and-permissions subject is the source of truth; this overview summarises:

- **Base access layers (control).** Exactly five layers: **admin**, **manager**, **supervisor**, **employee**, and **customer**. Admin has full venue control; manager runs operations and Manage; supervisor is a schedule-gated floor lead (full Service, no Manage); employee serves (schedule-gated); customer consumes.
- **Job roles (description).** A user's job is described by the canonical job-role list (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Operator, Employee, Cashier, Floor Staff, Bartender, Barista, Waiter, Head Chef, Sous Chef, Line Cooks, Kitchen Porter, Cleaner, Security, Host, Runner, Supervisor, Entertainer, Other). The job role tells you *what the person is*; the base layer tells you *what they may do*. Supervisor job role defaults to the **supervisor** layer; the access-and-permissions subject owns the full default map.
- **Per-user capabilities.** Named grant or revoke overrides from a fixed catalogue, each bound to a job role on the membership; active set follows the shift's job role. Never invent custom powers or open Manage for supervisor/employee.
- **Permission assignment UI.** On the membership under Manage → People: job roles, optional layer override, and capability checklist. Each layer may set only layers **below** it; only the owning user creates or demotes admin.

**Two modes only — Customer and Business.** There is **no** third “employee” mode. Floor work and administration both live inside **business mode**, as **Service**, **Manage**, and **Me** left-menu headers (see [§7](#7-the-business-platform)).

**Public customer surface and mode toggle.** The **Customer** app is the default public surface: anyone may browse discovery and venue profiles **without signing in**. Sign-in is offered from the chrome (avatar or sign-in control). After sign-in the person stays on the Customer surface; when they have **eligible business access**, a **Customer | Business** toggle appears in the chrome so they can switch mode without signing out. Pure customers never see the Business side of the toggle. The users subject states mode eligibility together with the access-and-permissions subject's layer rules; the user-navigation subject owns the chrome, left menu, and guards.

**Schedule gating.** The **schedule is the plan**; **on duty** is a separate attendance fact (see [§6](#6-time-control-and-attendance)).

- Staff **must appear on the schedule** for planning; time control compares actual attendance against that plan.
- A person whose **effective layer** is **employee** or **supervisor** **cannot enter business mode unless they have a planned working shift inside the entry window**: from **10 minutes before** planned start until **2 hours after** planned start. Outside that window with no open session, the Business side of the toggle is unavailable until a manager reschedules them. Opening business mode is **not** on duty. Employee layer default Service includes **Attendance** for own scan-in; late-locked scan still needs manager unlock.
- **Effective layer** while a membership person has an **open shift session** follows that session's job role; when they are **not** on an open session, standing membership layer (or Owner access) returns.
- There is **no** late-unlock on the schedule. Lateness, late lock before scan-in, and real entry times belong to time control.
- **Owners** (Owner access), and membership **managers** and **admins** when not on an employee/supervisor open session, are **never** blocked by the schedule or entry window. Supervisors **are** schedule-gated. A **Suspended** or **Terminated** membership still blocks Business through that membership; Owner access at an owned venue remains unless ownership itself is blocked.

See [§6](#6-time-control-and-attendance) for the attendance model. The schedules subject is the source of truth for the schedule itself. The access-and-permissions subject is the source of truth for layers, capabilities, and assignment.

---

## 6. Time control and attendance

Time control is a **plan-vs-actual** system, separate from the schedule:

- **Schedule (the plan).** Each business defines, per calendar day, one schedule of shift entries (working shifts with job role and start/end, vacation, and other leave). Schedule aggregates (staff count, vacation count, planned hours, planned labour cost) feed reporting. The schedule does **not** imply on-duty. Overnight working shifts belong to the day they start. The schedules subject owns the schedule in full.
- **On duty (the actual).** A person becomes **on duty** by scanning the venue's **daily attendance QR**, which any manager-layer user in business mode may present from **their own signed-in session** — not by opening business mode, and not via a shared staff login. Employees scan from **their own** signed-in session (personal or venue-provided device). Sign-out is a manager-layer action (optionally after an employee request) and is blocked while the employee still holds open sales instances or **uncashed activity** (employee cash-out subject). Real entry and exit times are what attendance records. Leaving the app does not end duty. The time-control subject owns QR issue, scan-in, late lock, manager sign-out, breaks, worked hours, actual labour cost, no-shows, and related alerts; the staff-sessions subject owns the one-User-per-session rule.
- **Shift session.** For each employee engagement, Project Imperium records a **shift session** projected from an append-only **time-clock ledger**: planned window from the schedule, **actual sign-in / sign-out**, breaks, resulting **worked hours** and **labour cost**, and status. One open session per employee at a time prevents double sign-in. After planned start, an employee- or supervisor-layer person who has not signed in is **late-locked** until a manager unlocks them; the eventual scan still records the real time. Managers and admins are never late-locked.
- **Breaks.** An employee can **pause and resume** duty during a shift with a required reason. Whether paused time counts toward worked hours is a venue setting (default: included). The employee remains signed in while paused.
- **Overtime alert.** If an employee **other than an admin/owner** is still on duty after their scheduled end, the **managers on duty** are notified **every 5 minutes** until that employee signs off or a manager mutes that session's overtime alert; if none are on duty, the alert falls back to all manager-layer users at that venue. (This reuses the platform's cooldown/idempotency notification behavior.) Every day that plans any working shift must include at least one **manager-layer** working shift so someone is always in charge on the plan.

All times are stored in UTC and interpreted in the **business timezone**. Actual worked hours and labour cost feed the **weekly and monthly** business reports. The time-control subject is the source of truth for attendance.

---

## 7. The Business platform

The Business app is the operational heart of Project Imperium. It comprises the **owner shell** (venue tabs across businesses) and, inside each venue, a persistent **left menu** with headers:

- **Service** — day-of destinations: **POS** and, when entitled, **Host**, control screens, and attendance. Ordinary employees see **POS** under Service unless a capability or Host role grants more. **Supervisors** get the full Service set by default. POS and Host use floor-plan maps on a wide viewport and list/grid when narrow.
- **Manage** — administration groups (venue, people, menu, supply, service setup, money) plus **Floor plans** as its own top-level item. **Effective manager or admin only**. Supervisors and ordinary employees do not see Manage.
- **Me** — self-only destinations (own schedule, notifications, personal details) for everyone in business mode.

There is no separate product mode for administration; Manage and Service are menu headers inside business mode. The user-navigation subject owns the desktop chrome in full.

### Onboarding and configuration

- **Registering a business** is an action by an **already-registered user**; it creates the tenant and initialises the user's **Owner** account (on their first venue) with **Owner access** — no Employee membership unless they later join the workforce. A user who already owns venues chooses whether the new venue **joins an existing Company** or **forms a new one**. The business can be **saved as an incomplete draft** and edited over time; it collects venue profile (trade name, logo, contact, phone), **currency** (one per business, chosen at onboarding), and address; the **timezone** is derived from the address. The **tax number** and **legal name** belong to the venue's **Company**. On **Free**, only that Owner User may use Business at the venue (no hired staff, schedules, or time control); Free still owes **weekly commission**.
- **Owner portfolio.** Owner chrome on owned venue tabs exposes **Add venue**, **Plan**, **Company**, and **Billing** (user-navigation; plan and billing behaviour with monetization and platform-billing).
- **Go-live.** A business is **not live** until its **go-live checklist is complete** and its **contact email is verified**; an admin/owner then flips the **go-live toggle**. The checklist includes identity/contact (including the Company's legal name and tax number), opening hours and cuisine, a **minimum service kit** (**at least one on-menu business good** and **at least one active order path** — a served or kiosk sales point, or delivery enabled), and Stripe readiness; a **receipt printer** and a **print connector** do **not** gate go-live. **Not live** means **absent from customer discovery** and **unable to take customer orders or bookings**, though the venue remains fully usable internally. A live business can also be taken **offline**, which is distinct from **closing** it.
- **Profile and discovery.** Public fields — cuisine type, categories, contact, and cached average rating and rating count — power customer discovery (search and filter, and the map of closest venues).
- **Opening hours** per weekday.
- **Delivery settings**: enable/disable, **delivery method** (`Own delivery` or a connected third-party provider through the Owner/Admin-only **Delivery partner** section), **delivery radius**, **minimum order**, and **per-day delivery windows**.
- **Tax**: a single **business-level tax configuration** — a **rate per tax category** (Food, Non-alcoholic drinks, Alcoholic drinks, Merchandise, Tobacco, and Tip) — applied to orders and bills. Prices are **tax-inclusive**: the customer always sees the final price, and tax is computed on the amount actually paid after any discount. Gift-card **funding** is a deposit, not a taxed product sale; tax is taken on the goods (and tips) when a gift card is redeemed.
- **Metrics and targets**: target cost percentages (food, beverage, labour, fixed), **supplier-good waste thresholds** by budget impact, the **start day of the reporting week**, and a **KPI catalogue** — every named metric with its canonical formula, the **dimensions** it can be sliced by, and an industry **benchmark**.
- **Subscription**: the plan is held on the **Owner** and covers its venues (see [§11](#11-monetization)).

### People, roles, and scheduling

- **Employees** are the full membership of a user in a business. The **User** holds only client/global identity; job roles, employment status, contract, pay (gross for labour cost, net for HR), vacation, HR identifiers, documents, termination, and rehire all live on the membership. The employees subject is the source of truth for that record.
- **Roles and permissions** follow [§5](#5-access-roles-and-mode) and the access-and-permissions subject: five base layers, job roles on the membership, and per-user capability assignment by managers and above within the assignment rules.
- **Schedules** define each day's schedule (working shifts with required role and start/end, vacation and other leave, day comments, copy/bulk edit, time-off requests). Project Imperium enforces no overlapping shifts and correct vacation accounting, and rolls up daily staff, vacation, planned hours, and planned labour-cost totals. The schedules subject is the source of truth.
- **Time control** records actual attendance (daily attendance QR scan-in, manager sign-out, breaks, overtime) as described in [§6](#6-time-control-and-attendance).
- **Payroll** is **preparation and export only**: each venue configures pay periods and an accountant contact, assembles earnings from closed attendance plus pay terms, optionally pools tips, and **releases** a versioned CSV email for an external accountant or payroll provider. Project Imperium does not withhold taxes, file returns, or disburse wages. The payroll subject is the source of truth.

### Menu — business goods

- Business goods are what the venue **sells**: **simple items**, **recipe/ingredient-based items**, and **set menus / combos**.
- Configuration includes name, keyword, main/sub category, **tax category**, **on-menu state** and **availability state**, selling price, images, description, **preparation time**, and optional **add-ons** (shared across the menu).
- Project Imperium derives **cost** and **allergens** from the supplier goods a good is built from — simple items, recipe-based items, and combos — **live** as prices and stock change; the venue sets the **selling price** freely. Guests and staff see derived allergens on the catalogue, may **filter** the menu by allergen, and staff or self-channel filter-at-add stamps **guest allergen flags** on orders for kitchen and bar (business-goods, orders, and order-flow). Day-of **sold out** and **86** (manually unavailable) share one labelled availability model on POS and customer surfaces.

### Supply and purchasing

- **Suppliers** are the vendors a business buys from (profile, address, contacts, tax number, in-use state).
- **Supplier goods** are the purchasable items and the unit of stock: category, measurement unit, purchase unit and purchase math (quantity ↔ total price → price per measurement unit), **budget impact**, allergens, **par level** and **minimum required**, images, and in-use state.
- **Purchases** carry a goods request from a supplier through to what was received: supplier, date, purchasing employee, lines with **requested** and **delivered** quantities (supplier good, quantity, price), receipt identification, and optional documents. Inventory is incremented on receipt, per line. **One-time purchases** record ad-hoc expenses with no supplier and no supplier-good tracking. Editing a received purchase requires a **reason** and is **audited** (who, when, before/after values).

### Inventory and transfers

- **Inventory** is the venue's stock ledger: a **dynamic system count** per supplier good (risen by received purchases and transfers in, lowered by orders and transfers out, restored on cancellation) and **physical counts** performed by staff, each carrying a **deviation** for the **count period** it closes.
- Counts happen **whenever the venue decides** — Project Imperium sets no schedule; a submitted count is **locked**, and its **re-edit** requires manager/supervisor authority and an **operational reason** from the count re-edit catalogue, with an audit trail.
- A month's counts are aggregated into a **monthly resume**: a **manager closes** the month after reviewing it, and the month's closing count is taken on the **morning of the first day of the following month**. Closing locks the month; only a membership holding the **General Manager** or **Owner** job role reopens it, with a reason.
- Project Imperium surfaces **low-stock alerts** (below a good's **minimum required**) and **negative-stock alerts**, notified to the managers on duty, plus a **variance report** comparing theoretical usage (from recipes) against actual usage (opening + purchases + transfers in − transfers out − closing) and **waste** graded by budget impact. Waste is **derived from variance only** — there is no separate manual spoilage or waste log (inventories subject).
- **Inventory transfers** move supplier goods between **venues of the same Company only**, valued **at cost**, adjusting **both venues' inventories** and leaving a full **audit trail** (who, when, quantity, value). A transfer is not a sale and not a purchase and carries no tax. Manager-and-above authorization is required.

### Service — sales points, sessions, orders, billing

- **Sales points** represent where guests sit or are served: their **type** (Table, Room, Bar, Seat, Counter, Spot, Kiosk, the virtual Delivery point, or Other) and the **channels** they accept (dine-in and self-ordering on served points, kiosk, delivery). Each carries its **QR code** and printer routing; the point QR is never the **handover QR**. Open **staff tabs** are never auto-aged or auto-closed; employees manage their own tables, and open instances continue to block duty sign-out (sales-points-and-instances; time-control).
- **Floor plans** arrange those points (and printers and screens) on named venue levels with an uploaded or drawn background. Managers edit layout under Manage → Floor plans; day-of **POS** and **Host** show the sales-point map only. Delivery is never placed on a floor; kiosks may be. The floor-plans subject is the source of truth for placement and Service maps.
- **Opening** a sales point (from the POS floor map or list, or by scanning its QR) opens a **sales instance**. A served point holds **at most one open staff tab at a time**. Customer **QR self-ordering** on that point is blocked while a **staff tab** is open **or** the point shows a **reserved hold** (manual or reservation-assigned); the self-service channels (self-ordering, kiosk, delivery) pay to close and may run several at once where not blocked.
- **Orders** attach to the sales instance. Each order is one main good plus optional add-ons; promotions apply to the main good. Who created it, and in what role, is taken from the session. A self-service batch carries a **handover pass**; QR self-ordering hands over Ready items in parts, while kiosk and delivery hand over the whole batch once every slice is Ready.
- **Lifecycle**: add, transfer between tables, and — for managers and above — **cancel** (removing it and restoring inventory), **void** with a required **operational reason** (kept in reporting), and mark **invitation/complimentary** with a required operational reason. Manual discounts likewise require an operational reason. Catalogues are closed and platform-defined (operational reasons subject).
- **Billing**: review the tab, split bills as supported, then take **payments per method** with optional **tips on digital methods**, record the payment-method breakdown, and **close** the instance when all orders are paid. **Cash** is staff-tab only; self-service channels are digital only. Guests may share a tab across methods and times; the instance closes when the amount is covered or surpassed (cash: change or off-record keep; digital: change or recorded tip). Approved **refunds** require an operational reason from the refund catalogue.
- **Employee cash-out**: staff who take payments on staff tabs hold cash and electronic proofs themselves until a **supervisor or above** approves a **cash-out** against a resume (sales, voids, invitations, payment-method totals, cash movements, expected business cash). Optional **peer cash-in** (receiver-recorded) and always-on **house paid-in/out** move expected business cash with numbered receipts and notifications. Open tables block cash-out approval; uncashed activity and open instances block duty sign-out. Personal float is physical-only. Off-record cash tips are not taxed or pooled. The employee cash-out subject is the source of truth.
- **Customer bills and receipts** — the pre-settlement **bill** (staff tabs) and post-settlement **receipt** (every surface, including gift-card deposit receipts) carry required content, lifelong-per-venue **bill** and **receipt** numbers, reprint-same-number and replacement-supersedes rules. Batch identification codes may appear on the document but are not the fiscal number. A self-service receipt carries the **handover pass** and, for QR self-ordering and kiosk, the **handover QR**; a delivery receipt carries the **order reference** and no handover QR. The **review QR** is a separate block. Printers lay out and route paper; emails deliver the same receipt content. The receipts-and-bills subject is the source of truth.
- **Printers and screens** keep a **minimum venue kit** goal: the venue chooses how many phones, screens, and printers to run. Staff devices talk only to the cloud; **logical printers** bind through local **print connectors** (primary) or optional manufacturer cloud-print targets; Imperium hands print work to the connector, which alone reaches physical printers. The subject also owns routing by category, subcategory, and sales point; backup printers; per-employee print permissions; the optional **drawer kick** on money events with a per-staff **closing receipt printer override**; and configurable prep-area main/sub screens, a delivery screen with courier-request status and retry, a **handover scan**, and a customer pickup board. Fulfilment status advances per prep-area slice (**Sent → Preparing → Ready → Delivered**); a handover pass scan sets the selected Ready slices or the whole batch Delivered.
- The **first order send** or self-service **pay-to-commit** of the work day automatically opens the daily sales report (see Reporting).

### Payments and tax

- Payment **methods are recorded** for reporting: cash, card (Visa, Mastercard, American Express, Discover, Diners Club, Maestro), crypto (Bitcoin, Ethereum, Litecoin, Ripple, Cardano, Polkadot, Dogecoin), gift card, and other (Voucher, PayPal, Venmo, Apple Pay, Google Pay, Samsung Pay). **Cash** only on staff tabs; self-ordering, kiosk, and delivery are entirely digital.
- **Direct payment processing** on online, delivery, and QR / self-order uses **Stripe Connect** (venue merchant of record, one connected account per Business). Dine-in card stays on the venue's own reader and is recorded in Imperium. Split/partial payments, refunds, and provider-settled payouts apply on Imperium-processed channels. Recorded tips apply to digital tenders; cash tips stay off-record.
- **Tax** follows the business-level configuration above: a rate per tax category, applied to a tax-inclusive price. Platform-recorded tips use the Tip category.

### Promotions

- Promotion types: **percentage discount**, **fixed price**, **2×1**, **3×2**, **second item half price**, and **full complimentary**.
- A promotion is created **disabled** and turned on with an **enabled** switch; enabling is blocked when it would overlap in time another enabled promotion whose **menu subcategory** scope intersects it.
- Scoping: an **active period**, **daily hours**, **weekdays**, the **menu subcategories** they apply to, and an option to **apply to delivery**.
- Promotions are applied **in real time** as staff build an open tab or customers build a **pre-pay basket** (basket binds to the sales instance at pay).

### Gift cards

- **Gift cards** are issued and held by the **business**, identified by a **QR code** and a **card number**, and delivered as a **virtual card by email** — there is no physical card. They are a **bearer stored-value instrument** — whoever holds the card may spend it. A gift card carries an **issued value** and **remaining balance** in the business currency, is **non-reloadable**, supports **partial redemption**, is redeemable **only at the issuing venue**, and **expires** (remaining balance forfeited). A **paid** card is funded by a **standalone deposit checkout** (liability, no product tax); a **granted** card creates the same liability with no cash. Redemption is a **Gift card** payment on an ordinary bill: order lines stay paid and taxed by category; Invitation is not used for redeem. Card purchase refund is only for **fully unspent** cards; meal refunds may **restore** balance to the card. Minimum value and validity period are business configuration; intake, tender, forfeiture, and outstanding liability are recorded in reporting (gift-cards subject; ADR-0004). There is **no** User-linked gift-card wallet and **no** lost/stolen recovery flow (resend, replace identity, transfer); holders use the emailed virtual card, and managers void, grant, refund, or restore under the gift-cards subject.

### Reservations

- Reservations are a **booking layer** a venue may turn on or pause in business configuration. A **customer** requests from the Customer app (**Pending**); **Host and above** create on the web and may Accept in the same step. Host and above **Accept** (no deposit) or **Request deposit**; paying the deposit — or accepting without one — moves the booking to **Reserved** and sends confirmation by email.
- Lifecycle statuses: pending → awaiting deposit (when requested) → reserved → arrived → seated → completed, with cancelled, no-show, and awaiting table when assignment is lost. **Arrived** is required before **Seated**. Opening the first reservation-guest tab from **Reserved** advances **Reserved → Arrived → Seated** in one step; from **Arrived**, that open advances to **Seated** only.
- The guest sets **arrival time**; Host and above set an internal **end time** (not shown to the guest) and may assign **one or more** sales points with a hard no-overlap rule. Opening a reserved point asks **reservation guests** or **ordinary guests**; linked tabs each run their own orders and payments under the same reservation. A paid deposit appears as **shared credit** on linked tabs and is applied at bill time.
- Moving a reservation's assigned point moves its linked sales instance (and vice versa).

### Reports and metrics

- **Daily sales report** — opens automatically on the **first order send** or self-service **pay-to-commit** of the work day. It is **entirely app-calculated** from that day's instances, bills, and payments — never hand-edited. It accumulates **per-employee** buckets (staff-taken only) and **channel buckets** for **delivery**, **self-ordering**, **kiosk**, **gift-card** (deposit intake, grant, tender), and **forfeiture** (gift-card expiry or void-with-balance, and reservation deposit forfeit), plus **business totals** (total sales, net revenue, cost of goods, profit, customers served / covers, average spend, and a **commission estimate**), with operational breakdowns by employee, sales point/channel, payment method, and item. It also surfaces **staff cash collected**, cash-out / uncashed status, an operational audit of peer/house cash movements from the employee cash-out subject (no over/short P&L line; day close does not require cash-out), and a **delivery-integration status** per delivery batch (courier request, courier handover, completion source, and failed-call exceptions). Managers **close** it (no open orders on that day's instances); close locks the day and sweeps undelivered fulfilment — it does **not** charge commission and does **not** block on a failed courier call. A closed day must be **reopened** (with reason) before belonging bills or payments may change; after such a change, the bill, payment, and daily report carry an **edited** flag through the next close; weekly and monthly roll-ups amend and carry that reason. The whole daily report can be **exported**.
- **Weekly business report** — the operational roll-up for the venue's configured reporting week (sales, actual labour, food/beverage/labour targets, dimension breakdowns; fixed/extra/finance and inventory variance/waste excluded). Managers may view a **live mid-period** roll-up. It closes when the week has ended and every belonging daily is closed or never existed (waiting for late service past midnight, not clock midnight alone). On close it raises **report-ready**, and **finalises and owes** the week's **platform commission** for platform-billing to collect. The whole weekly report can be **exported**.
- **Monthly business report** — a **sales section** plus a **full P&L** (fixed/extra/finance entry, inventory variance and waste, purchasing, actual labour, break-even, net profit, EBITDA, all four cost targets and waste thresholds, full dimensions including supplier). Live mid-period view while open. Closes when the month has ended, belonging dailies are closed or absent, and the **inventory month** is closed; inventory reopen reopens it. Sums weekly commission charges; no separate monthly commission event. The whole monthly report can be **exported**.
- **Reporting exports** are available across daily, weekly, and monthly reports, powered by the shared advanced-table engine used as the blueprint for report tables.
- **Business metrics** — the full **KPI catalogue** (profitability, cost, sales quality, labour, inventory and purchasing, menu engineering, operations, customer, and promotion/bar controls), each with its canonical formula, supported **dimensions**, and an industry **benchmark**, plus the cost targets and waste thresholds — are defined in the business-metrics subject; the sales-reports subject owns the daily gathering and lock, and the business-reports subject owns how weekly and monthly figures are grouped, closed, and presented.

### Notifications and conversations

- Each user has an **inbox** with per-notification read and deleted state, shared by customers and employees through their user identity. Staff **conversation** threads for a venue also surface in that inbox for their participants.
- Delivery is **persistence-first** — in-app notifications are stored and are the source of truth — with **email** and **live WebSocket** push when the recipient is online. Nothing is lost if a user is offline. Staff conversation messages are **in-app only**.
- **Operational** events include reservations pending/deposit-requested/decided (and Awaiting table for Host and above), low-stock alerts, weekly/monthly report-ready, business profile updates, delivery-integration failures, and the overtime and sign-out-request alerts in [§6](#6-time-control-and-attendance).
- **Engagement** broadcasts let a venue message its customers — **promotions, birthdays, and events** — only when marketing consent is on and engagement mute is off.
- **Staff conversations** (one-to-one and group among Active Employees of the same Business) and the optional **manager-to-customer one-shot email** are owned by the conversations subject. Customers do not chat with the venue in-product; they use **reviews**.

---

## 8. The Customer app

The Customer app is the free, **public default** side of Project Imperium — the venue's customers and the product's landing surface. Sign-in is optional for browsing and for assembling an order.

- **Public browse.** Anyone may use discovery and public venue profiles **without an account**. Sign-in and sign-up are offered from the chrome; after authenticating, the person remains on the Customer surface.
- **Guest ordering until identity at payment.** A visitor may navigate customer ordering surfaces and **build a basket** without signing in. They may **Clear basket** to start fresh in the same ordering session. After five minutes idle, a **still-there** prompt appears; two more minutes unanswered ends the unpaid session with no instance or payment (order-flow). Project Imperium asks for **sign-in or sign-up** when **payment** is requested (and for other **account-bound** actions). The open basket is **preserved** across that identity step. Account-bound actions include favorites, inbox, order history, and other preferences owned by the User — not only payment.
- **Account.** Sign up and sign in from the chrome avatar (accepting the **privacy notice** and account terms); manage profile, address, saved payment methods, email, notifications, **marketing consent**, and **Download my data** in the **customer account area**. Verify email and reset password. Every user is a customer. Privacy, consent, and DSAR rules belong to that subject.
- **Discovery.** Find live venues in either of two ways: **search and filter** (by name, cuisine type, categories, rating, and location / geo radius), or a **map of the closest venues** near the customer. From either path, open a venue's public profile and menu.
- **Ordering across every service surface**: **QR self-ordering** at a table (delivered to the QR point), **kiosk** ordering (counter pickup), and **delivery** (to an address), with optional **to-go packaging** on dine-in and self-service. Self-channel orders are paid **in-app** via **Stripe Connect** (venue merchant of record; payments-and-tax) before the order commits. QR and kiosk receipts carry a **handover QR**; a delivery receipt carries an **order reference** and no handover QR.
- **Reservations.** Request a table (when the venue accepts bookings), pay a deposit when asked, and track status (signed-in; reservations subject).
- **Ratings and comments.** After a closed, settled sales instance, leave a venue **review**: a **0–5 star** score with optional text. Invites arrive via the **review QR**, a delivery review email, or order history. The ratings-and-comments subject is the source of truth.
- **Favorites.** Save **venues** for quick access (per-user bookmarks; owned with the users subject) — signed-in only.
- **Gift cards.** Buy a gift card for themselves or for someone else, receive the virtual card by email (QR and card number), and redeem at the issuing venue before expiry. There is no signed-in gift-card wallet (gift-cards subject).
- **Order history and receipts**, delivered in-app and by email, including the self-service **handover pass** where the receipt carries one — signed-in only.
- **Notifications** in the same inbox model, including venue engagement **broadcasts** only when **marketing consent** is on and engagement mute is off — signed-in only.
- **Mode toggle.** When the signed-in user has eligible business access, a **Customer | Business** control in the chrome switches mode (schedule permitting — see [§5](#5-access-roles-and-mode)). There is no third mode.
- **Real-time order status**, updated live.

---

## 9. The Superadmin console

The Superadmin console runs the **application business** — Project Imperium itself — not any venue. It is a **separate web app** with its own authentication realm (separate credentials, mandatory MFA, enrollment for Imperium staff), distinct from Customer and Business sessions and never offered as a third mode on the Customer \| Business chooser. Console operators hold console roles **Staff**, **Manager**, or **Owner** (Manager and console Owner share the same tools; console Owner marks ownership of the Imperium app).

- **Owner account management.** Superadmin manages paying **Owners**: subscription and commission terms, manual suspend/resume, soft delete (operators never hard-delete), visibility into Companies and Businesses beneath each Owner. Ordinary go-live is not Superadmin-approved — required fields and paid-in-full on a paid plan belong elsewhere. Late-payment dunning and automatic **freeze** belong to monetization and platform-billing (console operators may override deadlines and see freeze state).
- **Plan catalogue.** Management of the subscription plan catalogue — including creation quotas and platform retention constants owned by the plan quotas and data retention subject — and force-assignment of plans to Owners. Term changes email affected Owners, who must accept or decline and terminate.
- **Delivery provider catalogue.** Global third-party courier providers and their country/region availability, maintained by the console; each Business connects at most one through its Owner/Admin-only Delivery partner settings (delivery-integrations subject).
- **Commission configuration.** Base commission per plan (no one-off per-Owner rates outside Enterprise custom terms; no card-recovery pass-through in stage 1).
- **Feature flags** platform-wide and per-Owner (named catalogue, kill-switch outcomes, and composition with plan entitlements belong to the feature-flags subject; Superadmin owns console toggle powers).
- **Support tooling**, including scoped impersonation (one User, one Business, time-bounded, audited) and the review abuse-removal queue — not a general helpdesk.
- **Portfolio analytics** across Owners and venues (not day-of POS detail). Stage 1 Imperium-processed payments use **Stripe Connect** only (payments-and-tax; ADR-0005) — there is no Superadmin payment-provider catalogue or venue choice among integrated processors.
- Superadmin manages **Owners and their Businesses**; it never operates a venue's day-to-day service.

---

## 10. Real-time and communication

Project Imperium is **live by design**: every entitled open screen in the Customer app, Business app, and Superadmin console works on **current server truth**. The realtime-and-concurrency subject is the source of truth for live surfaces, reconnect, **stale actions**, and conflict rules (send, pay, fulfilment, **ordering-session** isolation). Operationally this means:

- POS, Host occupancy, fulfilment, stock, inbox, customer order status, Manage, Superadmin, and public browse while viewing all update live — not only a short list of day-of surfaces.
- When the connection drops, mutating actions are **blocked** until reconnect and resync; there is no offline write queue (online-only).
- In-app notifications are persisted first, then pushed live over WebSocket, so online users see them instantly and offline users see them on return (notifications subject; ADR-0006).
- Email is best-effort and is **not** a live surface; noisy events (low-stock, overtime) use cooldown and repeat-suppression on the notification side.
- Concurrent writes never silently last-write-wins on checks or payments: stale actions, same-attempt replay, and lifecycle blocks apply (realtime-and-concurrency; ADR-0006).

---

## 11. Monetization

- **Businesses pay; customers are free.**
- **Subscription.** An **Owner** subscribes to a **tiered plan** — **Free, Basic, Premium, Enterprise** — managed from the Superadmin catalogue. The plan covers the Owner's venues (one **country** per Owner) and determines which **ops** features are available. Selling channels (dine-in, self-ordering, kiosk, delivery) are available on every plan. Catalogue prices, rates, and entitlements are Superadmin-configurable; the monetization subject is the source of truth for the matrix and commercial rules. Paid plans are **prepaid on the first of each calendar month** (mid-month start is prorated prepaid; mid-month plan-price true-up lands on the next first); collection mechanics belong to platform-billing.
- **Commission.** A reporting week's fee is **base commission** only (plan rate × all **commissionable sales**). Commissionable sales are paid product sales after voids and refunds across all payment methods, including sales paid with gift card; invitations, gift-card deposit intake, forfeitures, and **tips** are excluded. The week is **finalised and owed** when that week's **business report closes**, then **collected** by platform-billing (Owner method on file or invoice) — never netted out of what the venue's customers paid. Until that close, daily and open weekly reports show an **estimate** only. Weekly commission applies on **every** plan, including Free.
- **Arrears.** After a configurable grace period, Project Imperium automatically flags overdue subscription or weekly commission, emails and notifies with the amount due, the consequences of non-payment, and the payment deadline. Past that deadline: subscription arrears **freeze** the whole Owner portfolio; a venue's weekly commission arrears **freeze only that venue**. A frozen venue is hidden from the public and blocked for normal operation until paid. Dunning copy may describe this as suspension; the product state is **freeze**. Manual **suspend** of a paying Owner is a separate Superadmin action. Platform-billing runs daily dunning with a named cut-off date and two weeks of post-freeze pay-to-restart reminders.

---

## 12. Platforms and constraints

- **Responsive web app.** Project Imperium runs in any modern browser on desktop, laptop, tablet, or phone. There is currently no installable PWA requirement and no native app; a native version may follow later using the same logic.
- **Staff on personal or venue devices.** Every staff actor signs in with their own email and password on a personal or venue-provided browser device. Each browser session is **one User only**. One User may hold several concurrent peer sessions across devices. Shared staff login, staff PIN, quick-switch, and in-app lock-screen identity are **out of scope** (staff-sessions subject).
- **Venue output and guest hardware.** The venue chooses a **minimum kit** it is comfortable with: optional printers, optional prep/customer screens, optional customer kiosk terminals, and — when paper uses ordinary local printers — one or more **print connectors** on always-on local devices. Project Imperium sells none of them, imposes no counts or brands, and does not require a connector when the venue is not printing that way. Those surfaces do not replace each staff actor’s own signed-in session.
- **Online-only.** Connectivity is required; there is no offline mode.
- **Language and currency.** The UI ships in **English and Spanish** (more UI languages later); each business selects **one currency** at onboarding. **Menu content languages** beyond a single authored language per field are **deferred** to a future **menu localisation** subject — stage 1 does not keep or serve business-authored menu text in more than one language, and does not translate it.

---

## 13. What Project Imperium is not

- **Not only a point-of-sale.** The point of sale is one surface; Project Imperium also runs the menu and its costing, supply and stock, people and scheduling, and reporting.
- **Not proprietary hardware.** Project Imperium does not lock venues to a specific device, printer, screen, or print-connector box, sells no hardware, and does not impose how many devices a venue must run.
- **Not a hardware vendor.** Project Imperium is software only; the optional print connector is a helper the venue runs, not hardware Imperium sells.
- **Not shared-staff-login POS.** Venue-provided staff devices are allowed, but there is no shared station login, staff PIN, quick-switch, or in-app lock that changes who is acting. Each browser session is one signed-in User (staff-sessions subject).
- **Not offline.** There is no offline mode; the product is online-only.
- **Not a multi-vendor marketplace.** Customers order from a specific venue; delivery is per-venue, not a marketplace spanning venues.
- **Not self-hosted.** There is no on-premise or self-managed deployment; Project Imperium is cloud SaaS.
- **Not a full alcohol-compliance pack in stage 1.** Self-channel age floors exist (privacy and order-flow); ID-at-table, ID-at-delivery, and per-country age-assurance packs are deferred to a future **alcohol and age-assurance service compliance** subject.
- **Not multilingual menu content in stage 1.** UI English/Spanish only for chrome; dual-language menu fields wait on a future **menu localisation** subject.

(Direct payment processing and delivery **are** in scope — Imperium-processed payments via **Stripe Connect** in stage 1; last-mile delivery via a connected third-party courier provider or the venue's own delivery method.)
