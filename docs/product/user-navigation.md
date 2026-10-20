# User navigation

> **About this document.** This is the **target-state source of truth** for user navigation in Project Imperium — the product surfaces, desktop chrome, mode switching, left-menu structure, guards, and canonical destinations that move a person between customer and business work. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes user navigation as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **how a person moves through Project Imperium on the desktop web app**: which surface they are on, how they sign in, how they switch between customer and business work, and how venue and feature navigation is laid out once they are working.

It owns:

- the **three product surfaces** as navigation realms — **Customer**, **Business**, and **Superadmin** (named only as a boundary);
- **desktop chrome** for Customer and Business — top bar, avatar, mode toggle, venue tabs, and the business left menu;
- **mode** as a navigation fact — exactly **Customer** and **Business**, and the surfaces that enforce the users subject's eligibility rule;
- the **customer account area** reached from the avatar;
- **guest** browse and basket behaviour at the navigation layer (identity gates);
- **venue context** — horizontal tabs when the person belongs to more than one business;
- the business **left menu** headers **Service**, **Manage**, and **Me**, and which links sit under each;
- **fullscreen** for Service destinations;
- **guards** — mode, eligibility loss, and deep-link / one-time-link landing behaviour;
- the catalogue of **canonical destinations** this chrome opens (named in business language, not as implementation paths).

It deliberately does **not** cover:

- **who may enter business mode** — membership, entry window, and suspended/terminated rules belong to the users subject; **layer defaults and effective layer** belong to the access-and-permissions subject. This subject enforces those rules in chrome and guards.
- **attendance and on-duty** — daily attendance QR, late lock, and shift sessions belong to the time-control subject. This subject only places Attendance under Service when the person may open it.
- **feature behaviour inside each destination** — orders, schedules, inventory, reports, and the rest belong to their own subjects. This subject only places those destinations in the chrome.
- **the Superadmin console's** own navigation and authentication realm — the superadmin subject owns that surface entirely.
- **a distinct mobile shell** — this subject's chrome commitments are for the **desktop web app**. Phone and tablet layouts are out of scope here. Staff still sign in with full email and password on a personal or venue-provided device; one User per browser session; no shared-login chrome, PIN, or quick-switch (staff-sessions subject).
- **visual design, exact labels, and copy** — out of scope for the product set.

---

## 2. Domain model and vocabulary

### Entities

This subject introduces **no new persistent tenant entity**. It owns navigation structure over the **User**, **Business**, and membership facts other subjects define.

### Terms this subject introduces

- **Product surface** — one of the three top-level realms: **Customer**, **Business**, or **Superadmin**. Customer and Business share one signed-in person when that person has both; Superadmin is a separate realm.
- **Mode** — whether the signed-in person is in the **Customer** or **Business** surface. Exactly two modes; there is no third “employee” mode.
- **Mode toggle** — the desktop chrome control **Customer | Business** that switches mode when the person is eligible for Business.
- **Venue tab** — a horizontal tab in business chrome that selects which **Business** (venue) is the active context when the person has more than one.
- **Owner chrome** — the fixed set of portfolio destinations only an **Owner** sees on owned venue tabs: **Add venue**, **Plan**, **Company**, and **Billing**. Distinct from an employee tab at a venue they only work at.
- **Left menu** — the persistent vertical navigation rail in **Business** mode (and the separate rail in the **customer account area**).
- **Service** — left-menu header for day-of operations destinations (POS, Host when entitled, and when entitled control screens and attendance).
- **Manage** — left-menu header for administration destinations; visible only while the person's **effective base layer** at that venue is **manager or admin** (access-and-permissions subject: per shift when on a working shift, otherwise highest membership layer; supervisor never sees Manage).
- **Me** — left-menu header in Business for **self-only** destinations (own schedule, notifications, personal details) that are not admin data.
- **Customer account area** — the signed-in customer's settings surface opened from the avatar while in Customer mode: profile, address, saved payment methods, email, notifications, **marketing consent**, **Download my data**, and related account items, with its own left sidebar. Privacy rules for those controls belong to the privacy, consent, and DSAR subject.
- **Icon rail** — the left menu's default desktop behaviour: it can collapse to a vertical strip of icons and expand on hover to show full labels. This is built-in behaviour, not a stored preference.
- **Service fullscreen** — a Service destination shown without the normal desktop chrome, with a small control to restore the desktop layout.
- **Canonical destination** — a named place in the product the chrome or a link may open (for example Manage home, POS, customer account area). Destinations are described in business language, never as implementation paths.
- **Guard** — a navigation rule that allows, blocks, or redirects a move (mode switch, deep link, eligibility loss).

Terms reused rather than redefined here: **User**, **Business**, **Owner**, **Employee** (membership), **base access layer**, **per-user capability**, **entry window**, **Customer app**, **Business app**, **owner shell**, **live** venue, and soft delete.

---

## 3. Capabilities

### 3.1 Desktop scope and product surfaces

- This subject's chrome model is specified for the **desktop web app**.
- Project Imperium exposes three product surfaces: **Customer**, **Business**, and **Superadmin**. Superadmin is out of this subject's ownership; Customer and Business share one login and are separated by **mode**.
- **Business** is one surface. Floor work and administration are **headers and destinations inside Business**, not separate modes.

### 3.2 Public Customer surface

- The **Customer** surface is the **default public landing**: anyone may browse discovery and public venue profiles **without signing in**.
- Sign-in and sign-up are offered from the **avatar** (or equivalent chrome control). After authenticating, the person **remains on the Customer surface** unless they switch mode.
- An unsigned visitor may **navigate customer ordering** and **build a basket**. Project Imperium requires **sign-in or sign-up** when **payment** is requested, and for other **account-bound** actions. The open basket is **preserved** across that identity step.
- Account-bound actions include at least: **favorites**, **inbox / notifications**, **order history**, **customer account area** settings, and **payment** on self-service channels. Reservations and other subjects may require a signed-in User as those subjects already state.

### 3.3 Avatar and the customer account area

- **Unsigned:** the avatar offers **Sign in** and **Sign up**.
- **Signed-in:** the avatar opens a short menu that includes at least **Account** (enters the customer account area), **Sign out**, and — when eligible — a path into the **mode toggle** / Business.
- The **customer account area** stays in **Customer** mode. It has its **own left sidebar** with destinations such as **profile (Me)**, **address**, **saved payment methods**, **email**, **notifications**, **marketing consent**, **Download my data**, and related account settings.
- **Saved payment methods** are the person's instruments for **in-app customer checkout**. Venue POS payment recording stays with the payments-and-tax subject; this subject only places the account nav item.
- The same **User** profile and **inbox** are reachable from Business **Me** (personal details / notifications) and from the customer account area — **one account model, two doors**.

### 3.4 Mode toggle (Customer | Business)

- After sign-in, when the person has **eligible business access** (users subject), the chrome shows **Customer | Business**.
- A person with **only customer access** never sees the Business side of the toggle.
- Switching mode **re-checks eligibility** and updates the session mode the guards read. The person may switch during the session without signing out.
- Opening Business is **not** on duty. On duty belongs to time-control.

### 3.5 Entering Business — venue context

- **One eligible venue:** go straight into that venue's business chrome (no picker).
- **Several venues:** show **horizontal venue tabs**. Each tab is one **Business** context. Switching tabs changes venue without leaving Business mode.
- **Owner chrome** appears only on tabs for venues the person **owns**. It is exactly four destinations:
  - **Add venue** — register another Business under this Owner (join an existing Company or form a new one — business and users subjects).
  - **Plan** — the Owner's subscription and entitlements (monetization subject).
  - **Company** — the tax entity for the active venue's Company: **legal name**, **tax number**, and the list of venues in that Company (users subject).
  - **Billing** — the platform payment method, **billing history**, and **in-product pay** for payable invoices (platform-billing subject).
- These hang on Owner chrome next to venue tabs (portfolio-scoped). Venue **Manage → Money** stays venue operations (payments/tax config, gift cards, reports) and does not replace Plan, Company, or Billing.
- An employee tab at a venue they only work at is **operational** — Service, Manage if manager+ there, and Me — without owner portfolio controls.
- **Landing** (uses **effective base layer** at enter — access-and-permissions subject):
  - **Employee- or supervisor-layer** effective users enter toward **Service** (POS primary for employees; supervisors land in Service with the full Service set) — including a manager-membership person currently on an employee- or supervisor-layer shift.
  - **Manager- or admin-layer** effective users enter the venue's **Manage home** (business main page) with the left menu showing **Service** and **Manage** headers (and **Me**).

### 3.6 Business left menu

- In Business mode the **left menu is always available** on desktop. Its default behaviour is the **icon rail**: it may sit as a vertical icon strip and **expand on hover** to full labels. That behaviour is built into the menu; it is not a per-user preference to remember.
- The left menu uses up to three **headers**:

#### Service

- **Ordinary employees:** **POS** only under Service (unless a capability or job role grants Host, a control screen, or attendance — see below).
- **Supervisors:** full Service set by default — **POS**, **Host**, **Prep screens**, **Delivery screen**, **Customer pickup board**, and **Attendance** for **own** scan-in (access-and-permissions layer defaults). Presenting the venue daily attendance QR stays manager+ (time-control subject).
- **Managers and above:** the same full Service set, and managers present the attendance QR.
- **Host** (job role) also sees **Host** under Service when not already covered by supervisor/manager/admin Service defaults.
- **Ordinary employees** see Prep / Delivery / Pickup / Attendance under Service **only when** a per-user capability (bound to the active job role) or job-role entitlement those feature subjects define grants that destination.
- **POS** and **Host** use the venue's **floor plans** on a wide viewport (map with floor tabs) and fall back to **list/grid** on a narrow viewport — the floor-plans subject owns that behaviour. POS is the spatial home for opening sittings; Host is the spatial home for seating and reservation context.
- Service destinations support **fullscreen**: hide normal desktop chrome, with a **small corner control** to restore the desktop layout. Manage pages stay in normal desktop chrome with the left rail.

#### Manage

- Visible while the person's **effective base layer** at that venue is **manager or admin** (owners included via admin). A person who holds Manager on the membership but is working an employee- or supervisor-layer shift does **not** see Manage for that shift; when not on a working shift, highest membership layer applies. Supervisor- and employee-layer users do **not** see Manage.
- Under Manage, feature groups and top-level items are:

  - **Venue** — profile, hours, delivery, go-live, and related venue configuration;
  - **People** — employees, full schedules, time-control administration as those subjects allow;
  - **Menu** — business goods, promotions;
  - **Supply** — suppliers, purchases, inventory;
  - **Service setup** — sales points, printers and screen configuration (day-of screens remain under Service);
  - **Floor plans** — its **own top-level Manage** item: multi-floor layout editor (backgrounds and placement of sales points, printers, and screens). Not nested under Venue or Service setup; the floor-plans subject owns behaviour;
  - **Money** — payments and tax configuration, gift cards, reports and metrics.

- Fine-grained screens and rules inside each group belong to the feature subjects.

#### Me

- Visible to **everyone** in Business mode.
- Under Me: **My schedule** (the person's own calendar as the schedules subject allows), **Notifications** (the shared inbox), **Personal details** (User profile), and other **self-only** items that are not admin data.
- Full workforce schedule editing stays under Manage → People.

### 3.7 Customer chrome (no business rail)

- In **Customer** mode the business left menu (**Service / Manage / Me**) is **hidden**.
- Customer chrome is discovery and customer navigation, the avatar, and the **Customer | Business** toggle when eligible.
- Account settings use the **customer account area** sidebar (§3.3), not the business rail.

### 3.8 Guards

- **Mode guard.** Business destinations require business mode and eligibility. Customer destinations remain available in customer mode; account-bound ones require a signed-in User.
- **Eligibility loss (schedule-gated layers).** If an employee- or supervisor-layer person loses eligibility (entry window ended, membership suspended or terminated) while in Business and has **no** open shift session, guards **move them to Customer mode** with a clear message. An **open** shift session still allows re-entry to Business as time-control and users already state.
- **Deep links and one-time links.** When a notification, email, or bookmark targets a Business destination (or the reverse) while the person is in the wrong mode: if they are **eligible**, switch mode and open the destination; if not, stay in Customer and explain why Business is unavailable. Emails own link issuance; this subject owns the landing surface behaviour.

### 3.9 Canonical destinations (catalogue)

This subject names destinations the chrome must be able to reach. Behaviour inside each is owned elsewhere.

| Destination | Typical entry |
| --- | --- |
| Public discovery (search and filter, or map of closest venues) / venue profile | Customer, signed out or in |
| Manage home (business main) | Manager- or admin-layer effective users entering Business |
| Customer ordering basket / pay gate | Customer; identity at payment |
| Customer account area (profile, address, payment methods, email, notifications, marketing consent, Download my data, …) | Avatar → Account |
| Favorites, order history | Customer, signed-in |
| Mode toggle | Signed-in chrome when eligible |
| POS (floor map or list/grid) | Service → POS |
| Host (floor map or list/grid) | Service → Host (Host job role; supervisor; managers+) |
| Prep / Delivery / Pickup screens | Service (supervisor/manager+ by default; employees when entitled) |
| Attendance | Service (own scan-in when entitled; present QR manager+ only) |
| Floor plans (layout editor) | Manage → Floor plans |
| Manage feature groups (Venue, People, Menu, Supply, Service setup, Money) | Manage header |
| My schedule / Notifications / Personal details | Me (Business) or account area (Customer) |
| Venue tabs | Multi-venue Business |
| Owner chrome: Add venue, Plan, Company, Billing | Owner on an owned venue tab |

---

## 4. Roles and entitlements

### Base access layers

| Layer | Navigation powers |
| --- | --- |
| **Customer** (including unsigned visitors) | Public Customer surface; guest basket until identity gates; after sign-in, customer chrome, account area, and Customer side of the mode toggle. |
| **Employee** (effective) | Everything a customer can do, plus Business when schedule-eligible; left menu **Service** (POS; other Service links only if entitled) and **Me**; no Manage. |
| **Supervisor** (effective) | Business when schedule-eligible; full Service set and **Me**; no Manage; Service landing. |
| **Manager** (effective) | Always Business-eligible when membership allows; Manage header and groups; full Service link set; Manage home on enter. |
| **Admin / Owner** (effective) | Everything a manager can do, plus owner chrome on owned venue tabs and ownership actions those subjects define. |

### Per-user capabilities

Ordinary employees may gain individual **Service** destinations (control screens, attendance) when granted from the access-and-permissions catalogue (role-bound; active on the shift's job role). Capabilities never invent a third mode or open Manage for supervisor/employee.

### Who can do what

| Activity | Who |
| --- | --- |
| Browse Customer without signing in | Anyone |
| Sign in / sign up from avatar | Anyone |
| Open customer account area | Signed-in user |
| Switch to Business via mode toggle | Signed-in user with eligible business access |
| Use venue tabs | Person with more than one eligible venue in Business |
| See owner chrome on a tab | Owner of that venue |
| Use Manage header | Effective manager or admin layer at that venue |
| Use Service → POS | Everyone in Business at that venue (as POS entitlements allow) |
| Use Service → Host | Host job role; supervisor layer; managers and above |
| Use Manage → Floor plans | Effective manager or admin layer at that venue |
| Use Service control screens / Attendance | Effective manager, admin, or supervisor (full Service defaults); or employees with the granting entitlement. Presenting the attendance QR: manager+ only |
| Use Me destinations | Everyone in Business |
| Enter Service fullscreen | Anyone on a Service destination that offers it |
| Be returned to Customer on eligibility loss | Employee- or supervisor-layer staff per §3.8 |
