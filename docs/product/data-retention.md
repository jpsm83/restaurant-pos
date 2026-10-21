# Plan quotas and data retention

> **About this document.** This is the **target-state source of truth** for plan creation quotas and data retention in Project Imperium — how much active data a plan may hold, how soft-deleted data ages into physical removal, and how abandoned users and dormant venues are wound down. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes these rules as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **how Project Imperium limits active data by plan** and **how it eventually removes soft-deleted data without breaking the product**. It covers:

- **creation quotas** on the plan catalogue — how many active food menu items, drink menu items, and employees a Business may hold on each plan;
- the **data-integrity rule** that forbids any physical removal while another retained record still depends on that record;
- **retention classes** and platform-wide delays after soft-delete — operational versus legal and financial;
- **retention purge** — Project Imperium’s automatic physical removal of eligible soft-deleted records after those delays when integrity allows;
- **inactive users** — soft-delete of non-owner accounts after long absence, with notice, private-only cascade, and later purge only under integrity;
- **dormant businesses** — soft-delete of venues with no trading or Business-mode activity after notice to the Owner, then the same retention path;
- **Owner/Admin venue and portfolio export shape** relative to soft-delete and retention purge — operational and commercial packages distinct from customer DSAR; and
- Superadmin’s power to edit quota numbers and the platform retention and lifecycle constants, including how shortening terms that bind Owners is accepted.

It deliberately does **not** cover:

- **subscription price, commission rates, feature entitlements, venue caps, and floor-plan caps** — the monetization subject owns those commercial rules; this subject only owns the creation-quota rows and retention constants that sit beside them on the catalogue;
- **how soft-delete is requested in day-to-day product flows** — each feature subject owns when a record is soft-deleted; this subject owns what happens afterward and the integrity gate on physical removal;
- **self-service account deletion** initiated by the user — the users subject owns pending deletion and soft-delete; this subject owns inactivity-driven soft-delete and the purge rules that may later apply;
- **deliberate business closure** initiated by an admin — the business subject owns that close flow; this subject owns dormancy-driven soft-delete and purge after soft-delete;
- **employee hire, termination, and HR** — the employees subject owns membership lifecycle; this subject only states that inactive is not deleted, and that soft-deleted employee data follows retention classes;
- **collection of platform fees** — platform-billing;
- **customer portable data export (DSAR), marketing consent, and privacy notice acceptance** — the privacy, consent, and DSAR subject;
- **country-by-country statutory retention matrices** beyond the product’s legal-and-financial floor — deferred; Superadmin may lengthen delays when advice requires it;
- **media storage byte caps** — out of scope;
- **per-plan purge delays** — delays are platform-wide, not tiered by plan;
- **clearing references solely to force a purge** — forbidden; integrity wins;
- **visual design, exact labels, and copy** — out of scope for the product set.

---

## 2. Domain model and vocabulary

### Entities

- **Creation quota** — a per-plan ceiling on how many **active** records of a given kind a **Business** may hold. Soft-deleted records do not consume the quota.
- **Retention class** — the delay bucket a soft-deleted record belongs to before it may be considered for physical removal: **operational** or **legal and financial**.
- **Retention purge** — Project Imperium’s automatic physical removal of a soft-deleted record that has aged past its class delay and passes the **data-integrity rule**.
- **Dormant business** — a live Business that has had no qualifying **venue activity** for the dormant inactivity window and is in (or past) the Owner confirmation window.

### Terms this subject introduces

- **Data-integrity rule** — the supreme rule of physical removal: Project Imperium never physically removes a record while any other still-retained record (active or soft-deleted and not yet purged) still **requires** that record’s identity. If a payment, order, report line, or any other retained document still points at a user, good, or venue identity, that identity stays until the dependents are gone or themselves purged under these rules.
- **Operational retention** — the shorter delay after soft-delete for non-financial configuration and private clutter (seed: **three months**).
- **Legal and financial retention** — the longer delay after soft-delete for records needed to reconstruct money or tax position (seed: **five years**).
- **Venue activity** (for dormancy) — either a **closed sale or payment** at the venue, or a **Business-mode sign-in** by an eligible employee or admin at that venue. Either resets the dormant clock.
- **Inactive user** — a User with no **successful sign-in** for the inactivity window who does **not** own any Business.

Terms reused rather than redefined here: **Plan**, **plan catalogue**, **Subscription**, **Owner**, **Business**, **User**, **Employee**, **soft delete**, **pending deletion**, **reactivation**, **Admin**, **Superadmin**, **term change**, **business good**, **food** and **drink** menu categories as the product uses them, and **Base access layer**.

---

## 3. Capabilities

### 3.1 Data-integrity rule (supreme)

- **Nothing is physically removed if removal would break the product or leave a retained document pointing at a missing identity.**
- Before every physical removal, Project Imperium checks dependencies. Any remaining required reference — including from soft-deleted records that are not yet purge-eligible — **blocks** removal. The candidate is skipped and retained.
- Project Imperium does **not** clear references solely to make a record eligible for purge.
- Soft-delete, creation quotas, inactive-user and dormant-business flows, and notice emails are all **secondary** to this rule.

### 3.2 Soft-delete versus retention purge

- People and console operators **soft-delete** only: mark deleted, retain, allow reactivation where the product already promises it. That remains the deletion model for ordinary product actions (ADR-0003), with the existing narrow exceptions for empty sales instances and cancelled orders.
- **Retention purge** is the platform’s later physical removal of **soft-deleted** records that have aged past their retention class **and** pass the data-integrity rule.
- **Active** (not soft-deleted) records are never removed by retention purge.

### 3.3 Retention classes and delays

Platform-wide seeds (Superadmin may edit):

| Class | Delay after soft-delete | What belongs here |
| --- | --- | --- |
| **Operational** | **Three months** | Soft-deleted configuration and ops that are not tax or settlement history — for example floors, printers and screens, promotions, unreferenced goods and suppliers, soft-deleted memberships and HR after termination, notifications, and user-private assets cascaded from account soft-delete. |
| **Legal and financial** | **Five years** | Soft-deleted payments, refunds, bill settlement history, gift-card ledger entries, closed sales and business report artifacts, platform billing documents, commission lines, and closed attendance inputs used for pay — anything needed to reconstruct money or tax position. |

- Each feature subject states whether its records are operational or legal and financial when retention matters. **Default is operational** unless the subject states legal and financial.
- The five-year legal and financial floor is Project Imperium’s product default, not a claim to satisfy every country’s statute. Superadmin may lengthen delays when required.

### 3.4 Creation quotas

- Quotas are part of the **plan catalogue** and apply **per Business**.
- Only **active** records count. Soft-delete frees a slot.
- Creating or restoring a record to active is refused when the Business is already at the plan ceiling, with a clear limit message (what limit, how many are in use, what the ceiling is, which plan).
- Downgrade to a lower plan is allowed only when every venue already fits that plan’s creation quotas (same spirit as venue and feature caps in monetization).
- Manage surfaces that create these records show usage against the ceiling.

Seed ceilings (Superadmin may edit; unlimited means no ceiling):

| Quota (per Business) | Free | Basic | Premium | Enterprise |
| --- | ---: | ---: | ---: | ---: |
| Active food menu items | 30 | 100 | 300 | Unlimited |
| Active drink menu items | 50 | 300 | 500 | Unlimited |
| Active employee memberships | 0 | 40 | 100 | Unlimited |

- Free’s zero Active employee memberships matches employees, schedules, and time control already off on Free: **only the Owner User** operates the venue via **Owner access** (no Employee membership). The quota still exists so paid plans and downgrade checks stay uniform. The Owner’s optional workforce membership on paid plans **does** consume an Active slot when created.

### 3.5 Inactive users

- After **twenty-four months** with no successful sign-in, a User who **does not own any Business** is an inactive-user candidate.
- A User who **owns any Business** is **never** auto soft-deleted for inactivity. An absentee owner is valid; someone else may run the venue.
- Project Imperium emails the person **thirty days** and **seven days** before action. Successful sign-in resets the clock. A one-time **keep my account** confirmation in the email also counts as activity.
- On action, the account enters the users subject’s **pending deletion** window, then **soft-delete**, so the person can still cancel by signing in during that window.
- Soft-delete **cascades only user-private** data (sessions, favorites, personal inbox, and similar private-only assets). It does **not** erase venue-owned history: orders, payments, reports, reservations, ratings, sales attribution, and the like stay.
- Active employee memberships are **terminated** (or left already terminated). Labour and sales history stay. Displays may show a frozen or “former user” name.
- Physical removal of the User later happens only through retention purge and the data-integrity rule.

### 3.6 Dormant businesses

- After **twelve months** with **no venue activity** (closed sale or payment, and no Business-mode sign-in), the Business is a dormant candidate.
- Project Imperium emails the **Owner** to confirm the venue should stay live.
- If there is **no confirming action** within **thirty days**, Project Imperium **soft-deletes** the Business under the same constraints as deliberate closure (no open sales instances — opens are closed or resolved first).
- Memberships are terminated; historical records are retained.
- Children follow ordinary soft-delete on close, then retention purge by class and integrity. The Business identity itself remains until the data-integrity rule allows removal (typically after legal and financial dependents are gone or purged).

### 3.7 Employees

- Being inactive (no sign-in) is **not** the same as being deleted.
- There is no special auto physical removal of living memberships for inactivity alone.
- Soft-deleted or terminated employee data is physically removed only on the normal operational or legal-and-financial timeline and only when integrity allows.
- When a Business is soft-deleted, memberships terminate; history remains until retention purge.

### 3.8 Export and honesty

- Owner and Admin may **export** venue data (and portfolio-scoped exports where the product already allows) while the data still exists — **active or soft-deleted**.
- That **venue / portfolio export** is an **operational and commercial** package for people who already administer the venue: menu and stock configuration, sales and reports, staff memberships and HR the venue holds, payments and settlement history, and similar venue-owned records. Soft-deleted rows that are still retained are **included**. Once **retention purge** physically removes a record, export no longer covers it.
- Venue / portfolio export is **not** a customer data export (DSAR). It must **not** dump unrelated platform-wide User profiles. Customer personal detail appears only as fields **already visible in venue operations** (for example a name or email on a reservation or an attributed order).
- Exact file format and column layout are outside this subject; the capability to take the administered data away as a downloadable package is in scope.
- **Customer** self-service portable export of a person's own attributable data is owned by the privacy, consent, and DSAR subject — distinct from this Owner/Admin package.
- Project Imperium is explicit in product copy and policy that soft-delete is recoverable for a time, that retention purge may physically remove eligible soft-deleted data after the published delays, and that integrity may keep some soft-deleted identities indefinitely when history still depends on them.

### 3.9 Superadmin and catalogue constants

- Superadmin maintains creation quota numbers on each plan and the platform-wide constants: operational and legal-and-financial delays, inactive-user window and warning offsets, dormant-business inactivity and confirmation windows.
- **Lengthening** a delay may apply immediately (more retention).
- **Shortening** delays or tightening quotas that bind existing Owners uses the Superadmin **term-change** accept-or-decline path where those terms bind paying Owners.
- People already inside an inactivity or dormancy warning window are notified again if Superadmin shortens those windows.

### 3.10 Ongoing processing

- Project Imperium periodically evaluates inactive users, dormant businesses, and retention purge candidates and applies the rules in this subject. Failures to remove a candidate because of integrity are expected and leave the record in place.

---

## 4. Roles and entitlements

### Base access layers (venue)

| Layer | Powers on this subject |
| --- | --- |
| **Customer** | May receive inactive-user warnings and keep-account confirmations for their own User; does **not** receive venue operational export. Own portable data export belongs to the privacy, consent, and DSAR subject. |
| **Employee** | Sees creation-quota limits only insofar as create actions refuse at the ceiling; no catalogue editing; no venue operational export. |
| **Supervisor** | Same as employee for quotas; no catalogue editing; no venue operational export. |
| **Manager** | May see usage against quotas where they create menu or hire; may participate in Business-mode activity that resets dormancy; cannot change catalogue constants; venue operational export stays Admin/Owner unless a sibling subject already grants a narrower report download. |
| **Admin / Owner** | Same as manager for venue create actions; receives dormant-business confirmation; may export venue (and portfolio) **operational and commercial** data while it exists, including soft-deleted-until-purged rows (§3.8); may change plan under monetization rules (which must fit quotas on downgrade). |

### Superadmin console

| Activity | Who |
| --- | --- |
| Edit creation quotas on the plan catalogue | Console Manager or console Owner |
| Edit platform retention delays and inactive-user / dormant-business windows | Console Manager or console Owner |
| Force physical deletion of an arbitrary identity outside these rules | No one — soft-delete and retention purge only, always under the data-integrity rule |

Job roles and per-user capabilities follow the global model; this subject does not add a separate capability flag beyond plan quotas and console catalogue maintenance.
