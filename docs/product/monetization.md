# Monetization

> **About this document.** This is the **target-state source of truth** for monetization in Project Imperium — subscription plans, entitlements, and platform commission. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes monetization as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **how Project Imperium is paid** by businesses, and **what each plan unlocks**. It covers:

- the **plan ladder** — **Free**, **Basic**, **Premium**, and **Enterprise**;
- the **plan catalogue** — monthly subscription prices, **base commission** rates, venue caps, and the **entitlement matrix** (feature and venue depth); **creation quotas** for active menu items and employees are defined by the plan quotas and data retention subject and ship on the same catalogue;
- how the **subscription** sits on the **Owner** and covers every venue in that Owner's portfolio;
- **commissionable sales** and how a **reporting week's** **base commission** is composed;
- **plan changes** (upgrade, downgrade, Superadmin force-assign) with immediate entitlements, commission-rate cutover inside a reporting week, and calendar-month subscription true-up rules;
- **paid-in-full** before go-live on a paid plan;
- **default late-payment grace** and the split between Owner subscription freeze and per-venue commission freeze; and
- the **one-country Owner** rule that keeps portfolio currency and tax regime aligned.

It deliberately does **not** cover:

- **how charges are taken** — payment method on file, calendar prepaid collection, retries, invoices, billing documents, receipts, arrears dunning, and adjustments belong to the **platform-billing** subject;
- **connected-account / Stripe plumbing** — how diner card money is captured on self-channels belongs to the **payments-and-tax** subject (ADR-0005); this subject only states Imperium's commercial fees;
- **customer-to-venue settlement** and **business tax configuration** — the payments-and-tax subject owns those;
- **finalising** a week's commission at weekly report close — the business-reports subject owns the close event and applies the rates this subject defines; **collecting** that owed amount belongs to platform-billing;
- the **Superadmin console UI** for editing the catalogue — the superadmin subject owns console operators, force-assign, term-change accept/decline, and catalogue *maintenance powers*; this subject owns what the catalogue *means*;
- **go-live checklist fields** beyond the paid-in-full gate — the business subject owns the checklist and toggle;
- **day-of POS and channel mechanics** — order-flow and related subjects own how sales happen; this subject only states that selling channels are not plan-gated;
- **creation quota numbers, retention purge, inactive users, and dormant businesses** — the plan quotas and data retention subject owns those rules and the catalogue constants for them; this subject only requires that a downgrade also fit those quotas.

---

## 2. Domain model and vocabulary

### Entities

- **Plan** — one of four named tiers in the catalogue: **Free**, **Basic**, **Premium**, or **Enterprise**. It carries a monthly price (or custom), a **base commission** rate (or custom), venue limits, and entitlements.
- **Plan catalogue** — the Superadmin-managed set of the four plans, grace defaults, and entitlement flags. Seed values ship with the product; Superadmin may change numbers and entitlements without renaming the four tiers.
- **Subscription** — the Owner's current plan assignment. It covers every Business under that Owner. A Business never holds its own subscription; it exposes the Owner's plan read-only.
- **Base commission** — Imperium's take-rate on **all** commissionable sales for the Owner's plan. This is where Imperium earns on sales volume. There is **no** separate card-recovery pass-through in stage 1 (ADR-0005).

### Terms this subject introduces

- **Commissionable sales** — paid product sales after voids and refunds across every payment method, including sales paid with **gift card** tender (whether the card was paid or granted). **Invitations**, gift-card **deposit intake**, **forfeitures**, **tips**, and other unpaid activity are excluded.
- **Weekly commission** — for one venue and one reporting week:  
  `base commission rate × commissionable sales`.
- **Entitlement matrix** — which product capabilities each plan unlocks (ops depth, reports, multi-venue caps). Selling **channels** are not gated by plan.
- **Paid-in-full** — the Owner's subscription for the current **calendar subscription month** is settled (full month prepaid or mid-month prorated prepaid), required before go-live on a **paid** plan. Collection of that prepaid amount belongs to platform-billing.
- **Portfolio freeze** — every Business under an Owner is hidden from the public and inaccessible for normal operation after subscription arrears past grace; billing and paying the debt remain available.
- **Venue freeze** — a single Business is hidden from the public and inaccessible for normal operation after that venue's weekly commission arrears past grace; sibling venues stay up; billing and paying that venue's debt remain available.
- **Catalogue currency** — the currency in which list monthly prices are published (seed: euro). Charges follow the Owner portfolio currency (same as every venue under that Owner).

Terms reused rather than redefined here: **Owner**, **Company**, **Business**, **User**, **commission**, **reporting week**, **weekly business report**, **go-live**, **Superadmin**, **soft delete**, and **payment provider**.

---

## 3. Capabilities

### 3.1 Who pays

- **Businesses pay; customers are free.** The Customer app never carries a subscription or commission for the diner.
- Platform revenue is the **monthly subscription** (paid plans) plus **base commission** on commissionable sales. Real card-processor fees on Imperium-processed payments are paid by the venue to Stripe (payments-and-tax); Imperium does not add a card-recovery line on the weekly bill.

### 3.2 Plans and the catalogue

- Exactly four named plans exist: **Free**, **Basic**, **Premium**, **Enterprise**. Superadmin does not invent additional plan names in the first catalogue.
- Superadmin configures, per catalogue: monthly prices, base commission rates, venue caps, entitlement flags, and default grace days. Changing catalogue terms that bind existing Owners triggers the superadmin subject's term-change accept-or-decline flow.
- There are **no** one-off per-Owner commission rates outside moving the Owner to another plan or Enterprise custom terms recorded on that assignment.
- Seed defaults (catalogue currency euro; Superadmin may edit):

| Plan | Monthly | Base commission | Venue cap |
| --- | --- | --- | --- |
| Free | 0 | 1.00% | 1 |
| Basic | 49 | 0.70% | 2 |
| Premium | 129 | 0.40% | 5 |
| Enterprise | Custom | Custom (suggest floor ~0.20%) | Unlimited |

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
| Active food / drink menu and employee **creation quotas** | See plan quotas and data retention subject | Same | Same | Same |

Free means: run real service and take payment; Manage depth beyond promotions and ratings stays off until a paid plan. Creation quotas on Free still limit how large an active menu may grow.

### 3.5 Commission composition and timing

- Commissionable sales follow the definition in §2 (all tenders; tips excluded; full face price).
- **Weekly commission** = base rate × all commissionable sales.
- The base rate comes from the Owner's plan at the time each portion of the week applies (§3.6).
- A reporting week's commission is **finalised, owed, and collected** when that week's **business report closes** — never netted out of what customers paid the venue. Until close, daily and open weekly reports show an **estimate** only. Collection mechanics belong to platform-billing; the close event belongs to business-reports.
- When a closed week is **re-finalised** (edited daily, approved refund, or card dispute that changes commissionable sales), platform-billing applies a **commission adjustment**.

### 3.6 Plan changes

- An Owner may **change plan mid-cycle**. **Entitlements apply immediately.**
- **Commission rates** on sales are **cut over at the plan change**: within a reporting week that spans a cutover, sales before the cut use the old rates; sales after use the new.
- **Monthly subscription price** follows **calendar prepaid** billing owned by platform-billing: billed on the **first of each calendar month in advance** for that month; a mid-month start or go-live takes a **prorated prepaid** for the remaining days immediately; a mid-month plan change's price difference is a **true-up on the next first-of-month** invoice (not an immediate mid-month charge or refund).
- **Downgrade** is allowed only when the portfolio already fits the lower venue caps, feature caps, and **creation quotas** (plan quotas and data retention subject); otherwise the Owner must shed venues, turn off gated features, or reduce active menu or employee counts first.
- **Superadmin force-assign** follows the same immediate entitlements, commission-rate cutover, and subscription true-up rules, and **wins** on conflict with an Owner-driven change.

### 3.7 Go-live and paid-in-full

- On **Free**, go-live needs only the business go-live checklist (business subject). Free has no subscription invoice gate, but still owes **weekly commission** (collected by platform-billing).
- On **paid** plans (Basic and above), go-live also requires the Owner's subscription **paid-in-full** for the current **calendar subscription month** (full month or mid-month prorated prepaid — platform-billing).
- Commission arrears do not block go-live; they use late-payment freeze (§3.8).

### 3.8 Late payment and freeze

- Default grace: notify on overdue platform charge; **payment deadline = 7 days** after notice (Superadmin may change the catalogue default and may override a specific Owner's deadline). Notice and follow-up dunning name the amount due, the consequences of non-payment, and the deadline. Dunning copy may describe the outcome as suspension; the product state is **portfolio freeze** or **venue freeze**. Daily arrears dunning, the named cut-off date, and post-freeze reminders belong to platform-billing; this subject owns the grace default and the freeze outcome. Manual **suspend** of a paying Owner is a separate Superadmin lifecycle action, not the automatic arrears outcome.
- **Subscription** is owed by the **Owner**. If still unpaid after the deadline, the **entire Owner portfolio is frozen** (every venue).
- **Weekly commission** is owed by the **Business**. If that venue's commission is still unpaid after the deadline, **only that Business is frozen**. Sibling venues under the same Owner that are current keep running.
- A frozen Business is **absent from public discovery**, its **customer channels are unavailable**, and **normal Service and Manage operation is blocked**. Imperium also stops **new** Imperium-processed Stripe captures for that Business. **Allowed while frozen:** viewing billing and dunning, **paying** the owed platform charge, and **managing** the Owner's platform payment method. Paying clears the freeze (or Superadmin resumes). Soft-delete and other Owner lifecycle rules remain with the users and superadmin subjects.

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
| **Supervisor** | None for plan or commission configuration. |
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
