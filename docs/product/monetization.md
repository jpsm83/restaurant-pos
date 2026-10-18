# Monetization

> **About this document.** This is the **target-state source of truth** for monetization in Project Imperium — subscription plans, entitlements, and platform commission. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes monetization as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **how Project Imperium is paid** by businesses, and **what each plan unlocks**. It covers:

- the **plan ladder** — **Free**, **Basic**, **Premium**, and **Enterprise**;
- the **plan catalogue** — monthly subscription prices, **base commission** rates, **card recovery** rate, venue caps, and the **entitlement matrix**;
- how the **subscription** sits on the **Owner** and covers every venue in that Owner's portfolio;
- **commissionable sales**, the dual fee (base + card recovery), and how a **reporting week's** commission is composed;
- **plan changes** (upgrade, downgrade, Superadmin force-assign) with immediate entitlements and time proration;
- **paid-in-full** before go-live on a paid plan;
- **default late-payment grace** and the split between Owner subscription freeze and per-venue commission freeze; and
- the **one-country Owner** rule that keeps portfolio currency and tax regime aligned.

It deliberately does **not** cover:

- **how charges are taken** — payment method on file, retries, statements, receipts, and FX execution belong to the **platform-billing** subject;
- **payment-facilitator / connected-account plumbing** — the future direction for collecting card money belongs to that decision track; this subject only states commercial pass-through of card recovery;
- **customer-to-venue settlement** and **business tax configuration** — the payments-and-tax subject owns those;
- **finalising and collecting** a week's commission at weekly report close — the business-reports subject owns the close event and applies the rates this subject defines;
- the **Superadmin console UI** for editing the catalogue — the superadmin subject owns console operators, force-assign, term-change accept/decline, and catalogue *maintenance powers*; this subject owns what the catalogue *means*;
- **go-live checklist fields** beyond the paid-in-full gate — the business subject owns the checklist and toggle;
- **day-of POS and channel mechanics** — order-flow and related subjects own how sales happen; this subject only states that selling channels are not plan-gated.

---

## 2. Domain model and vocabulary

### Entities

- **Plan** — one of four named tiers in the catalogue: **Free**, **Basic**, **Premium**, or **Enterprise**. It carries a monthly price (or custom), a **base commission** rate (or custom), venue limits, and entitlements.
- **Plan catalogue** — the Superadmin-managed set of the four plans, the shared **card recovery** rate, grace defaults, and entitlement flags. Seed values ship with the product; Superadmin may change numbers and entitlements without renaming the four tiers.
- **Subscription** — the Owner's current plan assignment. It covers every Business under that Owner. A Business never holds its own subscription; it exposes the Owner's plan read-only.
- **Base commission** — Imperium's take-rate on **all** commissionable sales for the Owner's plan. This is where Imperium earns on sales volume.
- **Card recovery** — a **pass-through** percent on **card-tendered** commissionable sales only, sized to the blended average of major card processors. Imperium does **not** mark this up; it does not earn margin on card recovery.

### Terms this subject introduces

- **Commissionable sales** — paid sales after voids and refunds, plus **paid gift-card issues**, across every payment method. **Invitations**, **granted** gift cards, gift-card **redemptions**, **forfeitures**, and other unpaid activity are excluded.
- **Card-tendered commissionable sales** — the portion of commissionable sales whose recorded tender is **card** (including contactless and wallets on card rails), regardless of which processor handled the charge.
- **Weekly commission** — for one venue and one reporting week:  
  `(base commission rate × commissionable sales) + (card recovery rate × card-tendered commissionable sales)`.
- **Entitlement matrix** — which product capabilities each plan unlocks (ops depth, reports, multi-venue caps). Selling **channels** are not gated by plan.
- **Paid-in-full** — the Owner's subscription for the current period is settled, required before go-live on a **paid** plan.
- **Portfolio freeze** — every Business under an Owner is inaccessible for normal operation after subscription arrears past grace.
- **Venue freeze** — a single Business is inaccessible after that venue's weekly commission arrears past grace; sibling venues stay up.
- **Catalogue currency** — the currency in which list monthly prices are published (seed: euro). Charges follow the Owner portfolio currency (same as every venue under that Owner).

Terms reused rather than redefined here: **Owner**, **Company**, **Business**, **User**, **commission**, **reporting week**, **weekly business report**, **go-live**, **Superadmin**, **soft delete**, and **payment provider**.

---

## 3. Capabilities

### 3.1 Who pays

- **Businesses pay; customers are free.** The Customer app never carries a subscription or commission for the diner.
- Platform revenue is the **monthly subscription** (paid plans) plus **base commission** on commissionable sales. **Card recovery** only reimburses typical third-party card cost; it is not Imperium profit.

### 3.2 Plans and the catalogue

- Exactly four named plans exist: **Free**, **Basic**, **Premium**, **Enterprise**. Superadmin does not invent additional plan names in the first catalogue.
- Superadmin configures, per catalogue: monthly prices, base commission rates, the shared card recovery percent, venue caps, entitlement flags, and default grace days. Changing catalogue terms that bind existing Owners triggers the superadmin subject's term-change accept-or-decline flow.
- There are **no** one-off per-Owner commission rates outside moving the Owner to another plan or Enterprise custom terms recorded on that assignment.
- Seed defaults (catalogue currency euro; Superadmin may edit):

| Plan | Monthly | Base commission | Venue cap |
| --- | --- | --- | --- |
| Free | 0 | 1.00% | 1 |
| Basic | 49 | 0.70% | 2 |
| Premium | 129 | 0.40% | 5 |
| Enterprise | Custom | Custom (suggest floor ~0.20%) | Unlimited |

- **Card recovery** seed: **2.5%** on card-tendered commissionable sales, **same for every plan**, Imperium margin **0%**. The figure is a blended effective average of public EEA-oriented Stripe, PayPal Advanced Card, and Skrill list fees (percent-only; no separate fixed per-payment line in the weekly formula).

### 3.3 Owner, country, and currency

- The **subscription is held on the Owner** and covers all venues in that portfolio.
- An Owner's portfolio is **one country**. Every Company and Business under that Owner belongs to that country. The Owner billing currency and every business currency are the **same**, derived from that country. A venue in another country cannot join that Owner (tax configuration and rates are country-based).
- Commission for a venue is computed and owed in that venue's currency (which matches the Owner's).

### 3.4 Entitlement matrix (defaults)

**Channels:** dine-in POS, self-ordering, kiosk, and delivery are available on **every** plan, including Free. Monetization gates **ops depth**, not ways to sell.

| Capability | Free | Basic | Premium | Enterprise |
| --- | --- | --- | --- | --- |
| Venue cap | 1 | 2 | 5 | Unlimited |
| Floor plans | 1 floor | Unlimited | Unlimited | Unlimited |
| Core POS, menu, printers/screens | Yes | Yes | Yes | Yes |
| Promotions | Yes | Yes | Yes | Yes |
| Ratings | Yes | Yes | Yes | Yes |
| Gift cards | No | Yes | Yes | Yes |
| Reservations / Host | No | Yes | Yes | Yes |
| Suppliers, purchases, inventory | No | Yes | Yes | Yes |
| Employees, schedules, time control | No | Yes | Yes | Yes |
| Payroll export | No | No | Yes | Yes |
| Daily sales reports | Yes | Yes | Yes | Yes |
| Weekly business reports | No | Yes | Yes | Yes |
| Full monthly P&L / advanced metrics | No | No | Yes | Yes |
| Custom commercial terms | No | No | No | Yes |

Free means: run real service and take payment; Manage depth beyond promotions and ratings stays off until a paid plan.

### 3.5 Commission composition and timing

- Commissionable sales follow the definition in §2.
- **Weekly commission** = base rate × all commissionable sales **+** card recovery rate × card-tendered commissionable sales.
- Cash, crypto, and other non-card tenders pay **base only**. Card tenders pay **base + card recovery**.
- Rates come from the Owner's plan (and the shared card recovery) at the time each portion of the week applies (§3.6).
- A reporting week's commission is **finalised, owed, and collected** when that week's **business report closes** — never netted out of what customers paid the venue. Until close, daily and open weekly reports show an **estimate** only. Collection mechanics belong to platform-billing; the close event belongs to business-reports.

### 3.6 Plan changes

- An Owner may **change plan mid-cycle**. **Entitlements apply immediately.**
- **Monthly subscription** and **commission rates** are **time-prorated** at the cutover: elapsed fraction at the old price/rates, remainder at the new. Within a reporting week that spans a cutover, sales before the cut use the old rates; sales after use the new.
- **Downgrade** is allowed only when the portfolio already fits the lower venue and feature caps; otherwise the Owner must shed venues or turn off gated features first.
- **Superadmin force-assign** follows the same immediate entitlements and proration rules, and **wins** on conflict with an Owner-driven change.

### 3.7 Go-live and paid-in-full

- On **Free**, go-live needs only the business go-live checklist (business subject).
- On **paid** plans (Basic and above), go-live also requires the Owner's subscription **paid-in-full** for the current period.
- Commission arrears do not block go-live; they use late-payment freeze (§3.8).

### 3.8 Late payment and freeze

- Default grace: notify on overdue platform charge; **payment deadline = 7 days** after notice. Superadmin may override a specific Owner's deadline.
- **Subscription** is owed by the **Owner**. If still unpaid after the deadline, the **entire Owner portfolio is frozen** (every venue).
- **Weekly commission** is owed by the **Business**. If that venue's commission is still unpaid after the deadline, **only that Business is frozen**. Sibling venues under the same Owner that are current keep running.
- Resume when the debt is cleared (or Superadmin resumes). Soft-delete and other Owner lifecycle rules remain with the users and superadmin subjects.

### 3.9 New Owners

- A new Owner starts on **Free** unless Superadmin assigns otherwise.
- Live operation on Free is allowed within Free entitlements without a subscription invoice.

---

## 4. Roles and entitlements

### Base access layers (venue)

| Layer | Monetization powers |
| --- | --- |
| **Customer** | None — customers never pay platform fees. |
| **Employee** | None for plan or commission configuration. |
| **Manager** | May see effective plan and commission estimates on reports they can already view; cannot change the Owner's plan. |
| **Admin/owner** | May change the Owner's subscription plan (subject to caps and paid-in-full rules); sees effective plan on each owned venue. |

### Who can do what

| Activity | Who |
| --- | --- |
| Hold a subscription | The Owner |
| Change plan (upgrade/downgrade) | Admin/owner on that Owner account |
| Force-assign or override a plan | Superadmin console Manager or console Owner |
| Edit catalogue prices, rates, entitlements, grace defaults | Superadmin console Manager or console Owner |
| View commission estimate / finalised weekly commission | Whoever may view the relevant sales or business report |
| Go live on a paid plan | Admin/owner, only when checklist complete **and** subscription paid-in-full |
| Freeze / resume for arrears | Automatic after grace; Superadmin may override deadline or resume |

Job roles and per-user capabilities follow the global model; this subject does not add a separate capability flag beyond plan entitlements gating Manage features.
