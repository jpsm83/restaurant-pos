# Superadmin console

> **About this document.** This is the **target-state source of truth** for the Superadmin console in Project Imperium — the separate Imperium-staff surface that runs the application business. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes the Superadmin console as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **Superadmin console**: the Imperium-staff surface that administers the platform itself — paying accounts, plans, commission terms, feature flags, support tooling, and portfolio analytics. It covers:

- the **Superadmin** product surface as its own web app and **authentication realm**, distinct from the Customer and Business apps;
- **console operators** — Imperium employees who sign into that realm, with console roles **Owner**, **Manager**, and **Staff**;
- **enrollment**, credentials, and MFA for those accounts;
- management of **Owners** (the paying portfolio accounts): visibility into their Companies and Businesses, plan assignment, suspend / resume, soft delete, and term-change acceptance;
- the **plan catalogue** — monthly prices, **base commission** per plan, shared **card recovery**, venue caps, entitlement flags, **creation quotas**, and platform **retention** and lifecycle constants (owned in meaning by the plan quotas and data retention subject);
- **feature flags** at platform-wide and per-Owner scope;
- **scoped impersonation** for support;
- the **review abuse-removal** decision queue;
- **late-payment** notification and automatic **freeze** behaviour (Owner portfolio vs single venue) as it appears to console operators;
- **portfolio analytics** across Owners and venues; and
- maintenance of the platform's **payment-provider catalogue** (which providers Project Imperium offers venues).

It deliberately does **not** cover:

- the **Customer** and **Business** apps, the **Customer | Business** mode toggle, venue chrome, or day-of service — the user-navigation, order-flow, and related subjects own those. Superadmin is never a third mode on that chooser.
- **go-live checklist**, draft venues, and **paid-in-full** before go-live on a paid plan — the business and monetization subjects own those gates. This subject only states that Superadmin does **not** approve ordinary go-live.
- **default late-payment grace rules** (when to notify, how long the deadline is) — the monetization subject owns the defaults. This subject owns console override and the automatic freeze outcome.
- **commission collection** when a weekly business report closes — the business-reports subject owns finalising and owing; the platform-billing subject owns collecting. This subject owns editing the catalogue rates the monetization subject defines.
- **what each plan unlocks** (the entitlement matrix) and commercial meaning of base vs card-recovery commission — the monetization subject owns that. This subject owns catalogue maintenance, assignment, and overrides.
- **User** identity in the Customer/Business realm, membership, and venue HR — the users and employees subjects own those.
- **review authoring and business replies** — the ratings-and-comments subject owns them; this subject owns only accept/reject of a venue's abuse-removal request.
- a **general helpdesk** or ticket product — out of scope; support here is ops tools plus the abuse queue.
- **visual design, exact labels, and copy** — out of scope for the product set.

---

## 2. Domain model and vocabulary

### Entities

- **Superadmin console** — the Imperium-staff product surface that runs the **application business**. It is a **separate web app** with its own authentication realm. It shares the platform's data with the Customer and Business apps; it does not share their login or session.
- **Console operator** — an Imperium employee account that exists only in the Superadmin realm. A console operator is **not** a **User** of the Customer/Business apps; those credentials never grant Customer or Business access. This is not the venue job role of the same everyday word.
- **Owner** (paying account) — the portfolio account that holds Companies, Businesses, subscription, and commission terms. Created when a person registers a business in the Customer/Business realm. Superadmin manages these accounts; it does not replace them.
- **Plan** — a named subscription tier in the **plan catalogue** (**Free**, **Basic**, **Premium**, **Enterprise**). It carries the monthly price and **base commission** for that tier (plus shared **card recovery** on the catalogue) and is assigned to paying Owners.
- **Feature flag** — a named platform capability switch, scoped **platform-wide** or to one paying **Owner**'s portfolio.
- **Impersonation session** — a time-bounded, audited support session in which a console operator acts as a **named User** inside **one Business**.

### Terms this subject introduces

- **Application business** — Project Imperium itself as the thing being operated: Owners, plans, flags, support, and portfolio analytics — not any venue's day-to-day service.
- **Authentication realm** — the separate credential and session world for the Superadmin console (credentials, MFA, access rules), distinct from Customer/Business sign-in.
- **Console role** — exactly one of **Owner**, **Manager**, or **Staff** on a console-operator account. These names are **console roles** only; they are not the venue job roles or base access layers of the Business app.
- **Enrollment** — the invite flow by which a Manager or console Owner creates a console operator and the person sets credentials and MFA via email before first access.
- **Plan catalogue** — the Superadmin-managed set of plans, base commission rates, shared card recovery, and entitlements.
- **Term change** — an edit to catalogue terms, rates, or policies that bind existing paying Owners; triggers email and an explicit accept-or-decline choice.
- **Payment deadline** — the date by which an overdue subscription or venue commission must be paid before automatic freeze (portfolio-wide for subscription; that venue only for weekly commission).
- **Abuse-removal queue** — the Superadmin list of venue requests to soft-delete a review for abuse.

Terms reused rather than redefined here: **User**, **Owner** (paying account), **Company**, **Business**, **subscription**, **commission**, **soft delete**, **live** venue, **go-live**, and **payment provider**.

---

## 3. Capabilities

### 3.1 Separate surface and realm

- Project Imperium exposes the Superadmin console as a **separate web app** from the Customer and Business apps. Console operators never reach it through the Customer | Business mode chooser.
- The console has its **own authentication realm**: separate credentials, mandatory **MFA**, and its own access restrictions. A Customer/Business session cannot become a Superadmin session, and a console-operator session cannot become a Customer or Business session.
- Console operators **never run a venue's day-to-day service** (POS, kitchen, schedules, and the rest). They administer the application business and may enter a venue only through **scoped impersonation**.

### 3.2 Console operators and enrollment

- Every console operator is an **Imperium employee**. There is **no self-serve signup** for this realm.
- **Managers and console Owners** create console-operator accounts manually and send an **enrollment** email. Until the person completes enrollment — credentials and MFA — the account cannot use the console.
- A console operator holds exactly one **console role**: **Staff**, **Manager**, or **Owner**.
- **Manager** and **console Owner** have the **same tool entitlements**. The console **Owner** role means the person **owns the Imperium application** (more than one console Owner is allowed); it is not a higher permission tier than Manager.
- Console operators are disabled or soft-deleted under the same soft-delete convention as the rest of the platform; console operators **never hard-delete**. Platform **retention purge** of eligible soft-deleted domain data is owned by the plan quotas and data retention subject.

### 3.3 Paying Owner lifecycle

- Superadmin lists and inspects **Owners**, with visibility into the **Companies** and **Businesses** beneath each.
- There is **no mandatory Superadmin approval** for ordinary business registration or go-live. Go-live completeness and paid-in-full on a paid plan belong to the business and monetization subjects.
- Console Managers and console Owners may **suspend** and **resume** a paying Owner, and may **soft-delete** a paying Owner (operators never hard-delete). Soft-delete follows the platform-wide convention: mark deleted, retain, allow reactivation under the same rules as the main apps.
- Suspended or soft-deleted Owners (and their venues) are inaccessible for normal Customer/Business operation until resumed or reactivated per those rules.

### 3.4 Plans, commission, and term changes

- Superadmin maintains the **plan catalogue** (Free, Basic, Premium, Enterprise): monthly prices, **base commission** per plan, the shared **card recovery** pass-through, venue caps, entitlement flags, **creation quotas**, and platform-wide **retention delays** and inactive-user / dormant-business windows. Meaning of quotas and retention belongs to the plan quotas and data retention subject; this subject owns the console’s power to edit them.
- Base commission for a paying Owner is **always** the rate on that Owner's current plan (Enterprise may carry custom terms on the assignment). There are **no** arbitrary one-off rates outside that; changing a published rate means editing the catalogue (or moving the Owner to another plan).
- Managers and console Owners may **force-assign or override** a paying Owner's plan. Force-assign applies entitlements immediately with commission-rate cutover and subscription next-bill true-up (monetization and platform-billing subjects). Where an Owner-facing subscription flow also changes plans, **Superadmin wins** on conflict.
- When Superadmin changes catalogue terms, rates, or policies that bind existing paying Owners, Project Imperium **emails every affected Owner**. The Owner must **accept** to continue under the new terms, or **decline**, which starts **account termination** (each owned business transferred or closed first, per the users and business subjects). **Silence is not acceptance**; acceptance is an explicit action.

### 3.5 Late payment

- When a platform charge is late, Project Imperium **notifies** the payer and establishes a **payment deadline** (default grace from the monetization subject).
- **Subscription** arrears past the deadline **freeze the whole Owner portfolio**. **Weekly commission** arrears past the deadline **freeze only the venue that owes**.
- Managers and console Owners may **override** a specific Owner's deadline or freeze/resume manually; the automatic freeze on a missed deadline still applies when no override clears the debt in time.

### 3.6 Feature flags

- Superadmin turns **feature flags** on or off **platform-wide** or for a **specific paying Owner's** portfolio.
- Venue staff and Customers never manage feature flags.

### 3.7 Scoped impersonation

- A console operator may open an **impersonation session**: act as one **named User** inside **one Business**, for a **time-bounded** window.
- Every action in that session is **audited** and attributed as support-impersonation, not as the user's own unaided intent.
- There is no silent unrestricted access across venues, and a console operator never impersonates another console operator.

### 3.8 Abuse-removal queue

- When a venue files a review **abuse-removal** request (ratings-and-comments subject), the request appears in the Superadmin **abuse-removal queue**.
- Console operators **accept** or **reject** the request. Accept soft-deletes the review (and its business reply, if any) and recomputes aggregates per that subject; reject leaves the review public.
- Superadmin does not author customer reviews or venue replies.

### 3.9 Payment-provider catalogue

- Superadmin maintains the catalogue of **payment providers** Project Imperium offers venues for direct processing. Connecting a venue's account and capturing payments belong to the payments-and-tax subject.

### 3.10 Portfolio analytics

- The console shows **portfolio aggregates** across Owners and venues: plan mix, commission owed and collected, suspensions, go-live counts, and similar roll-ups.
- It does **not** show day-of POS, kitchen, or other operational detail that belongs inside the Business app.

### 3.11 Support scope

- Support on this surface is **ops tooling**: Owner lifecycle, plan and flag overrides, impersonation, and the abuse-removal queue.
- There is **no** general helpdesk or ticket product inside Superadmin.

---

## 4. Roles and entitlements

Venue **base access layers** and job roles do not apply inside the Superadmin console. Only **console operators** with **console roles** act here. Paying Owners, venue managers, and Customers have no Superadmin access.

### Console roles

| Console role | Powers |
| --- | --- |
| **Staff** | Read Owners and venues; work the abuse-removal queue; open scoped impersonation sessions; view portfolio analytics. |
| **Manager** | Everything Staff can do, plus create and disable console operators (enrollment), assign or override plans, edit feature flags (platform-wide or per-Owner), suspend/resume paying Owners, soft-delete paying Owners, override payment deadlines, and maintain the payment-provider catalogue. |
| **Owner** | **Same tool entitlements as Manager.** Additionally marks **ownership of the Imperium application** (multiple console Owners allowed). |

### Who can do what

| Activity | Who |
| --- | --- |
| Sign into the Superadmin console | Enrolled console operator with MFA |
| Create a console operator and send enrollment | Console Manager or console Owner |
| Complete enrollment (credentials + MFA) | The invited console operator |
| Read Owners, Companies, Businesses | Any console operator |
| Work the abuse-removal queue | Any console operator |
| Scoped impersonation | Any console operator |
| Assign or override a paying Owner's plan | Console Manager or console Owner |
| Edit the plan catalogue (prices, base rates, card recovery, entitlements, creation quotas, retention and lifecycle constants) | Console Manager or console Owner |
| Edit feature flags | Console Manager or console Owner |
| Suspend / resume / freeze a paying Owner or venue for arrears | Console Manager or console Owner |
| Soft-delete a paying Owner | Console Manager or console Owner |
| Override a payment deadline | Console Manager or console Owner |
| Maintain the payment-provider catalogue | Console Manager or console Owner |
| View portfolio analytics | Any console operator |
| Approve ordinary go-live | No one in Superadmin — business/monetization gates |
| Hard-delete any identity outside retention purge | No one — soft delete for operators; retention purge only per plan quotas and data retention subject |
| Run venue day-to-day service from Superadmin | No one |
| Open a general helpdesk ticket product | Out of scope |
| Customer or Business User access via console-operator credentials | Never |
