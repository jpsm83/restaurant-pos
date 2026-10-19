# Privacy, consent, and DSAR

> **About this document.** This is the **target-state source of truth** for privacy, consent, and customer data export in Project Imperium — EEA+UK-shaped stage-1 rules for marketing consent, necessary processing, age floors, and customer DSAR/export. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes these rules as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **how Project Imperium treats personal data in product behaviour** for stage 1. It covers:

- the **platform-wide EEA+UK-shaped privacy floor** — one product commitment for every venue, not a per-country statute matrix;
- **plain-language roles** — who uses customer data to serve, who runs the platform, and who processes card payments on Imperium-mediated channels;
- **privacy notice and account terms** acceptance at User creation, and what processing needs **no marketing-style consent**;
- **marketing consent** — the opt-in that gates venue engagement **broadcasts**, and how it relates to the **engagement mute**;
- **customer DSAR / data export** — self-service portable download of a person's own attributable data;
- **erasure** as the existing account-deletion path under soft-delete, retention purge, and the **data-integrity rule** — with **no** integrity-bypassing hard erase;
- **guest** data before User attribution;
- **language** of privacy chrome versus business-authored content; and
- **age floors** for marketing consent and for self-channel sale of alcoholic catalogue items.

It deliberately does **not** cover:

- **retention delays, retention purge, inactive users, and dormant businesses** — the plan quotas and data retention subject owns those. This subject states that customer erasure follows that path and that Owner/Admin venue export is not a DSAR package.
- **Owner/Admin venue and portfolio operational export shape** — thickened on the plan quotas and data retention subject; this subject owns only the customer DSAR package.
- **the engagement mute's storage surface and inbox mechanics** — the notifications subject owns the mute and the broadcast catalogue; this subject owns **marketing consent** and the rule that broadcasts require consent on and mute off.
- **email templates, unsubscribe link mechanics, and delivery retry** — the emails subject.
- **account deletion windows, reactivation, and User profile fields** as identity mechanics — the users subject. This subject states privacy-notice accept, birth-date gates, marketing consent and DSAR controls on the User, and that deletion is the erasure path.
- **employee / HR privacy, payroll packages, and staff DSAR** — employees, payroll, and access-and-permissions. Staff are also customers: the same User-level marketing consent and mute apply; there is no separate staff marketing consent in stage 1.
- **cookie banners, non-essential analytics, and tracking SDKs** — out of stage-1 product scope.
- **parental-authorisation flows, full child-account products, and country-by-country alcohol or age-assurance packs** — deferred (named for a later compliance subject). Stage 1 commits only the age floors in this document.
- **exact legal text** of the privacy notice and terms — out of scope for the product set; the product commits that an accept step exists and that published notice covers necessary processing.
- **visual design and exact UI copy** — out of scope for the product set.

---

## 2. Domain model and vocabulary

### Entities

This subject introduces **no new persistent business entity** beyond preferences and records held on the **User**. It constrains how personal data is consented to, exported, and aged out under rules other subjects already own.

### Terms this subject introduces

- **Marketing consent** — a single per-person, **platform-global** switch on the **User**, **off by default**, that the person must **opt in** before a venue may send them engagement **broadcasts** (Promotion, Birthday, Event — in-app and email). It is not per-venue and not per-category.
- **Privacy notice** — the published explanation of how Project Imperium and venues process personal data. Creating a User requires acknowledging it (with account terms). Exact counsel text is outside this subject.
- **Customer data export** (also **DSAR export** in product language) — a self-service, portable, machine-readable package of the signed-in person's **own attributable** personal data and history while those rows still exist.
- **Digital-consent age** — the platform floor age below which marketing consent cannot be granted in stage 1 because there is no parental-authorisation product. Seed: **sixteen**.
- **Alcohol purchase age** — the platform floor age required before a payer may check out **Alcoholic drinks** tax-category goods on **self-channels**. Seed: **eighteen**.
- **Self-channel** — a customer journey where the diner pays through Imperium-mediated checkout: QR self-ordering, kiosk, and delivery (order-flow and payments-and-tax). Staff-recorded dine-in tenders are not self-channels for this age gate.

Terms reused rather than redefined here: **User**, **Customer**, **Business**, **Owner**, **Company**, **Employee**, **engagement mute**, **broadcast**, **direct message**, **related customer**, **soft delete**, **pending deletion**, **retention purge**, **data-integrity rule**, **Alcoholic drinks** tax category, **birth date**, **language preference**, **guest basket**, **ordering session**, and **merchant of record**.

---

## 3. Capabilities

### 3.1 Platform-wide EEA+UK-shaped floor

- Stage-1 privacy rules in this subject apply to **every** venue and User on Project Imperium as one **EEA+UK-shaped floor**.
- The floor is a **product default**, not a claim to satisfy every country's statute line-by-line. Superadmin or a later country-pack subject may **tighten** behaviour when advice requires it; stage 1 does not geo-gate these rules per venue country.
- The same honesty spirit as plan quotas and data retention applies: product copy may say what is retained, exported, or purged under published delays and integrity.

### 3.2 Plain-language roles

- The **Business** is **merchant of record** for diner payments on Imperium-processed channels (payments-and-tax). The venue uses customer data it receives to **fulfil service** (orders, reservations, bills, engagement it is allowed to send).
- **Project Imperium** processes personal data to **run the platform** (identity, sessions, inboxes, exports, soft-delete and retention paths, and the product surfaces).
- On Imperium-processed card rails, **Stripe** is the **payment processor** via each venue's connected payment account. Imperium does not invent a counsel-grade controller/processor matrix, DPIA, or ROPA in this subject — only these plain-language roles.

### 3.3 Privacy notice, terms, and necessary processing

- Creating a **User** requires a clear **accept** step for the **privacy notice** and account terms before the account is created.
- **Necessary service processing** — account use, ordering, payment, receipts, security, and **operational** notifications and emails — needs **no marketing-style consent**. It is covered by that notice and terms acceptance (and by identity-at-payment when a guest becomes a User).
- Later edits to the published notice do **not** invent a stage-1 re-consent product flow for necessary processing. **Marketing consent** remains the separate opt-in in §3.4.
- **Cookie banners and non-essential analytics** are out of stage-1 product scope.

### 3.4 Marketing consent and the engagement mute

- Every User holds one **marketing consent**, **off by default**, **global** across every venue.
- Venue engagement **broadcasts** (Promotion, Birthday, Event — in-app and email) are sent only when **marketing consent is on** and the person's **engagement mute is off**. Both gates must pass.
- The person may **grant** or **withdraw** marketing consent at any time from the surfaces in §3.10. Withdrawal stops future broadcasts **immediately**. Withdrawal does not by itself turn the engagement mute on; unmute does not grant consent.
- The **engagement mute** remains the suppress / one-click unsubscribe control owned by notifications and emails. Unsubscribe turns mute **on**; it does not change marketing consent by itself. A person with mute on receives no broadcasts even if consent is on.
- **Direct messages** and **operational** notifications and emails are **not** gated by marketing consent and are **not** suppressed by the engagement mute (except the existing overtime-session mute owned by time-control).
- There is **no** per-venue or per-category marketing toggle in stage 1.
- Project Imperium **records** when marketing consent was granted or withdrawn (with time) on the User. That state appears in the customer data export.

### 3.5 Age floors: use, marketing, and alcohol

- A **minor** may **browse**, **create a User** (accept notice and terms), and purchase **non-alcohol** goods.
- **Birth date** on the User is **required** before the person may turn **marketing consent** on, and before they may check out any good whose tax category is **Alcoholic drinks** on a **self-channel**.
- **Marketing consent** may be granted only when birth date shows age at least the **digital-consent age** (**sixteen**). Stage 1 has **no parental-authorisation** product; under sixteen, marketing consent stays **off** and cannot be turned on.
- On **self-channels**, a basket or pay-to-commit that includes any **Alcoholic drinks** tax-category line is **blocked** unless the payer's birth date shows age at least the **alcohol purchase age** (**eighteen**). Order-flow enforces the block at basket and pay; business-goods identify the tax category as the signal.
- **Staff-recorded dine-in** sale of alcoholic items is **not** hard-blocked by this age gate in stage 1 — the venue remains responsible at the table.
- Full ID-at-table, ID-at-delivery, and per-country alcohol packs are **deferred** and are not invented here.

### 3.6 Guest data before identity

- **Guest baskets** and unsigned browse leave **session-scoped** data. That data is **not** a customer data export until it is attributed to a **User** (sign-in or sign-up at payment, or other identity gate).
- After attribution, that history is part of the User's exportable data while retained.
- Abandoned guest sessions age out under order-flow and any abandoned-basket rules owned elsewhere; this subject does not keep a parallel guest personal-data archive.

### 3.7 Customer data export (DSAR)

- A signed-in customer may **Download my data** from the customer account area (and from Business **Me** where account settings are shared). The ordinary case is **self-service** — not a Superadmin ticket.
- The package is a **portable machine-readable** download (file format is an implementation detail; the product commits that the person can take the data away in machine-readable form).
- The package covers **their User-held personal data and history they can already see in product**, including: profile detail, favorites, order / reservation / payment history attributable to them, reviews they wrote, gift-card balances they hold, inbox and conversation items addressed to them, **marketing consent** and **engagement mute** state (and consent change times).
- Soft-deleted-but-still-retained personal rows that still belong to them are **included** while they exist.
- The package **excludes** other people's data, venue operational internals the customer cannot see, and employee / HR records on memberships.
- Ordinary export is **prompt in-product** (generate and download when ready). It is not framed as a thirty-day support SLA for the self-service path.
- Exceptional assisted requests (for example a locked-out account) may be handled through support or Superadmin process outside this subject's UI commitments, and still **never** bypass soft-delete, retention purge, or the data-integrity rule.

### 3.8 Erasure and data integrity

- There is **no** separate “hard erase now” DSAR control that physically removes identities while retained dependents still need them.
- Customer **account deletion** (users subject: pending deletion → soft-delete → retention purge under the plan quotas and data retention subject's **data-integrity rule**) is the erasure path.
- Product copy states clearly that some legal and financial history may remain until retention purge allows physical removal, and that integrity may keep some soft-deleted identities longer when history still depends on them.
- **Data integrity of the product always wins.** Operators and routes do not hard-delete domain identities outside the documented soft-delete and retention-purge path (ADR-0003 and the plan quotas and data retention subject).

### 3.9 Language

- Privacy, consent, and DSAR **product chrome and system copy** follow the person's **UI language preference** (English or Spanish). When unset, **browser language** seeds that preference (users subject).
- **Business-authored** content — menu text, venue event copy, manager-written messages — stays in the language the business entered. Privacy does not translate or dual-store it.
- Customer data export packages include data **as stored** — no translation pass.

### 3.10 Where customers manage privacy controls

- **Marketing consent**, **engagement mute**, a link to the **privacy notice**, and **Download my data** live in the **customer account area**, and remain reachable from Business **Me** where navigation already shares account settings (user-navigation).
- **Venues cannot grant or revoke** a customer's marketing consent.
- Changing birth date recalculates eligibility for marketing consent and self-channel alcohol: if the person falls under a floor, marketing consent that is on is turned **off**, and self-channel alcohol checkout stays blocked until they meet the alcohol purchase age.

### 3.11 Owner/Admin export is not DSAR

- Owner and Admin **venue and portfolio exports** are owned as shape by the plan quotas and data retention subject. They are **operational and commercial** packages for people who already administer that data — **not** a customer DSAR package and not a dump of unrelated platform-wide User profiles.
- This subject only requires that product language keep those two export kinds distinct.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Powers on this subject |
| --- | --- |
| **Customer** | Accepts privacy notice and terms at User creation; manages own marketing consent (when age-eligible), engagement mute, and customer data export; may delete own account as the erasure path. |
| **Employee** | Same User-level privacy controls as customer (every user is a customer). No venue power over another person's marketing consent. |
| **Supervisor** | Same as employee for this subject. |
| **Manager** | Same as employee for customer privacy controls. May send direct messages and publish venue events per notifications; broadcasts still respect each recipient's marketing consent and mute. Cannot flip another person's marketing consent. |
| **Admin / Owner** | Same as manager for customer privacy. May use venue/portfolio operational export per plan quotas and data retention — distinct from customer DSAR. |

### Superadmin console

| Activity | Who |
| --- | --- |
| Assist an exceptional locked-out export or support request without bypassing integrity | Console operators under Superadmin process |
| Force physical deletion of an identity outside soft-delete and retention purge | No one |
| Edit platform age-floor seeds if the catalogue later exposes them | Console Manager or console Owner when such constants exist; stage 1 seeds are sixteen and eighteen as committed here |

### Who can do what

| Activity | Who |
| --- | --- |
| Accept privacy notice and terms | The person creating the User |
| Grant or withdraw marketing consent | The User (when age ≥ digital-consent age and birth date present) |
| Mute or unmute engagement | The User (notifications / emails) |
| Download my data | The signed-in User (own package only) |
| Delete account (erasure path) | The account's user (users subject) |
| Grant or revoke another person's marketing consent | No one (including venues) |
| Check out Alcoholic drinks on a self-channel | The payer User when birth date shows age ≥ alcohol purchase age |
| Record dine-in alcohol on a staff tab | Staff per payments and order-flow — not blocked by this subject's self-channel age gate |
| Export venue/portfolio operational data | Owner/Admin per plan quotas and data retention |
