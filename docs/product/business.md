# Business details

> **About this document.** This is the **target-state source of truth** for a business's own onboarding, profile, and configuration in Project Imperium. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes business details as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **Business** — the tenant, one venue — as a thing the platform sets up, profiles, and publishes. It owns:

- **registering a business** (presented to users as *add your venue*) as an existing user, the **draft** lifecycle, and **go-live**;
- the **profile identity** — trade name, legal name, logo, primary contact, phone, and business contact email (the venue's **Company** holds its tax number);
- **currency** — the single currency a business prices in;
- the **address** and the **timezone derived from it**;
- **opening hours**;
- **delivery configuration**;
- **self-ordering configuration** — whether the venue allows QR self-ordering at all;
- the **discovery fields** that make a business visible and findable to customers;
- the **subscription pointer** — the read-only link from a business to the plan held on its **Owner**;
- **offline** and **closure** of the tenant record.

It deliberately does **not** cover:

- the **Owner** account, the **Company** and its **tax number**, the **subscription** itself, and **commission terms** — the users subject owns the **Owner** and the **Company**; the superadmin subject owns the plan catalog and commission configuration. This subject only shows the effective plan read-only, and stores the venue's link to its Company.
- **tax applied to orders and bills** — the business-level tax configuration (a rate per tax category) belongs to the payments-and-tax subject.
- **payroll configuration** — pay-period cadence, accountant contact, and tip-pool policy — the payroll subject owns those settings and the pay runs they drive.
- the **meaning, defaults, validation, and comparison of the cost targets, waste thresholds, and reporting configuration** — the business-metrics subject owns those, and the business-reports subject owns the reports that consume them. This subject stores the values as business fields but does not define them.
- **sign-in credentials and verification mechanics** — sign-in email verification, email change, and password reset belong to the users and emails subjects. This subject owns the *business contact email* field; the emails subject owns how its verification link is delivered.
- the **owner shell, mode toggle, Service / Manage / Me left menu, guards, and canonical destinations** — the user-navigation subject owns those surfaces. This subject owns the *business-registration action* and the business form; the navigation that reaches them is the user-navigation subject's.
- the **sales points, sales instances, and ordering/delivery mechanics** — the order-flow and sales-points-and-instances subjects own how customers order, which points accept which channels, and how delivery is dispatched. This subject owns delivery and self-ordering *configuration* at the venue, not order placement.
- **ratings and comments** themselves — the ratings-and-comments subject owns them; this subject owns the cached aggregates they publish.
- **people, schedules, printers, and screens** — their own subjects.

---

## 2. Domain model and vocabulary

### Entities

- **Business** — the tenant: **one venue** (one physical restaurant or bar). Owned by exactly one user through that user's **Owner**, and belonging to exactly one **Company** (the tax entity). Carries its own profile identity, address, currency, opening hours, delivery configuration, self-ordering configuration, discovery fields, and **go-live state**. It holds **no credentials** — sign-in credentials belong to the **User**; the business holds only its verified **contact email**.
- **Company** — the tax entity a business belongs to (owned by the business's **Owner**). Groups one or more venues run as one legal unit and holds their **tax number**; stock moves only within a Company. The users subject owns the Company; this subject records which Company a venue belongs to.
- **Owner** — the portfolio account a business hangs off (one per user who owns businesses). Holds the **Companies** it controls and the **subscription**. A business **references its Owner's plan read-only**; it never stores a subscription of its own.
- **Address** — the structured postal address (country, state, city, street, building number, optional unit, complement, post code, region, and details). Its **country and state derive the timezone**, and its **coordinates are the discovery origin**.
- **Opening hours** — the venue's weekly operating hours: **per weekday, zero or more time ranges**.
- **Delivery windows** — **per-weekday delivery time ranges**.
- **Logo** — the business's **single** image, its public storefront mark.

### Terms this subject introduces

- **Draft** — a business that has been registered and can be saved and edited, but is **not yet live**.
- **Go-live** — making a business **live**: the server confirms the **go-live checklist** is complete, then an admin/owner flips the **go-live toggle**.
- **Offline** — a live business deliberately withdrawn from discovery and customer orders, retaining all its data and its Owner link. **Offline is not closure.**
- **Go-live checklist** — the fields and conditions that must hold before a business may go live.
- **Completeness signal** — the profile-read output naming which checklist items are still missing.
- **Currency** — the single currency a business prices in.
- **Discovery fields** — the public fields that power customer discovery.
- **Delivery radius**, **minimum order**, **delivery windows** — the delivery configuration terms.
- **Self-ordering enabled** — whether the venue allows QR self-ordering at all (points must still accept the Self-ordering channel).
- **Subscription pointer** — the read-only reference from a business to the plan held on its **Owner**.

The business contact email is a term the users subject introduces; this subject owns it as a business field. "Venue" is prose for one **Business**.

---

## 3. Capabilities

### 3.1 Registering a business

Registering a business is an **authenticated action by an existing user** — there is no unauthenticated business registration. The UI presents it as **add your venue**.

- A user with **no business** reaches the action from the customer app; a user who **already owns businesses** reaches it from the business app's venue tabs (typically from **Manage**).
- Registering a user's **first business creates that user's Owner** and a **Company**; each later business is added to that Owner and the user chooses whether it **joins an existing Company** (sharing that tax entity, so stock can move internally) or **forms a new one** (a separate taxpayer).
- Every Business under one Owner must be in the **same country** as that Owner's portfolio (currency and tax regime stay aligned). A venue in another country cannot join that Owner.
- A business is **owned by exactly one user**; the owner takes the **Owner job role** and the **admin** base layer at that venue.
- After sign-in, a user who owns businesses may switch to **business mode** via the **Customer | Business** toggle and work in Manage (or Service); a user who owns none stays on the customer surface with no Business side on the toggle. These surfaces belong to the user-navigation subject; this subject owns the action and the form behind them.

### 3.2 The draft lifecycle

A newly added business begins as a **draft**.

- A draft can be **saved incomplete** and returned to later; the platform never forces a complete profile in one sitting.
- Only a **trade name** is needed to create the record. Every other field is optional at save time and may be filled in **any order, across visits**.
- The fields the go-live checklist names are **required for go-live, not for saving a draft**.
- An admin/owner at the venue may edit a draft freely.

### 3.3 Profile identity

A business carries its public and legal identity:

- **Trade name** — the public-facing name. Required for go-live.
- **Legal name** — the registered legal entity behind the venue. Required for go-live; uniqueness is enforced **per country among active businesses** (the same legal entity name may exist in different countries).
- **Logo** — a **single** optional image. Replacing it discards the previous asset. It is the venue's mark in discovery.
- **Primary contact** — an optional contact person for the venue.
- **Phone** — the venue's contact phone. Required for go-live.
- **Business contact email** — the venue's own verified email for venue messages and receipts. Required for go-live and **must be verified**. It is **never a credential**.
- **Tax number** — the tax identifier held on the venue's **Company**. Required for go-live; uniqueness is enforced **among active Companies in the same country** (the country of the Company's venues), so two venues sharing one Company share one tax number.
- **Seat count** and **floor area** — optional venue attributes that feed the revenue-per-seat-hour and sales-per-floor-area metrics; neither gates go-live.
- The **sign-in email and password are not part of the business profile** — they belong to the **User**.

### 3.4 Currency

A business prices in **exactly one currency**, chosen from the platform's supported currencies at onboarding.

- Currency is chosen **once** and is **immutable once the business has any financial record** (an order, a purchase, a report).
- While the business is **pristine** — no financial records exist — the currency may still be corrected.
- Currency is otherwise **not editable** from general settings.

### 3.5 Address and timezone

- A business has a **structured postal address**. **Country and state are the fields that matter for timezone.**
- The business's **timezone is derived from the address** (country + state) and is **never chosen by the user**. It is recomputed whenever the address changes and exposed on the profile **read-only**.
- When no zone can be derived — or a stored zone is invalid — the profile **resolves to UTC** and surfaces a **timezone-default prompt** so the venue knows to correct its address.
- The address **coordinates** are the **discovery origin** a customer's location search measures from.
- The timezone governs every business-local date and time the platform interprets (reports, opening hours, delivery windows).

### 3.6 Opening hours

- Opening hours are defined **per weekday** (Sunday through Saturday), and each day holds **zero or more time ranges**. A day with **no ranges is closed**.
- Multiple ranges per day are supported (for example a lunch service and a dinner service); ranges **may cross midnight**.
- Opening hours are expressed in the **business timezone**.
- Opening hours are the venue's operating schedule; they are **distinct from delivery windows**.

### 3.7 Delivery configuration

Delivery is a **per-venue** configuration.

- **Enable/disable** — a venue turns delivery on or off.
- **Delivery radius** — the distance a venue delivers within, measured in **kilometres**.
- **Minimum order** — the smallest order value accepted for delivery, expressed in the **business currency**.
- **Delivery windows** — **per-weekday** time ranges during which the venue delivers.
- When delivery is enabled, the venue gains its **virtual delivery sales point** — the sales point that represents delivery in service. The order-flow and sales-points-and-instances subjects own how delivery orders are placed and dispatched; delivery is **per-venue**, never a cross-venue marketplace.

### 3.8 Self-ordering configuration

Self-ordering is a **per-venue** switch.

- **Enable/disable** — a venue turns QR self-ordering on or off for the business as a whole.
- Table self-ordering still requires each **sales point** to accept the **Self-ordering** channel, and is blocked while a staff tab is open on that point or the point shows a **reserved hold** — the sales-points-and-instances and order-flow subjects own those gates.
- Kiosk and delivery have their own point and delivery-configuration gates; this switch governs **QR self-ordering** at served points.

### 3.9 Discovery fields

A business is **discoverable only while live**. Its discovery fields are:

- **Trade name**, **logo**, **cuisine type(s)**, **categories**, **contact phone**, and **address** (with its coordinates as the geo origin).
- The **average rating and rating count** are server-owned cached aggregates, published by the ratings-and-comments subject. A client never sets them.
- **Cuisine type and categories are edited by managers and above** at the venue; they are among the filters customers use. The identity discovery fields (trade name, logo, phone, address) are edited by admins/owners.
- Customers find live venues in either of two ways: **search and filter** (trade name, cuisine type, categories, rating, and location / geo radius), or a **map of the closest venues** near them. A customer's location search and the closest-venues map both measure from the address coordinates.

### 3.10 Subscription pointer

- The **subscription is held on the Owner** and covers the owner's venues.
- A business carries **no subscription field of its own**; it exposes the **effective plan read-only** so the venue can see what its Owner's plan provides.
- Which features a plan unlocks is the **monetization** subject's concern; this subject only surfaces the plan.
- On a **paid** plan, go-live also requires the Owner's subscription **paid-in-full** for the period (monetization subject); Free has no subscription invoice gate.

### 3.11 Go-live, live, and offline

A business's own state is server-owned. Its go-live status has three states — **ready to go live**, **live**, and **not live** — moved between by an admin/owner using the **go-live toggle**.

- **Ready to go live.** The server computes readiness as: the **go-live checklist is complete** (which includes a **verified business contact email**), and — on a **paid** Owner plan — the subscription is **paid-in-full** for the period (monetization subject). Free has no subscription invoice gate.
- **The go-live toggle.** When the server reports the business ready, an **admin/owner** flips the go-live toggle to make it **live**. The same toggle takes a live business **offline**.
- **Live means** the business is **discoverable** and **able to take customer orders and bookings**.
- **Not live means** the business is **absent from customer discovery** and **cannot take customer orders or bookings**. Staff can always work in the business app meanwhile — a draft and an offline business are fully usable internally.

The **go-live checklist** is:

| Group | Items |
| --- | --- |
| **Identity / contact** | Trade name, legal name, phone, the **Company's tax number**, currency, address (so the timezone resolves), and a **verified business contact email**. |
| **Service** | **Opening hours** (at least one day with at least one range) and **at least one cuisine type** (so the venue can be discovered). |
| **Payments** | **Stripe connected payment account** able to **accept charges and receive payouts** (payments-and-tax; required on Free and paid — delivery and self-order are stage-1 channels). |
| **Conditional** | When delivery is enabled: delivery radius, minimum order, and at least one delivery window. |
| **Not gating** | Logo, categories, primary contact, metrics, and delivery when disabled. |

The **profile read exposes the completeness signal** — which checklist items are missing — so the settings surface can show what remains and the go-live toggle can be disabled with reasons.

### 3.12 Closure

- Closing a business is a **deliberate soft delete** of the tenant record. It is **not** the same as going offline.
- Closure requires **no open sales instances** and an **explicit confirmation**. Operators do not physically remove operational data on close; records are retained and marked deleted (ADR-0003). Later physical removal of soft-deleted venue data follows the plan quotas and data retention subject under the **data-integrity rule**.
- A closed business leaves discovery and stops taking customer orders; the platform does not silently destroy data other people depend on.

### 3.13 Dormant businesses

A venue with no qualifying **venue activity** for a long window may be soft-deleted after Owner notice and no confirmation. Activity definition, windows, and purge afterward belong to the plan quotas and data retention subject. Deliberate closure (§3.12) remains the Owner-driven path.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Business-detail powers |
| --- | --- |
| **Customer** | Sees a business's public discovery fields. May **register a business**, becoming its owner and an **admin** at that venue; may edit everything at a venue they own. |
| **Employee** | Works in the business app; no business-detail editing unless granted. |
| **Manager** | Everything an employee can do, plus editing **opening hours**, **delivery configuration**, **self-ordering configuration**, and the **discovery cuisine/categories**. |
| **Admin** | Full venue control, including the **profile identity**, **legal name**, **currency**, **contact email**, the **go-live toggle**, and **closure**. |

The owning user is admin at every venue they own. Job roles and per-user capabilities follow the global model; this subject names only the entitlements that bear on business details.

### Who can do what

| Activity | Who |
| --- | --- |
| Register a business | Any signed-in user (becomes the **Owner** and an admin at that venue) |
| Edit trade name, logo, primary contact, phone | Admin/owner |
| Edit legal name, currency, business contact email | Admin/owner |
| Edit opening hours, delivery configuration, self-ordering configuration, discovery cuisine/categories | Managers and above |
| Flip go-live / take a venue offline | Admin/owner |
| Close a business | The owning user (admin/owner) |
| Confirm a dormant business should stay live | The owning user (Owner), per plan quotas and data retention |
| View published discovery fields | Anyone (public) |
