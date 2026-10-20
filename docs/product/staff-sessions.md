# Staff sessions

> **About this document.** This is the **target-state source of truth** for how staff sign in and act across devices in Project Imperium — personal credentials only, concurrent sessions, and the explicit exclusion of shared-staff-device access. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes staff sessions as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **how a person uses Project Imperium for Business work on devices**:

- that every staff actor signs in with **their own** User email and password — never a shared staff login;
- that one User may hold **many concurrent sessions** across devices, and those sessions are **peer-equal**;
- that every Business action attributes to the **signed-in User** on the session that performed it;
- that staff identity runs on each person's **own personal browser device** (typically a phone; also laptop or desktop), with no shared staff station;
- the explicit product stance that **shared staff devices**, **staff PIN**, **quick-switch**, and **in-app lock-screen** identity flows are **out of scope** for Project Imperium.

It deliberately does **not** cover:

- **credentials**, access and refresh session mechanics, revoke-on-password or email change, mode eligibility, or account lifecycle — the users subject owns those. This subject only states multi-session allowance, attribution, and the no-shared-device stance those sessions sit under;
- **base access layers**, effective layer, schedule gating for Business entry, and per-user capabilities — the access-and-permissions and users subjects own those. Opening Business and acting under a layer still require the signed-in User to be eligible as those subjects already define;
- **on duty**, daily attendance QR, late lock, breaks, and manager sign-out — the time-control subject. Duty is independent of which personal device the person uses; leaving an app or device does not end duty;
- **navigation chrome** and phone/tablet layout — the user-navigation subject;
- **venue printers, prep and customer screens, and customer kiosk / QR self-ordering hardware** — printers-and-screens, sales-points-and-instances, and order-flow. Those are output or guest surfaces, not staff identity devices;
- **Superadmin** authentication — the superadmin subject’s separate realm;
- **biometrics** and **device fleet management** — out of product scope. An ordinary **OS-level device lock** on the person's phone or laptop is enough when the device sits idle; Project Imperium does not add an in-app lock.

---

## 2. Domain model and vocabulary

### Entities

This subject introduces **no new persistent business entity**. It constrains how the users subject’s **sessions** are used for Business work across devices.

### Terms this subject introduces

- **Personal device** — the browser device the person themselves uses to sign in (their phone, laptop, or desktop). Staff identity never rides on a venue “pool” tablet or shared station login.
- **Peer session** — one of several concurrent signed-in sessions for the same User; each has the same eligibility and powers the User is entitled to at that moment. There is no primary device.

Terms reused rather than redefined here: **User**, **sign-in email**, **password**, **access token**, **refresh session**, **mode** (Customer | Business), **on duty**, **base access layer**, **effective layer**, **per-user capability**, and **Business**.

---

## 3. Capabilities

### 3.1 Personal sign-in only

- Every person who acts in Business mode signs in with **their own** User **sign-in email** and **password**. There is no venue-wide staff password, no shared tablet account, and no anonymous floor login.
- Project Imperium does **not** provide a staff **PIN**, **passcode**, **quick-switch** between people on one browser, or an **in-app lock screen** that lets another person unlock as themselves without a full sign-in.
- Handing a phone or laptop to a colleague does **not** change who the product treats as the actor. The signed-in User remains that User until they sign out or their sessions are revoked (users subject).

### 3.2 Device-free staff work

- Staff identity and Business actions run on each person’s **own personal device**. The intended floor pattern is that the employee uses **their own browser device** (typically their phone) when work requires a screen — not a shared POS tablet pool.
- Project Imperium sells no staff hardware and does not enroll, name, or manage staff devices.
- Venue-owned **printers**, **prep and customer screens**, and **customer kiosk** terminals remain as their own subjects describe. They are not a channel for shared staff identity: any Business action on a browser still belongs to whoever signed in on that session with their own credentials.

### 3.3 Concurrent multi-session

- One User may be signed in on **several devices at once**. Each session is a **peer session**: same mode eligibility, same effective layer and capabilities, same on-duty facts.
- Actions on any peer session attribute to that **User**. There is no “primary device” and no session that outranks another for the same person.
- **Revoking refresh sessions** (password reset or change, sign-in email change, and any other wholesale revoke the users subject defines) ends sessions across devices. This subject does not add a separate revoke model.
- Concurrent work on the same sales instance, batch, or payment still follows the realtime-and-concurrency subject; multi-session does not create a second conflict model.

### 3.4 Composition with duty, schedule, and access

- **Signing in** is not **on duty**. Becoming on duty remains scanning the daily attendance QR under the time-control subject, from the person’s own signed-in Business session (or from a manager-layer user presenting the QR on **their** own signed-in session for others to scan on theirs).
- **Schedule gating** and **entry window** rules for employee- and supervisor-layer Business access remain exactly as the users and schedules subjects define them. A second device does not bypass those rules.
- **Effective layer** and **per-user capabilities** resolve for the signed-in User as the access-and-permissions subject defines. Peer sessions do not carry different layers for the same person at the same moment.
- Tab **responsibility handover** and similar approvals require the receiving person to act in **their own** signed-in session — never by entering a PIN on someone else’s device.

### 3.5 Out of scope

Project Imperium does **not** include:

- shared staff tablet or station login;
- staff PIN or passcode identity for floor switch;
- quick-switch of the active employee on one browser without full sign-in;
- in-app idle lock that unlocks as a different person;
- device fleet management, supervised shared devices, or biometrics as staff identity.

---

## 4. Roles and entitlements

### Base access layers

This subject does not grant powers by layer. Every layer that may enter Business mode does so only as the **signed-in User** on a personal session, under users and access-and-permissions.

| Layer | Staff-session bearing |
| --- | --- |
| **Customer** | Signs in with their own credentials; may hold peer sessions. No Business floor identity without eligible Business access. |
| **Employee** | Own credentials; peer multi-session; Business only when schedule-eligible; on duty only via time-control. |
| **Supervisor** | Same personal-session rules as employee for sign-in and multi-session; still schedule-gated for Business. |
| **Manager** | Own credentials; peer multi-session; may present attendance QR from their own session; never a shared manager device login. |
| **Admin** | Same personal-session rules as manager for device identity. |

### Per-user capabilities

No new capabilities. Catalogue powers apply to the signed-in User on the session that acts (access-and-permissions).

### Who can do what

| Activity | Who |
| --- | --- |
| Sign in with email and password | The User who owns those credentials |
| Hold concurrent sessions on several personal devices | That same User |
| Act in Business on a session | The signed-in User, when mode-eligible and otherwise permitted |
| Approve a tab handover or similar receiver action | The receiving User, in their own signed-in session |
| Sign in as a different person on a device | Only after the previous User signs out (or sessions are revoked); full email and password — no PIN switch |
| Configure shared staff device access, PIN, or quick-switch | Nobody — not in the product |
