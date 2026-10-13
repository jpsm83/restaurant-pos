# Business details

> **About this document.** This is the **target-state source of truth** for a business's own onboarding, profile, and configuration in POS. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes business details as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **`Business`** — the tenant, one venue — as a thing the platform sets up, profiles, and publishes. It owns:

- **registering a business** (presented to users as *add your venue*) as an existing user, the **draft** lifecycle, and **go-live**;
- the **profile identity** — trade name, legal name, logo, primary contact, phone, business contact email, and tax number;
- **currency** — the single currency a business prices in;
- the **address** and the **timezone derived from it**;
- **opening hours**;
- **delivery configuration**;
- the **discovery fields** that make a business visible and findable to customers;
- the **subscription pointer** — the read-only link from a business to the plan held on its `Owner`;
- **offline** and **closure** of the tenant record.

It deliberately does **not** cover:

- the **`Owner`** account, the **subscription** itself, and **commission terms** — the users subject owns the `Owner`; the superadmin subject owns the plan catalog and commission configuration. This subject only shows the effective plan read-only.
- **tax applied to orders and bills** — the single business-level tax configuration belongs to the payments-and-tax subject.
- the **meaning, defaults, validation, and comparison of the cost targets, waste thresholds, and reporting configuration** — the business-metrics subject owns those, and the business-reports subject owns the reports that consume them. This subject stores the values as business fields but does not define them.
- **sign-in credentials and verification mechanics** — sign-in email verification, email change, and password reset belong to the users and emails subjects. This subject owns the *business contact email* field; the emails subject owns how its verification link is delivered.
- the **owner shell, mode chooser, route guards, and canonical URLs** — the user-navigation subject owns those surfaces. This subject owns the *business-registration action* and the business form; the navigation that reaches them is the user-navigation subject's.
- the **sales points, sales instances, and ordering/delivery mechanics** — the order-flow and sales-points-and-instances subjects own how customers order and how delivery is dispatched. This subject owns delivery *configuration*, not order placement.
- **ratings and comments** themselves — the ratings-and-comments subject owns them; this subject owns the cached aggregates they publish.
- **people, schedules, printers, and screens** — their own subjects.

---

## 2. Domain model and vocabulary

### Entities

- **`Business`** — the tenant: **one venue** (one physical restaurant or bar). Owned by exactly one user through that user's `Owner`. Carries its own profile identity, address, currency, opening hours, delivery configuration, discovery fields, and **go-live state**. It holds **no credentials** — sign-in credentials belong to the `User`; the business holds only its verified **contact email**.
- **`Owner`** — the portfolio account a business hangs off (one per user who owns businesses). Holds the businesses it controls and the **subscription**. A business **references its Owner's plan read-only**; it never stores a subscription of its own.
- **`Address`** — the structured postal address (country, state, city, street, building number, optional unit, complement, post code, region, and details). Its **country and state derive the timezone**, and its **coordinates are the discovery origin**.
- **`BusinessOpeningHours`** — the venue's weekly operating hours: **per weekday, zero or more time ranges**.
- **`DeliveryOpeningWindows`** — **per-weekday delivery time ranges**.
- **`Logo`** — the business's **single** image, its public storefront mark.

### Terms this subject introduces

- **Draft** — a business that has been registered and can be saved and edited, but is **not yet live**.
- **Go-live** — making a business **live**: the server confirms the **go-live checklist** is complete, then an admin/owner flips the **go-live toggle**.
- **Offline** — a live business deliberately withdrawn from discovery and customer orders, retaining all its data and its Owner link. **Offline is not closure.**
- **Go-live checklist** — the fields and conditions that must hold before a business may go live.
- **Completeness signal** — the profile-read output naming which checklist items are still missing.
- **Currency** — the single currency a business prices in.
- **Discovery fields** — the public fields that power customer discovery.
- **Delivery radius**, **minimum order**, **delivery windows** — the delivery configuration terms.
- **Subscription pointer** — the read-only reference from a business to the plan held on its `Owner`.

The business contact email is a term the users subject introduces; this subject owns it as a business field. "Venue" is prose for one `Business`.

---

## 3. Capabilities

### 3.1 Registering a business

Registering a business is an **authenticated action by an existing `User`** — there is no unauthenticated business registration. The UI presents it as **add your venue**.

- A user with **no business** reaches the action from the customer app; a user who **already owns businesses** reaches it from the business app's venue tabs.
- Registering a user's **first business creates that user's `Owner`**; each later business **appends to the same `Owner`**, giving a multi-venue portfolio.
- A business is **owned by exactly one user**; the owner takes the **Owner job role** and the **admin** base layer at that venue.
- On sign-in, a user who owns businesses is routed through the **mode chooser** and may work in either the customer or the business app; a user who owns none is taken to the customer app. These surfaces belong to the user-navigation subject; this subject owns the action and the form behind them.

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
- **Tax number** — the venue's tax identifier. Required for go-live; uniqueness is enforced **within the business's country among active businesses**.
- The **sign-in email and password are not part of the business profile** — they belong to the `User`.

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

### 3.8 Discovery fields

A business is **discoverable only while live**. Its discovery fields are:

- **Trade name**, **logo**, **cuisine type(s)**, **categories**, **contact phone**, and **address** (with its coordinates as the geo origin).
- **`averageRating` and `ratingCount` are server-owned cached aggregates**, published by the ratings-and-comments subject. A client never sets them.
- **Cuisine type and categories are edited by managers and above** at the venue; they are the filters customers browse. The identity discovery fields (trade name, logo, phone, address) are edited by admins/owners.
- A customer's location search measures from the address coordinates.

### 3.9 Subscription pointer

- The **subscription is held on the `Owner`** and covers the Owner's venues.
- A business carries **no subscription field of its own**; it exposes the **effective plan read-only** so the venue can see what its Owner's plan provides.
- Which features a plan unlocks is the superadmin subject's concern; this subject only surfaces the plan.

### 3.10 Go-live, live, and offline

A business's own state is server-owned. Its go-live status has three states — **ready to go live**, **live**, and **not live** — moved between by an admin/owner using the **go-live toggle**.

- **Ready to go live.** The server computes readiness as: the **go-live checklist is complete** (which includes a **verified business contact email**).
- **The go-live toggle.** When the server reports the business ready, an **admin/owner** flips the go-live toggle to make it **live**. The same toggle takes a live business **offline**.
- **Live means** the business is **discoverable** and **able to take customer orders and bookings**.
- **Not live means** the business is **absent from customer discovery** and **cannot take customer orders or bookings**. Staff can always work in the business app meanwhile — a draft and an offline business are fully usable internally.

The **go-live checklist** is:

| Group | Items |
| --- | --- |
| **Identity / contact** | Trade name, legal name, phone, tax number, currency, address (so the timezone resolves), and a **verified business contact email**. |
| **Service** | **Opening hours** (at least one day with at least one range) and **at least one cuisine type** (so the venue can be discovered). |
| **Conditional** | When delivery is enabled: delivery radius, minimum order, and at least one delivery window. |
| **Not gating** | Logo, categories, primary contact, metrics, and delivery when disabled. |

The **profile read exposes the completeness signal** — which checklist items are missing — so the settings surface can show what remains and the go-live toggle can be disabled with reasons.

### 3.11 Closure

- Closing a business is a **deliberate soft delete** of the tenant record. It is **not** the same as going offline.
- Closure requires **no open sales instances** and an **explicit confirmation**. It **never hard-deletes operational data**; the records are retained and marked deleted (see ADR-0003).
- A closed business leaves discovery and stops taking customer orders; the platform does not silently destroy data other people depend on.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Business-detail powers |
| --- | --- |
| **Customer** | Sees a business's public discovery fields. May **register a business**, becoming its owner and an **admin** at that venue; may edit everything at a venue they own. |
| **Employee** | Works in the business app; no business-detail editing unless granted. |
| **Manager** | Everything an employee can do, plus editing **opening hours**, **delivery configuration**, and the **discovery cuisine/categories**. |
| **Admin** | Full venue control, including the **profile identity**, **legal name**, **tax number**, **currency**, **contact email**, the **go-live toggle**, and **closure**. |

The owning user is admin at every venue they own. Job roles and per-user capabilities follow the global model; this subject names only the entitlements that bear on business details.

### Who can do what

| Activity | Who |
| --- | --- |
| Register a business | Any signed-in user (becomes the `Owner` and an admin at that venue) |
| Edit trade name, logo, primary contact, phone | Admin/owner |
| Edit legal name, tax number, currency, business contact email | Admin/owner |
| Edit opening hours, delivery configuration, discovery cuisine/categories | Managers and above |
| Flip go-live / take a venue offline | Admin/owner |
| Close a business | The owning user (admin/owner) |
| View published discovery fields | Anyone (public) |

---

## 5. Current vs target

*The only place current status is recorded.*

### What exists today

**Models** (`backend/src/models/`):

- `business.ts` — the tenant, carrying: `tradeName`, `legalName`, `imageUrl`, `email`, `phoneNumber`, `taxNumber` (globally unique), `currencyTrade`, an **editable `subscription`**, derived `timezone`, `address`, `metrics`, `contactPerson` (free text or an employee reference), discovery fields (`cuisineType`, `categories`, cached `averageRating`/`ratingCount`), delivery fields (`acceptsDelivery`, `deliveryRadius`, `minOrder`, `deliveryOpeningWindows`), **single-range-per-day** `businessOpeningHours`, and `reportingConfig`. It also carries its **own credentials** — `password`, `emailVerified`, `verificationToken`, `resetPassword*`, `pendingEmail*`, and `refreshSessionVersion` — and logs in with role `"Tenant"`.
- `address.ts` — the structured address, with optional `coordinates`.

**Schemas** (`packages/schemas/business.ts`, `packages/interfaces/IBusiness.ts`):

- `createBusinessBodySchema` and `updateBusinessBodySchema` make the identity fields **required at save**, accept an editable **`subscription`**, and carry no go-live, live/offline, draft, currency-lock, or multi-range-hours concept. `IBusiness` includes `password`, `subscription`, and credential fields.

**Routes** (`backend/src/routes/v1/business.ts`):

- `GET /business` — public discovery (cuisine, categories, name, rating, geo radius via haversine over address coordinates).
- `GET /business/:businessId` — authenticated profile read; resolves a missing/invalid zone to UTC with a `timezoneIsDefault` flag.
- `POST /business` — creates a **`Business` only** (no `User`/`Owner`/membership), issues a `"Tenant"` session, and duplicate-checks `legalName`, `email`, and `taxNumber` **globally**.
- `PATCH /business/:businessId` — profile update; **subscription is editable**, and the timezone is re-derived from the address.
- `DELETE /business/:businessId` — a **hard cascade** deleting the business plus eighteen collections and its Cloudinary folder.

**Screens** (`frontend/src/pages/business/`): business register, profile, address, credentials, delivery, metrics, open-hours, and subscriptions settings pages, plus the dashboard.

### Gap to target

- **No authenticated business registration that creates the `Owner`.** Target registers a business for an existing user, creating the `Owner` and the owner's membership on the first venue; today `POST /business` creates a credentials-bearing `Business` and issues a `"Tenant"` session.
- **No draft state.** Target saves a business incomplete with only a trade name; today every identity field is required at creation.
- **No go-live state, toggle, or offline.** Target has a computed readiness gate, an admin/owner go-live toggle, and an offline state; today a business is implicitly "live" as soon as it exists, and discovery lists it unconditionally.
- **No completeness signal.** Target exposes missing checklist items on the profile read; today it does not.
- **Business carries its own credentials.** Target moves all credentials to the `User` and leaves the business only a verified contact email; today the business has a password and token flows.
- **Editable `subscription`.** Target makes the plan a read-only pointer to the `Owner`; today it is a client-editable field on create and update.
- **Currency is freely editable.** Target locks currency once a financial record exists; today `PATCH` changes it at will.
- **Single-range opening hours.** Target is zero-or-more ranges per day with overnight support; today it is one `openTime`/`closeTime` per day.
- **Hard-cascade delete.** Target is a soft delete (ADR-0003); today `DELETE` destroys the business and its data.
- **Global uniqueness.** Target scopes `taxNumber` uniqueness to the country and dedupes `legalName` per country among active businesses; today `taxNumber` is globally unique and `legalName` is checked globally without country or active scoping.
- **`contactPerson` shape drift.** Target is a simple optional primary contact; today it is free text or an employee reference.
- **Metrics edited through the shared profile form.** Target edits the cost targets, waste thresholds, and reporting-week start day on a **dedicated metrics settings surface** owned by the business-metrics subject; today they are edited inline in the shared business profile form. The values remain business fields in both.
