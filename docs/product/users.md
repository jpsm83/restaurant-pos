# Users

> **About this document.** This is the **target-state source of truth** for the global identity model in POS. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes the global identity model as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **who a person is and what they may do** across the whole platform:

- the global **`User`** — one per person, the holder of every sign-in credential;
- **business ownership** — the `Owner` account that owns one or more `Business` identities, and the transfer of a business between users;
- the **`Employee`** membership — the per-venue link that makes a user part of a business;
- the **four base access layers**, the **job roles**, and **per-user capabilities**;
- the **login mode chooser** — the rule by which a signed-in user picks between the customer and business apps;
- **credentials and email** — sign-up, verification, email change, and the business contact email;
- **sessions**, and the **account lifecycle** — pending deletion, soft delete, and reactivation.

It deliberately does **not** cover:

- the **navigation surfaces** — the chooser screen, route guards, and canonical URLs. This subject states the eligibility *rule*; the user-navigation subject owns the surfaces that enforce it.
- **attendance mechanics** — shifts, breaks, the late lock, and the manager unlock. This subject states the eligibility *consequence*; the schedules and time-control subjects own the mechanics.
- **transactional email delivery** — templates, retry, cooldown. This subject states which messages are sent; the emails subject owns how they are delivered.
- the **superadmin console's** authentication realm, which is separate and belongs to the superadmin subject.
- **employment detail** — pay, contract hours, vacation, documents. This subject owns the membership and its access meaning; the employees subject owns HR detail.

---

## 2. Domain model and vocabulary

### Entities

- **`User`** — a person's global identity. One per person, platform-wide and tenant-free. The sole holder of sign-in credentials, personal details, preferences, the notification inbox, and order history. **Every user is a customer.**
- **`Owner`** — the portfolio account for a user who owns businesses. One per user, created or updated when that user registers a business. Holds the businesses it controls, the **subscription**, and the **commission terms**.
- **`Employee`** — a person's membership in one business: the per-`(User, Business)` link carrying the user's job role(s) and employment state. The only way a user joins a tenant.
- **`Business`** — the tenant, one venue (owned by exactly one user through that user's `Owner`). Carries its own public profile and **contact email**, but holds **no credentials** of its own.

Membership is one-to-many on both sides — one user may hold a membership per business, and one business holds many memberships:

```
User ──< Employee >── Business          (membership: the only path into a tenant)
User ──1 Owner ──< Business              (ownership: exactly one owning user per business)
```

### Terms this subject introduces

- **Base access layer** — exactly one of **admin**, **manager**, **employee**, or **customer**. Defines what a user may do at the highest level. *Customer* is always present; the other three come from a membership, and during a shift, from that shift's role.
- **Job role** — a value from the canonical job-role enumeration (Owner, General Manager, Manager, Assistant Manager, MoD, Admin, Operator, Employee, Cashier, Floor Staff, Bartender, Barista, Waiter, Head Chef, Sous Chef, Line Cooks, Kitchen Porter, Cleaner, Security, Host, Runner, Supervisor, Entertainer, Other). Describes *what a person is*; the base layer describes *what they may do*.
- **Per-user capability** — a named power granted or revoked on top of a base layer's defaults, assigned per user by managers and above.
- **Mode** — the app a signed-in user chooses to work in: **customer** or **business** (employee). Chosen once per session after login.
- **Sign-in email** — the email credential on the `User`. Distinct from a business's contact email.
- **Business contact email** — a business's own verified email, used for venue messages and receipts. Never a credential.
- **Pending deletion** — the account state during the cancellation window between a user's deletion request and the soft delete that follows it.
- **Reactivation** — restoring a soft-deleted account, which always requires confirmation through the sign-in email.

---

## 3. Capabilities

### 3.1 One identity, one login

POS stores **one `User` per person**, and that user is the single holder of the person's sign-in credentials. A person never ends up with two accounts for the same identity. Sign-in is one shared form; after authenticating, POS applies the mode rule in §3.8.

### 3.2 Every user is a customer

Creating a user grants the **customer identity unconditionally**. There is no business-only account and no way for a person to surrender customer access. Customer mode is always available and is the default destination for a user with no business access.

### 3.3 Business ownership and the `Owner`

A **`Business` is owned by exactly one user**. When a user registers a business, POS **creates or updates that user's `Owner`** account, which holds the businesses it controls, the subscription, and the commission terms.

- A user may **own many businesses**; each owned venue is its own `Business`.
- A user may simultaneously **own some venues and be an ordinary employee at others**.
- The owner automatically takes the **Owner job role** and the **admin** base layer at every venue they own.
- **Ownership can be transferred** from one user to another; the `Owner` accounts and their business lists follow the transfer.

### 3.4 Employee membership

A user joins a tenant **only through an `Employee` membership** — a per-`(User, Business)` record carrying job role(s) and employment state.

- A user holds **at most one membership per business**, and may hold **many across businesses**.
- The membership is the **authoritative link**; a `User` never embeds a single employee reference.
- **Employment state** (`active`, join date, termination date) is the tenure lifecycle. **Termination ends a membership but leaves the user and their customer identity intact.**
- Pay, contract hours, vacation, and documents are the employees subject's; this subject owns the binding and its access meaning.

### 3.5 The four base access layers

Exactly four layers exist: **admin**, **manager**, **employee**, **customer**. They are a **classification, not a stored preference**:

- A user with **no membership** resolves to **customer**.
- A membership resolves to one layer, **defaulted from its job role** — Owner and Admin to **admin**; the management roles to **manager**; every other role to **employee**.
- The layer is resolved **per shift**: the **schedule assigns the job role for a shift**, and that shift's role sets the effective layer for its duration. The same person can work one shift as an employee and a later shift as a manager at the same venue.
- When a shift declares **no role**, the membership falls back to the **highest layer among its roles** (admin over manager over employee).
- **Managers and above can override** a membership's layer.
- **Customer access is always available** to every user, whatever membership they hold.

### 3.6 Job roles

A user's job is described by the canonical job-role enumeration (§2). Roles and layers are separate concerns: the role says *what the person is*, the layer says *what they may do*. A user may hold **several job roles** on one membership, and the **schedule selects which role — and therefore which layer — the user works in for a given shift**.

### 3.7 Per-user capabilities

On top of the base layer's defaults, **managers and above** assign **named per-user capabilities** that grant or revoke individual powers. Capabilities are additive overrides scoped to what the platform already defines as possible for that user's layer; they never invent new powers. This subject owns the mechanism and the **cross-cutting** capabilities; each feature subject enumerates the capabilities that gate it.

### 3.8 The login mode chooser

There is **one login**. After authenticating:

- A user with **only customer access** goes straight to the customer app.
- A user with **business access** chooses **customer** or **business (employee)** mode. The chosen mode is recorded for the session.
- The **employee option** is available when the user has a membership and is eligible: **scheduled for that time**, with the option opening **10 minutes before shift start**.
- **Owners, managers, and admins always see both options** — scheduled or not — because they may need to act at any time.
- A **late employee is locked out** of the employee option until a **manager unlocks** them; the **real entry time is preserved** regardless (time-control subject).
- **Customer mode is always available.**

This subject owns the eligibility **rule**; the user-navigation subject owns the chooser screen, the guards, and the URLs.

### 3.9 Credentials, verification, and email change

The `User` owns the sign-in email, the password, and a **single canonical email-verified flag**.

- Sign-up sends a **verification email**. The account is usable before verification, but the flag drives in-app prompts.
- **Changing the sign-in email** requires the **current password**, is **token-verified** by a link sent to the **new address**, is **cooldown-limited**, **notifies the old address**, enforces **uniqueness among active accounts**, and **revokes other sessions**.
- The same verification and change flow applies to **every user** — a business registrant is not a special case.

### 3.10 Business contact email and go-live

Each `Business` carries its **own contact email**, verified by the same token flow. It is **never a credential**.

- A business may be **created as an incomplete draft and configured over time**, before verification.
- A business is **not live until its contact email is verified** *and* its **go-live checklist** is complete; an admin/owner then toggles it live (the checklist and toggle belong to the business subject). **Not live** means **absent from customer discovery** and **unable to take customer orders or bookings**.
- POS shows a clear **warning on the business page** until the contact email is verified.

### 3.11 Account creation paths

A user comes into existence through one of three paths, and POS **never duplicates a person**:

1. **Self sign-up** — a person signs up and becomes a customer user.
2. **Managed employee** — a manager or above creates an employee membership by linking an **existing user by email**. If no user exists for that email, POS creates the user (a customer) first, then links the membership.
3. **Business registration** — a **signed-in user** registers a business; the registrant already exists as a user, and registration creates (or updates) their `Owner`, the `Business`, and the owner's membership.

### 3.12 Sessions

POS issues a short-lived **access token** and a **refresh session**. POS can revoke a user's refresh sessions wholesale whenever the password is reset or changed, or the sign-in email is verified as changed. The mode chosen in §3.8 is recorded in a server-side session cookie so guards can enforce it. The **superadmin console's authentication realm is entirely separate** and belongs to the superadmin subject.

### 3.13 Personal profile and preferences

The `User` holds the person's **personal detail** — name, sign-in email, phone, personal address, ID type and number, birth date, gender, nationality, image — and a **language preference**, so the UI language follows the person independently of the business's currency.

### 3.14 Inbox and order history

The **notification inbox** and **order history** belong to the `User` and are **shared across the customer and employee modes** — a person's history does not fork by mode.

### 3.15 Account deletion

Deleting an account is **self-service** and **two-phase**:

1. **Request → pending deletion.** The account enters a **pending-deletion** state for a **15-day grace window**. Sign-in **still works** during the window, precisely so the user can **cancel** the deletion; the account is otherwise not public.
2. **Soft delete.** After the window, the **soft-delete marker** is applied and **sign-in is blocked**. The data is **retained** (see §3.17).

Deletion is **blocked until the user resolves every business they own** — each must be **transferred to another user** or **closed** first. Deletion **never cascades** into other people's records: POS does not silently destroy data that others depend on.

### 3.16 Reactivation

A soft-deleted account can be **reactivated**, but reactivation is **never completed inside the app alone** — it always requires **confirming a link sent to the account's sign-in email**, so knowing an email is never enough to reach a deleted account's data. Reactivation **restores the user, the customer identity, and their history**; memberships return **only if still valid** at their venues, and otherwise stay terminated.

### 3.17 Soft delete, platform-wide

Under POS's **soft-delete convention**, an identity — a `User`, `Owner`, `Employee`, or `Business` — is never hard-deleted. POS marks it deleted and stamps the time, retains it, and can reactivate it; uniqueness is enforced among active identities, so reusing a soft-deleted email means **reactivating** that account, not creating a duplicate.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Identity powers |
| --- | --- |
| **Customer** | Holds a `User`; signs in; uses the customer app; manages their own profile and account deletion. Always available to everyone. |
| **Employee** | Everything a customer can do, plus business mode when scheduled and unlocked. |
| **Manager** | Everything an employee can do, plus creating memberships, assigning job roles and capabilities, overriding a membership's layer, and unlocking late entries. Always allowed into business mode. |
| **Admin** | Full venue control, including ownership actions; always allowed into business mode. |

### Job roles

Job roles describe the person and default the layer (Owner/Admin → admin; management roles → manager; others → employee). They are assignable by managers and above and do not by themselves grant powers beyond the layer.

### Per-user capabilities

Granted or revoked per user by **managers and above**, on top of the layer defaults. Each feature subject names the capabilities it gates; this subject owns the mechanism and the cross-cutting capabilities.

### Who can do what

| Activity | Who |
| --- | --- |
| Sign up / sign in / choose mode | Anyone (mode choice needs business access) |
| Register a business | Any user (becomes the `Owner`, an admin at that venue) |
| Own / transfer / close a business | The owning user |
| Create or link an employee membership | Managers and above |
| Assign job roles and capabilities | Managers and above |
| Override a membership's base layer | Managers and above |
| Unlock a late employee's entry | A manager on duty |
| Delete one's own account | The account's user |
| Reactivate a soft-deleted account | The account's user, by email-confirmed link |
| Manage Owners, plans, and commission | The superadmin (superadmin subject) |

---

## 5. Current vs target

*The only place current status is recorded.*

### What exists today

**Models** (`backend/src/models/`):

- `user.ts` — a `User` with embedded `personalDetails`, a **singular** `employeeDetails` reference, `selfOrders`, an embedded `notifications` array, `emailVerified` (a legacy **root mirror**), `verificationToken`, `resetPasswordToken`/`resetPasswordExpires`, and `refreshSessionVersion`.
- `personalDetails.ts` — name, email (unique, lowercased), password, ID type/number, address, birth date, gender, nationality, phone, image, and the canonical `emailVerified`.
- `employee.ts` — per-business membership (`businessId`, `userId`), job roles, `active`, `onDuty`, `taxNumber`, join/salary/vacation/contract/termination/documents fields.
- `business.ts` — the tenant, which today also carries its **own credentials** (`password`, `emailVerified`, `verificationToken`, `resetPassword*`, `pendingEmail*`, `refreshSessionVersion`) and logs in as role `"Tenant"`.
- **No `Owner` model exists**, and `Business` has no ownership link.

**Routes** (`backend/src/routes/v1/`):

- `auth.ts` — signup, login, refresh, logout, `me`, set-mode/mode, request/confirm email, request/reset password, request/confirm email change (email change is **business-only**), resend confirmation.
- `users.ts` — list/create/read/update/delete users; notification read/deleted flags.
- `employees.ts` — CRUD plus business listing; maintains the `User ↔ Employee` link transactionally.
- `business.ts` — discovery, profile read/update, and **registration** (creates a `Business` only, issuing a `"Tenant"` session).

**Screens** (`frontend/src/pages/`, routes in `appRoutes.tsx`): sign-up, login, forgot/reset password, confirm email, confirm email change, the mode chooser (`/:userId/mode`), customer profile/dashboard, employee profile/dashboard, and business register/settings. The mode chooser computes eligibility client-side against a **5-minute** early window.

### Gap to target

- **No `Owner`.** Target requires a per-user `Owner` holding businesses, subscription, and commission; today ownership is not modelled at all.
- **Two disjoint credential stores.** Target moves all credentials onto `User` and makes `Business` a credentials-free, verified-contact tenant; today `Business` has its own password and a `"Tenant"` login.
- **Business registration creates no user.** Target creates or links the registrant's `User`, the `Owner`, and the owner's membership; today it creates a `Business` only.
- **Singular membership link.** Target is per-venue membership with many per user; today `User.employeeDetails` is a single reference.
- **No access-layer enum and no capabilities.** Target has four layers defaulted from job roles plus per-user capabilities; today there is only the job-role enum and a `managementRolesEnums` subset, with authorization checked ad hoc in routes.
- **No soft delete.** Target forbids hard deletes and adds a deleted marker; today `DELETE` routes remove documents and even run a dead `User.deleteMany({ businessId })` cascade.
- **Mode window is 5 minutes, and there is no late unlock.** Target is a 10-minute window with a manager unlock that preserves the real entry time; today the window is 5 minutes and no unlock exists.
- **No go-live gate.** Target keeps an unverified business out of discovery and unable to take customer orders; today registration issues a session and verification is non-blocking.
- **Email change is business-only.** Target applies the same verified, re-authenticated, cooldown-limited flow to every user; today a user's email changes through a token-less profile update.
- **No pending-deletion or reactivation.** Target has a 15-day cancellable window and email-confirmed reactivation; today deletion is immediate and hard.
- **Interface drift** — `IUser` omits `refreshSessionVersion`, and `IEmployee` carries a stray `notifications` field; the target model should reconcile these.

### ADR conflicts

- **ADR-0003 (soft delete).** The current `DELETE` routes hard-delete users, employees, and businesses — including the dead `User.deleteMany({ businessId })` cascade — which **contradicts** the accepted soft-delete decision. The target replaces them with soft deletes, so the conflict is a known gap to close, not an override.
- **ADR-0001 (zod DTOs exclude server-owned fields).** No conflict, but a constraint: the target adds server-owned fields — the deleted marker, the deleted-at timestamp, the verified flags, and session versioning — all of which must stay **out of every request DTO**.
- **ADR-0002 (dev-only Docker against Atlas).** Does not touch identity.
