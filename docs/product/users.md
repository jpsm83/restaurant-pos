# Users

> **About this document.** This is the **target-state source of truth** for the global identity model in Project Imperium — the user as customer, ownership, access layers, credentials, sessions, account lifecycle, and **favorites**. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes the global identity model as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **who a person is as a global identity and customer**, and the access rules that sit above venue membership:

- the global **User** — one per person, the holder of every sign-in credential and of **client** personal detail;
- **business ownership** — the **Owner** account that holds one or more **Companies**, each owning its **Business** identities, and the transfer of a business between users;
- the **four base access layers** and **per-user capabilities**;
- the **mode eligibility rule** — when a signed-in user may work in **customer** or **business** mode (exactly two modes);
- **credentials and email** — sign-up, verification, email change, and the business contact email;
- **sessions**, and the **account lifecycle** — pending deletion, soft delete, and reactivation;
- **favorites** — the venues a customer saves for quick access.

It deliberately does **not** cover:

- the **Employee** membership — job roles, employment status, tenure, contract, pay, vacation, tax and national identifiers, documents, hire, terminate, and rehire. The **User** holds only client/global identity; **all employee data lives on the membership**. The employees subject owns that record. This subject names the membership only as the path into a tenant and as input to the mode and layer rules.
- the **navigation surfaces** — the public customer chrome, the **Customer | Business** mode toggle, the **Service** / **Manage** / **Me** left menu inside business mode, guards, and canonical destinations. This subject states the eligibility *rule*; the user-navigation subject owns the surfaces that enforce it. Favorites appear on customer surfaces those subjects own; this subject owns the preference itself.
- **attendance mechanics** — daily attendance QR scan-in, manager sign-out, breaks, and lateness. This subject states the business-mode eligibility *consequence*; the schedules subject owns the planned schedule, and the time-control subject owns attendance.
- **transactional email delivery** — templates, retry, cooldown. This subject states which messages are sent; the emails subject owns how they are delivered.
- **ratings and comments** — venue reviews after a closed sales instance belong to the ratings-and-comments subject. Favorites are bookmarks, not feedback.
- **which venues are live and discoverable** — the business subject owns go-live, offline, and discovery fields. This subject only allows favoriting venues that are live.
- the **superadmin console's** authentication realm, which is separate and belongs to the superadmin subject.

---

## 2. Domain model and vocabulary

### Entities

- **User** — a person's global identity. One per person, platform-wide and tenant-free. The sole holder of sign-in credentials, **client** personal details, preferences (including **favorites**), the notification inbox, and order history. **Every user is a customer.** The User does **not** carry employment fields.
- **Favorite** — a customer's saved bookmark of exactly one **live Business**, held on that customer's **User**. At most one favorite exists per user per business.
- **Owner** — the portfolio account for a user who owns businesses. One per user, created or updated when that user registers a business. Holds the **Companies** it controls, the **subscription**, and the **commission terms**.
- **Company** — the **tax entity** owned by exactly one **Owner**: a group of one or more **Businesses** run as one legal unit, holding their **tax number**. Stock moves only within a Company.
- **Employee** — a person's membership in one business (owned in full by the employees subject). The only way a user joins a tenant.
- **Business** — the tenant, one venue (owned by exactly one user through that user's **Owner** and belonging to exactly one **Company**). Carries its own public profile and **contact email**, but holds **no credentials** of its own.

Membership is one-to-many on both sides — one user may hold a membership per business, and one business holds many memberships:

```
User ──< Employee >── Business          (membership: the only path into a tenant; employees subject)
User ──1 Owner ──< Company ──< Business  (ownership: exactly one owning user per business)
```

### Terms this subject introduces

- **Base access layer** — exactly one of **admin**, **manager**, **employee**, or **customer**. Defines what a user may do at the highest level. *Customer* is always present; the other three come from a membership, and during a shift, from that shift's role.
- **Per-user capability** — a named power granted or revoked on top of a base layer's defaults, assigned per user by managers and above.
- **Mode** — whether a signed-in user is in the **customer** or **business** app. Exactly two modes; there is no separate employee mode. The person may switch during the session via the mode toggle when eligible. Floor work and administration are **left-menu headers inside business mode** (Service, Manage, and Me), owned by the user-navigation subject — not additional modes.
- **Sign-in email** — the email credential on the **User**. Distinct from a business's contact email.
- **Business contact email** — a business's own verified email, used for venue messages and receipts. Never a credential.
- **Pending deletion** — the account state during the cancellation window between a user's deletion request and the soft delete that follows it.
- **Reactivation** — restoring a soft-deleted account, which always requires confirmation through the sign-in email.

**Job role** is introduced and owned by the employees subject; this subject reads job roles only to resolve base layers and mode eligibility. Terms reused rather than redefined here for favorites: **Business**, **live** venue, and **discovery**.

---

## 3. Capabilities

### 3.1 One identity, one login

Project Imperium stores **one user per person**, and that user is the single holder of the person's sign-in credentials. A person never ends up with two accounts for the same identity. Sign-in is one shared form. The Customer app is usable **without** signing in for public browse and for assembling an order; after authenticating, the person remains on the Customer surface and §3.7 governs when they may enter business mode.

### 3.2 Every user is a customer

Creating a user grants the **customer identity unconditionally**. There is no business-only account and no way for a person to surrender customer access. Customer mode is always available. Visitors who never sign in still use the public Customer surface; once signed in, a user with no eligible business access simply has no Business side on the mode toggle.

### 3.3 Business ownership and the owner

A **business is owned by exactly one user**. When a user registers a business, Project Imperium **creates or updates that user's Owner** account, which holds the Companies it controls, the subscription, and the commission terms.

- A user may **own many businesses**; each owned venue is its own **Business**, and each Business belongs to exactly one **Company** — the tax entity grouping the venues run as one legal unit. A user adding a venue chooses whether it **joins an existing Company** or **forms a new one**.
- A user may simultaneously **own some venues and be an ordinary employee at others**.
- Registration also creates the owner's **Employee** membership at that venue (Owner job role and admin layer); the employees subject owns that membership and its HR completion.
- **Ownership can be transferred** from one user to another; the **Owner** accounts, their Companies, and their business lists follow the transfer.

### 3.4 Membership is the path into a tenant

A user joins a tenant **only through an employee membership**. This subject does **not** own the membership's fields or lifecycle — the employees subject does.

- A user holds **at most one membership per business**, and may hold **many across businesses**.
- The membership is the **authoritative link**; a **User** never embeds employment data.
- **Termination** ends access through that membership but leaves the user and their customer identity intact (employees subject).

### 3.5 The four base access layers

Exactly four layers exist: **admin**, **manager**, **employee**, **customer**. They are a **classification, not a stored preference**:

- A user with **no membership** resolves to **customer**.
- A membership resolves to one layer, **defaulted from its job roles** (employees subject) — Owner and Admin to **admin**; the management roles to **manager**; every other role to **employee**.
- The layer is resolved **per shift**: the **schedule assigns the job role for a working shift** (role is always required on the schedule), and that shift's role sets the effective layer for its duration. The same person can work one shift as an employee and a later shift as a manager at the same venue.
- When the person is **not** on a working shift, layer resolution uses the **highest layer among the membership's roles** (admin over manager over employee).
- **Managers and above can override** a membership's layer.
- **Customer access is always available** to every user, whatever membership they hold.
- A **Suspended** membership blocks business-app access until cleared (employees subject); layer resolution alone does not reopen it.

### 3.6 Per-user capabilities

On top of the base layer's defaults, **managers and above** assign **named per-user capabilities** that grant or revoke individual powers. Capabilities are additive overrides scoped to what the platform already defines as possible for that user's layer; they never invent new powers. This subject owns the mechanism and the **cross-cutting** capabilities; each feature subject enumerates the capabilities that gate it. Job-role assignment on the membership belongs to the employees subject.

### 3.7 Mode eligibility (Customer | Business)

There is **one login** and **exactly two modes**: **customer** and **business**. There is no third “employee” mode — Service (floor/POS), Manage (administration), and Me (self) are left-menu headers **inside** business mode, owned by the user-navigation subject.

- The **Customer** app is the default public surface. Sign-in is not required to browse or to build an order basket. After sign-in, the person **stays in customer mode** unless they switch.
- When the signed-in user has **eligible business access**, a **Customer | Business** toggle is available in the chrome. They may switch mode during the session; each switch re-checks eligibility. The active mode is recorded so guards can enforce it.
- A user with **only customer access** never sees the Business side of the toggle.
- **Business mode** is available when the user has a membership and is eligible: for ordinary employees, a **planned working shift** whose **entry window** is open — from **10 minutes before** planned start until **2 hours after** planned start — and the membership is not **Suspended** or **Terminated**. Outside that window with no open attendance session, Business is unavailable until a manager reschedules them. Opening business mode is **not** on duty (time-control subject). An employee who already has an open shift session may re-enter business mode for that session without scanning again.
- **Owners, managers, and admins always may use Business** — scheduled or not — because they may need to act at any time (unless that membership is Suspended or Terminated).
- There is **no** late-unlock step on the schedule for business-mode access. Late lock before scan-in belongs to time-control.
- **Customer mode is always available** to every signed-in user.
- **Identity gates (not modes).** Favorites, inbox, order history, and other User-owned preferences require a signed-in User. Customer ordering may proceed as a guest until **payment** is requested; at payment (and at those account-bound actions) Project Imperium requires **sign-in or sign-up**, preserving the open basket. The user-navigation and order-flow subjects own how that gate is presented.

This subject owns the eligibility **rule**; the user-navigation subject owns the chrome toggle, left menu, guards, and destinations.

### 3.8 Credentials, verification, and email change

The **User** owns the sign-in email, the password, and a **single canonical email-verified flag**.

- Sign-up sends a **verification email**. The account is usable before verification, but the flag drives in-app prompts.
- **Changing the sign-in email** requires the **current password**, is **token-verified** by a link sent to the **new address**, is **cooldown-limited**, **notifies the old address**, enforces **uniqueness among active accounts**, and **revokes other sessions**.
- The same verification and change flow applies to **every user** — a business registrant is not a special case.

### 3.9 Business contact email and go-live

Each **Business** carries its **own contact email**, verified by the same token flow. It is **never a credential**.

- A business may be **created as an incomplete draft and configured over time**, before verification.
- A business is **not live until its contact email is verified** *and* its **go-live checklist** is complete; an admin/owner then toggles it live (the checklist and toggle belong to the business subject). **Not live** means **absent from customer discovery** and **unable to take customer orders or bookings**.
- Project Imperium shows a clear **warning on the business page** until the contact email is verified.

### 3.10 Account creation paths

A user comes into existence through one of three paths, and Project Imperium **never duplicates a person**:

1. **Self sign-up** — a person signs up and becomes a customer user.
2. **Managed employee** — a manager or above hires through the employees subject by linking an **existing user by email**. If no user exists for that email, Project Imperium creates the user (a customer) first, then the membership.
3. **Business registration** — a **signed-in user** registers a business; the registrant already exists as a user, and registration creates (or updates) their **Owner**, the **Company** (existing or new), the **Business**, and the owner's membership (employees subject).

### 3.11 Sessions

Project Imperium issues a short-lived **access token** and a **refresh session**. Project Imperium can revoke a user's refresh sessions wholesale whenever the password is reset or changed, or the sign-in email is verified as changed. The **mode** from §3.7 is recorded in a server-side session so guards can enforce it; switching mode updates that record. The **superadmin console's authentication realm is entirely separate** and belongs to the superadmin subject.

### 3.12 Personal profile and preferences

The **User** holds the person's **client personal detail** — name, sign-in email, phone, personal address, birth date, gender, nationality, image — and a **language preference**, so the UI language follows the person independently of the business's currency. The User may also hold **saved payment methods** for in-app customer checkout (how those methods capture money belongs to the payments-and-tax subject). **Employee tax number**, **national ID number**, and other employment identifiers live only on the **Employee** membership (employees subject), not on the User. **Favorites** are a preference of the same User (§3.13). The **customer account area** and Business **Me** destinations that edit these fields are owned by the user-navigation subject.

### 3.13 Favorites

- A **favorite** is a signed-in customer's bookmark of exactly one **Business**. Only a **live** (discoverable) venue may be favorited. Draft or offline venues cannot be added.
- Favorites are **account-bound**: there is no anonymous or device-only favorites list. They travel with the User across sessions and devices.
- A user may hold **at most one favorite per business**. Favoriting again does not create a duplicate. There is **no maximum** number of distinct venues.
- **Add and remove are a toggle.** Unfavoriting removes the bookmark from the customer's list; the customer does not see a soft-delete trail for favorites.
- A user may favorite **any live venue**, including venues they **own or work at** — every user is always a customer.
- Customers add or remove favorites from the venue's **public profile** and from **discovery** cards where the control is shown, and browse the full list on the customer app's **Favorites** page. The list is ordered **most recently favorited first**.
- While a favorited venue is **offline**, it is **hidden** from the customer's favorites list and quick access. When it is live again, it **reappears** if the favorite still exists. If the business is **gone** (closed / removed from the platform's active set), the favorite is **dropped**.
- Favoriting **never** sends a notification or email — not to the venue, not to the customer. Venue reviews remain the ratings-and-comments subject's concern.

### 3.14 Inbox and order history

The **notification inbox** and **order history** belong to the **User** and are **shared across customer and business modes** — a person's history does not fork by mode.

### 3.15 Account deletion

Deleting an account is **self-service** and **two-phase**:

1. **Request → pending deletion.** The account enters a **pending-deletion** state for a **15-day grace window**. Sign-in **still works** during the window, precisely so the user can **cancel** the deletion; the account is otherwise not public.
2. **Soft delete.** After the window, the **soft-delete marker** is applied and **sign-in is blocked**. The data is **retained** (see §3.17).

Deletion is **blocked until the user resolves every business they own** — each must be **transferred to another user** or **closed** first. Deletion **never cascades** into other people's records: Project Imperium does not silently destroy data that others depend on. The user's favorites are retained with the account under the soft-delete convention and are not visible while sign-in is blocked.

### 3.16 Reactivation

A soft-deleted account can be **reactivated**, but reactivation is **never completed inside the app alone** — it always requires **confirming a link sent to the account's sign-in email**, so knowing an email is never enough to reach a deleted account's data. Reactivation **restores the user, the customer identity, their history, and their favorites** (subject to the live/offline rules in §3.13); memberships return **only if still valid** at their venues, and otherwise stay terminated (employees subject).

### 3.17 Soft delete, platform-wide

Under Project Imperium's **soft-delete convention**, an identity — a **User**, **Owner**, **Company**, **Employee**, or **Business** — is never hard-deleted. Project Imperium marks it deleted and stamps the time, retains it, and can reactivate it; uniqueness is enforced among active identities, so reusing a soft-deleted email means **reactivating** that account, not creating a duplicate.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Identity powers |
| --- | --- |
| **Customer** | Holds a **User**; may use the public Customer surface unsigned for browse and basket assembly; signs in for account-bound actions and payment; manages their own profile, **favorites**, and account deletion. Always available to everyone. |
| **Employee** | Everything a customer can do, plus business mode (Service → POS, and Me) when the membership is eligible (planned working shift in window, not Suspended or Terminated). |
| **Manager** | Everything an employee can do, plus the Manage header, assigning per-user capabilities, and overriding a membership's layer. Always allowed into business mode when the membership allows. Hiring, HR, and termination belong to the employees subject. Schedule editing belongs to the schedules subject. |
| **Admin** | Full venue control, including ownership actions and Manage; always allowed into business mode when the membership allows. |

### Per-user capabilities

Granted or revoked per user by **managers and above**, on top of the layer defaults. Each feature subject names the capabilities it gates; this subject owns the mechanism and the cross-cutting capabilities.

### Who can do what

| Activity | Who |
| --- | --- |
| Sign up / sign in / switch mode | Anyone may sign up or sign in; Business on the mode toggle needs eligible business access |
| Register a business | Any user (becomes the **Owner**, an admin at that venue; employees subject creates the owner membership) |
| Own / transfer / close a business | The owning user |
| Override a membership's base layer | Managers and above |
| Assign per-user capabilities | Managers and above |
| Hire, edit HR, terminate, rehire | Employees subject (managers and above; rehire admin/owner) |
| Edit schedules / approve time-off | Schedules subject (managers and above) |
| Delete one's own account | The account's user |
| Reactivate a soft-deleted account | The account's user, by email-confirmed link |
| Favorite or unfavorite a live venue | The signed-in user (customer identity) |
| Browse own favorites list | The signed-in user |
| See another user's favorites | No one |
| Manage Owners, plans, and commission | The superadmin (superadmin subject) |
