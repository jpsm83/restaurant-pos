# Notifications

> **About this document.** This is the **target-state source of truth** for notifications in Project Imperium. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes notifications as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **how Project Imperium tells a person something** — the inbox that holds it, the messages the platform and a venue send, and how those messages reach their recipients. It owns:

- the **per-user inbox** and the read, unread, and deleted state of each item in it;
- the **delivery model** — persistence-first in-app delivery, live push while a recipient is online, and the email copy of the notifications that are also emailed;
- the **severity and engagement-kind vocabulary** a notification carries;
- the **operational event catalogue** — which business event notifies whom, on which channel, with what severity, and with what repeat behaviour;
- **venue engagement messaging** to customers — the automatic birthday, promotion, and event messages, and the venue events that trigger them;
- **two-way direct messages** between a venue's managers and a person (staff or customer), and the conversations they open;
- the **reliability behaviour** of delivery — idempotency, cooldown, and email resilience;
- the single **engagement mute** a user holds.

It deliberately does **not** cover:

- the **detection of triggering conditions** — low-stock and negative-stock detection belong to the inventories and supplier-goods subjects, overtime detection to the time-control subject, report readiness to the business-reports subject, profile-change detection to the business subject, print-failure detection to the printers-and-screens subject, and platform-charge overdue / freeze / billing-document events to the platform-billing subject. This subject owns what happens once a condition is detected, not how it is detected.
- the **transactional email flows themselves** — sign-in verification, password reset, an email change, order receipts, and reservation decisions. The emails subject owns their templates, copy, and retry mechanics; this subject owns which of them notify and the in-app side of each.
- **customer bill and receipt required content and numbering** — the **receipts-and-bills** subject owns document kinds, required fields, and bill/receipt numbers. An in-app order-confirmed (receipt) notification must present that subject's receipt content; this subject does not invent a thinner inbox-only set.
- the **inbox's ownership and a user's preference storage** — the users subject owns the person's identity and preferences. This subject owns the notifications the inbox holds and the meaning of the engagement mute, not where a preference is stored.
- the **screens and navigation** that render the inbox, a conversation, or a venue event — the user-navigation subject owns the surfaces.
- the **orders, reservations, promotions, and reports mechanics** that produce events — the orders, reservations, promotions, and business-reports subjects own those.

---

## 2. Domain model and vocabulary

### Entities

- **Notification** — one message addressed to one or more recipients and belonging to **one business**. Every notification is business-scoped: Project Imperium has no platform-wide notification. It carries a **severity** or an **engagement kind**, and its text.
- **Inbox** — a person's collection of notifications and conversations. It belongs to the **User**, not to a business or to a mode, so the same inbox is shared across the customer and business apps.
- **Inbox entry** — the per-person record of one notification, carrying its **unread** and **deleted** state. State is per recipient: one person reading or deleting a notification never changes it for anyone else.
- **Conversation** (thread) — a two-way exchange opened by a manager's **direct message**, pairing the manager and one person; replies are messages in the thread.
- **Venue event** — a dated announcement a venue publishes: a name, a date, and details. Publishing it sends an **Event** message.
- **Engagement mute** — a single per-person switch, off by default, that suppresses a venue's broadcast engagement messages to that person.

### Terms this subject introduces

- **Operational event** — a system-triggered notification drawn from the catalogue in §3.3.
- **Engagement message** — a venue-initiated message to its customers. **Promotion**, **Birthday**, and **Event** are one-way **broadcasts**; **Message** is a **direct message**.
- **Broadcast** — an engagement message sent one-way to an audience of customers; a recipient cannot reply to it.
- **Direct message** — a **Message** a manager addresses to one person or to a chosen group, opening a **conversation** the recipient can reply to.
- **Managers on duty** — a venue's managers and above who are currently signed in on a shift.
- **Related customer** — a customer who holds a relationship with the venue, such as an order or a reservation.
- **Persistence-first** — the stored in-app notification is the source of truth; live delivery is an acceleration, never the record.
- **Live push** — delivering a notification immediately to a recipient who is online.
- **Idempotency** — suppressing a repeat dispatch of the same event within a brief window (five minutes in §3.7).
- **Cooldown** — the minimum gap between repeats of a noisy alert.

Terms reused from the product overview's core vocabulary rather than defined here: **Notification**, with its **severities** (Info, Warning, Emergency) and **engagement kinds** (Message, Promotion, Birthday, Event); **User**, **Business**, **Employee**, **Customer**, **Order**, **Reservation**, **Promotion**, **Report** (daily, weekly, monthly), **shift session** and **on duty**, **low-stock**, **overtime**, and **soft delete**. Terms from sibling subjects are named as that subject defines them.

---

## 3. Capabilities

### 3.1 Delivery: persistence-first, then live, then email

- Every notification is stored in each recipient's inbox **first**, and that stored copy is the **source of truth**.
- A recipient who is **online** also receives it immediately by **live push**. A recipient who is **offline** receives it the moment they return, from the stored copy; nothing is lost.
- **Email** is added for: an order confirmation/receipt, a reservation pending, deposit-requested, and decision message (to the customer), a reply in a customer conversation (to the customer), a **business reply to a review** (to the reviewing customer), a **delivery review invite** (to the attributed delivery customer), a business-profile change (to managers), **platform billing documents and arrears / post-freeze dunning** (to the Owner and Manager-and-above recipients named by platform-billing), and a venue's engagement broadcasts (to customers who have not muted them). The remaining operational alerts — low-stock, negative-stock, report-ready, overtime, awaiting-table, print-failure, new review, and review removal decided — are **in-app only**.
- A communication failure **never blocks** the underlying business action: a notification is a side effect of the action, not a precondition for it.

### 3.2 The inbox

- Each person has **one inbox**, shared across the customer and business apps and across every venue they touch. Inbox access requires a signed-in User (account-bound; users subject).
- State is **per recipient**: an entry is unread by default; reading marks it read; a person can mark one read, mark all read, and delete. The inbox shows an **unread count**.
- **Deleting** hides an entry from that person's inbox only.
- **System-generated** notification text is delivered in the recipient's **language preference** (English or Spanish). A manager's own words in a direct message are delivered **as written**.
- A notification or conversation follows the platform's **soft-delete** convention; a recipient's delete is a per-person hide. Soft-deleted notification records may later be physically removed under **operational** retention by the plan quotas and data retention subject when the **data-integrity rule** allows.

### 3.3 Operational event catalogue

| Event | Who is notified | Channel | Severity | Repeats |
| --- | --- | --- | --- | --- |
| Order confirmed (receipt) | The ordering customer | In-app + email | Info | Once |
| Reservation pending | The customer; and the venue's Host and managers, prompted to review it | Customer: in-app + email; Host and managers: in-app | Info | Once |
| Deposit requested | The customer | In-app + email (payment link) | Info | Once |
| Reservation decided (reserved or cancelled) | The customer | In-app + email | Info | Once |
| Awaiting table | Host and above | In-app | Info | Once |
| Low-stock alert | The venue's managers on duty | In-app | Warning | At most once per 15 minutes per set of items |
| Negative-stock alert | The venue's managers on duty | In-app | Warning | At most once per 15 minutes per item |
| Weekly report ready | The venue's managers and above | In-app | Info | Once |
| Monthly report ready | The venue's managers and above | In-app | Info | Once |
| Business profile updated | The venue's managers and above | In-app + email | Info | Once |
| Overtime alert | The venue's managers on duty; if none are on duty, all manager-layer users for the business | In-app | Warning | Every 5 minutes until the employee signs off or a manager mutes that session's overtime alert |
| Sign-out request | The venue's managers on duty | In-app | Info | Once per request |
| Print failure | The venue's managers on duty; if none are on duty, all manager-layer users for the business | In-app | Warning | Once per failed print attempt |
| Schedule changed | Each employee whose schedule entries were added, changed, or removed in the manager's editing session | In-app | Info | Once per employee when the manager leaves the schedules main page (batched across that employee's entries) |
| Time-off request pending | The venue's managers and above | In-app | Info | Once |
| Time-off request decided | The requesting employee | In-app | Info | Once |
| New review | The venue's managers and above | In-app | Info | Once |
| Business reply to a review | The reviewing customer | In-app + email | Info | Once per post or edit |
| Review removal decided | The managers who requested removal | In-app | Info | Once |
| Delivery review invite | The attributed delivery customer | In-app + email | Info | Once, three hours after handover if still unreviewed |
| Pay run version recalculated | The venue's managers and above | In-app | Info | Once per recalculation after a prior release when upstream sources change |
| Pay run released to accountant | The configured accountant contact | Email (CSV package) | Info | Once per Release |
| Platform billing document | The Owner | Email (billing document) | Info | Once per charge, invoice, or adjustment |
| Platform charge overdue | Owner always; Manager and above at every Business under the Owner (subscription) or at that Business only (venue commission) | In-app + email | Warning | Daily from overdue notice through the payment deadline or until paid |
| Platform service frozen | Same recipients as platform charge overdue for that debt | In-app + email | Warning | Once on the cut-off / freeze day |
| Platform post-freeze pay-to-restart | Same recipients as platform charge overdue for that debt | In-app + email | Warning | Daily for fourteen days after freeze, then stop |

- The **low-stock alert** lists the affected goods and fires when stock falls below a good's **minimum required**; detecting that condition belongs to the inventories and supplier-goods subjects.
- The **negative-stock alert** fires when a good's stock on hand falls **below zero**, as a management-error signal that purchases or counts are missing; detecting that condition belongs to the inventories subject.
- The **overtime alert** concerns any employee other than an admin or owner who is still on duty past their scheduled end, and repeats until they sign off or a manager mutes that open session's overtime alert; detecting that condition and the mute belong to the time-control subject. Recipients are the venue's **managers on duty**; if none are on duty, the alert **falls back** to all manager-layer users at that venue (same pattern as print-failure). The schedules subject keeps a manager-layer shift on every day that plans work so someone is always in charge on the plan.
- The **sign-out request** notifies managers on duty when an employee asks to end duty; completing sign-out belongs to the time-control subject.
- A **report-ready** notification fires when the weekly or monthly report for the period is ready for review; detecting readiness belongs to the business-reports subject.
- The **business-profile-updated** notification fires when a change to the business profile actually persists, and reports which fields changed; detecting the change belongs to the business subject.
- The **print-failure** notification fires when a print cannot be completed and no usable backup takes the job; detecting that condition belongs to the printers-and-screens subject.
- The **schedule-changed** notification batches every add, change, or removal for one employee from a single schedules editing session into one ping when the manager leaves the schedules main page; detecting those edits belongs to the schedules subject.
- The **time-off request pending** and **time-off request decided** notifications are raised by the schedules subject's request workflow.
- The **new review**, **business reply to a review**, **review removal decided**, and **delivery review invite** events are raised by the ratings-and-comments subject.
- The **pay run version recalculated** and **pay run released to accountant** events are raised by the payroll subject; the accountant recipient is the venue's configured accountant contact, which need not be a User.
- The **platform billing document**, **platform charge overdue**, **platform service frozen**, and **platform post-freeze pay-to-restart** events are raised by the platform-billing subject. The billing document is **email-primary** to the Owner (in-app history lives in platform-billing). Portfolio subscription arrears fan out as business-scoped in-app notifications to every venue under the Owner so each inbox stays business-scoped; venue commission arrears stay on that Business. The Owner always receives the emailed dunning copy as well.
- No catalogued event carries the **Emergency** severity; it is reserved for a critical operational failure.

### 3.4 Venue engagement messages

- Engagement messages reach only a venue's **related customers** — a customer with no relationship to the venue is never messaged.
- Three engagement kinds are **automatic**, sent by the platform on the venue's behalf:
  - **Birthday** — sent on a customer's birthday, in the **venue's timezone**, to related customers who have a recorded birth date.
  - **Promotion** — sent when a promotion's **active window begins**, not when it is authored.
  - **Event** — sent when the venue publishes a venue event (§3.6).
- A **broadcast** engagement message is **one-way**: a recipient cannot reply to it.
- A manager's own message to customers is a **direct message** (§3.5); the automatic kinds above are the broadcasts.

### 3.5 Direct messages and conversations

- **Managers and above** may start a **direct message** to one person or to a chosen group of the venue's staff and related customers. Each recipient gets their **own conversation** with the manager.
- Only managers and above can **start** a conversation. A staff member or customer can **reply** in a conversation they were sent, but cannot start one.
- A **reply** notifies the other party **in-app**; when the conversation is with a customer, the customer's notification is also **emailed**. Staff replies are never emailed.
- Conversations appear in the **same inbox** as notifications; opening a message shows its **thread**, and reading a thread clears its unread state.
- A direct message is addressed to a person, so the **engagement mute does not suppress it**.

### 3.6 Venue events

- A venue's **managers and above** publish an event as a dated announcement — a name, a date, and details. Publishing sends the **Event** broadcast to the venue's related customers.
- A venue event is an **announcement**, not a booking or a reservation.

### 3.7 Reliability

- **Idempotency.** A repeated dispatch of the same event for the same business within **5 minutes** is suppressed, so a burst of triggers produces one notification.
- **Cooldown.** A low-stock alert repeats at most once per **15 minutes** per set of items; an overtime alert repeats every **5 minutes** until sign-off or until that session's overtime mute.
- **Email delivery.** Email is retried on a transient failure rather than dropped; the retry behaviour itself belongs to the emails subject.
- **Live delivery is best-effort.** A recipient who cannot be reached live still has the stored notification.

### 3.8 The engagement mute

- The **only person-level notification preference** is the engagement mute. There is no per-event or per-channel tuning for recipients.
- A person holds a single **engagement mute**, **off by default** and **global** across every venue; muting suppresses a venue's broadcasts to that person, both in-app and by email. Operational notifications are **mandatory** for recipients. The sole operational exception is owned by time-control: a manager may **mute further overtime alert repeats for one employee's current open session**.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Notification powers |
| --- | --- |
| **Customer** | Holds the inbox; receives notifications and conversations; may reply in a conversation sent to them; may mute engagement; receives business replies to their reviews and delivery review invites. Cannot start a conversation. |
| **Employee** | Everything a customer can do; as staff, receives the direct messages the venue sends them and may reply. |
| **Supervisor** | Same inbox powers as employee. Does not publish venue events or start direct messages; does not receive manager-targeted operational alerts unless also on duty as a manager-layer person. |
| **Manager** | Everything an employee can do, plus publishing venue events and starting direct messages to staff and related customers. Receives the manager-targeted operational alerts, including overtime and sign-out requests when on duty, new reviews, and review-removal decisions. |
| **Admin** | Everything a manager can do. |

The owning user is an admin at every venue they own. Job roles and per-user capabilities follow the global model; this subject names only the entitlements that bear on notifications.

### Who can do what

| Activity | Who |
| --- | --- |
| Use the inbox (read, mark read, mark all read, delete) | Any signed-in person |
| Mute engagement | The person (their own) |
| Reply in a conversation | The recipient of the direct message |
| Start a direct message | Managers and above |
| Publish a venue event | Managers and above |
| Receive low-stock, negative-stock, overtime, sign-out-request, and print-failure alerts | The venue's managers on duty; overtime and print-failure fall back to all manager-layer users when none are on duty |
| Receive report-ready and profile-updated alerts | The venue's managers and above |
| Receive platform-billing arrears, freeze, and post-freeze alerts | Owner always; Manager and above at every venue (subscription / portfolio) or at that venue only (commission), per platform-billing |
| Operate the application business | The superadmin, in a separate realm; never a recipient of a venue's notifications |
