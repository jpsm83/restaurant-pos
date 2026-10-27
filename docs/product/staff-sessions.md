# Staff sessions

> **About this document.** This is the **target-state source of truth** for how staff sign in and act across devices in Project Imperium — personal credentials only, one User per browser session, concurrent sessions, and the exclusion of shared-login / PIN / quick-switch identity. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes staff sessions as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **how a person uses Project Imperium for Business work on devices**:

- that every staff actor signs in with **their own** User email and password — never a shared staff login;
- that the device may be the employee’s **own** or a **venue-provided** browser device — both are allowed;
- that at any moment a browser session belongs to **exactly one** signed-in User (**one employee session per device browser**);
- that one User may hold **many concurrent sessions** across devices, and those sessions are **peer-equal**;
- that every Business action attributes to the **signed-in User** on the session that performed it;
- that **staff PIN**, **quick-switch**, and **in-app lock-screen** identity flows (ways for several people to share one signed-in browser without full sign-in) are **out of scope** for Project Imperium.

It deliberately does **not** cover:

- **credentials**, access and refresh session mechanics, revoke-on-password or email change, mode eligibility, or account lifecycle — the users subject owns those. This subject only states multi-session allowance, attribution, personal-vs-venue device allowance, and the one-User-per-session rule;
- **base access layers**, effective layer, schedule gating for Business entry, and per-user capabilities — the access-and-permissions and users subjects own those. Opening Business and acting under a layer still require the signed-in User to be eligible as those subjects already define;
- **on duty**, daily attendance QR, late lock, breaks, and manager sign-out — the time-control subject. Duty is independent of which device the person uses; leaving an app or device does not end duty;
- **navigation chrome** and phone/tablet layout — the user-navigation subject;
- **venue printers, print connectors, prep and customer screens, and customer kiosk / QR self-ordering hardware** — printers-and-screens, sales-points-and-instances, and order-flow. Those are output, bridge, or guest surfaces; they are not a substitute for each staff actor’s own signed-in session when that person acts in Business;
- **Superadmin** authentication — the superadmin subject’s separate realm;
- **biometrics** and **device fleet management** — out of product scope. An ordinary **OS-level device lock** on the phone, tablet, or laptop is enough when the device sits idle; Project Imperium does not add an in-app lock.

---

## 2. Domain model and vocabulary

### Entities

This subject introduces **no new persistent business entity**. It constrains how the users subject’s **sessions** are used for Business work across devices.

### Terms this subject introduces

- **Staff device** — any browser device used for Business work: the employee’s **personal** phone, laptop, or desktop, or a **venue-provided** phone, tablet, or computer. Ownership of the hardware does not change the sign-in rule.
- **Peer session** — one of several concurrent signed-in sessions for the same User; each has the same eligibility and powers the User is entitled to at that moment. There is no primary device.

Terms reused rather than redefined here: **User**, **sign-in email**, **password**, **access token**, **refresh session**, **mode** (Customer | Business), **on duty**, **base access layer**, **effective layer**, **per-user capability**, and **Business**.

---

## 3. Capabilities

### 3.1 Personal sign-in only

- Every person who acts in Business mode signs in with **their own** User **sign-in email** and **password**. There is no venue-wide staff password, no shared tablet account, and no anonymous floor login.
- Project Imperium does **not** provide a staff **PIN**, **passcode**, **quick-switch** between people on one browser, or an **in-app lock screen** that lets another person unlock as themselves without a full sign-in.
- Handing a device to a colleague does **not** change who the product treats as the actor. The signed-in User remains that User until they sign out or their sessions are revoked (users subject).

### 3.2 Personal or venue devices; one User per session

- An employee may work from **their own** device. A venue may also **provide** phones, tablets, or computers and require staff to use them. Both are fine.
- Whatever the hardware, **each browser session is unique to one employee**: only that signed-in User is the actor on that session. Two people never share one active Business session.
- When a venue device passes from one employee to another, the previous User **signs out** (or their session ends) and the next employee signs in with **their own** email and password. There is no PIN handoff.
- Project Imperium sells no staff hardware and does not enroll, name, or manage staff devices.
- Venue-owned **printers**, **print connectors**, **prep and customer screens**, and **customer kiosk** terminals remain as their own subjects describe. Any Business action on a browser still belongs to whoever signed in on that session with their own credentials.
- A **print connector** runs as a system service on the venue PC under its own connector credential. It is not a staff session and never signs in as a person.
- A **display lease** for a prep, delivery, or pickup screen is **not a staff session** and authenticates **no person**. It is a route- and action-scoped device grant opened by a manager; actions taken under it attribute to the lease opener, and it never replaces any person's own signed-in session for acting in Business (printers-and-screens subject).

### 3.3 Concurrent multi-session

- One User may be signed in on **several devices at once** (for example their phone and a venue tablet). Each session is a **peer session**: same mode eligibility, same effective layer and capabilities, same on-duty facts.
- Actions on any peer session attribute to that **User**. There is no “primary device” and no session that outranks another for the same person.
- **Revoking refresh sessions** (password reset or change, sign-in email change, and any other wholesale revoke the users subject defines) ends sessions across devices. This subject does not add a separate revoke model.
- Concurrent work on the same sales instance, batch, or payment still follows the realtime-and-concurrency subject; multi-session does not create a second conflict model.

### 3.4 Composition with duty, schedule, and access

- **Signing in** is not **on duty**. Becoming on duty remains scanning the daily attendance QR under the time-control subject, from the person’s own signed-in Business session (or from a manager-layer user presenting the QR on **their** own signed-in session for others to scan on theirs).
- **Schedule gating** and **entry window** rules for employee- and supervisor-layer Business access remain exactly as the users and schedules subjects define them. A second device does not bypass those rules.
- **Effective layer** and **per-user capabilities** resolve for the signed-in User as the access-and-permissions subject defines. Peer sessions do not carry different layers for the same person at the same moment.
- Tab **responsibility handover** and similar requests require **both** people to act in **their own** signed-in session: the receiver **requests** the tab, and the current responsible employee **accepts or declines** — never by entering a PIN on someone else’s open session.

### 3.5 Out of scope

Project Imperium does **not** include:

- a shared staff login or anonymous station account used by many people without individual sign-in;
- staff PIN or passcode identity for floor switch;
- quick-switch of the active employee on one browser without full sign-in;
- in-app idle lock that unlocks as a different person;
- device fleet management or biometrics as staff identity.

Venue-provided staff devices are **in** scope as ordinary browsers under §3.2; what is out of scope is sharing one signed-in session across employees.

---

## 4. Roles and entitlements

### Base access layers

This subject does not grant powers by layer. Every layer that may enter Business mode does so only as the **signed-in User** on their own session, under users and access-and-permissions.

| Layer | Staff-session bearing |
| --- | --- |
| **Customer** | Signs in with their own credentials; may hold peer sessions. No Business floor identity without eligible Business access. |
| **Employee** | Own credentials on personal or venue staff device; peer multi-session; Business only when schedule-eligible; on duty only via time-control. |
| **Supervisor** | Same one-User-per-session rules as employee for sign-in and multi-session; still schedule-gated for Business. |
| **Manager** | Own credentials; peer multi-session; may present attendance QR from their own session; never a shared manager login on a device. |
| **Admin** | Same one-User-per-session rules as manager for device identity. |

### Per-user capabilities

No new capabilities. Catalogue powers apply to the signed-in User on the session that acts (access-and-permissions).

### Who can do what

| Activity | Who |
| --- | --- |
| Sign in with email and password on a personal or venue staff device | The User who owns those credentials |
| Hold concurrent sessions on several devices | That same User |
| Act in Business on a session | The signed-in User, when mode-eligible and otherwise permitted |
| Request, accept, or decline a tab handover | Each person in their own signed-in session (the receiver requests; the current owner accepts or declines) |
| Take over a venue device after a colleague | Previous User signs out (or session ends); next User signs in with full email and password — no PIN switch |
| Configure shared staff login, PIN, or quick-switch | Nobody — not in the product |
