# Emails

> **About this document.** This is the **target-state source of truth** for emails in Project Imperium. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes emails as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers **every email Project Imperium sends** — the messages that leave the platform for a person's mailbox, as against the in-app notifications a person reads inside the product. It owns:

- the **email categories** and the complete **catalogue** of messages Project Imperium sends;
- the **one sending identity** behind every email, and how a venue is named in its own messages;
- **account and security email** — sign-in verification, password reset, the sign-in email change, reactivation, and business contact-email verification — and their **one-time links**;
- the **anti-enumeration** behaviour of the unauthenticated request flows;
- the **operational email** — the emailed copies of the notifications that are also emailed;
- the **engagement email** of a venue's broadcasts, and its **unsubscribe** control;
- the **language** each email is written in;
- **delivery and retry** — best-effort delivery, transient retry, and the rollback that protects a failed account email.

It deliberately does **not** cover:

- **which events notify, and the in-app side of each** — the notifications subject owns the notification catalogue, the inbox, the severities and engagement kinds, and the engagement mute itself. This subject owns how an email is written and delivered, not whether an event notifies.
- **the mechanics of the actions behind the emails** — orders and payments, reservations, reviews, the sign-in email and password, the business contact email, venue events, and platform charges are owned by the orders, reservations, ratings-and-comments, users, business, notifications, and platform-billing subjects. This subject owns the email side: when each message is sent and what it carries.
- **the pages a one-time link opens** — the user-navigation subject owns the destination surfaces. This subject owns only that a link leads a person to complete an action, never what they see.
- **the session effects of a completed change** — the users subject owns session revocation and the email-verified flag.
- **where the language preference is stored** — the users subject owns the person's preference; this subject reads it.
- **SMS or push** — email is the only external channel. Live in-app push belongs to the notifications subject.
- **the visual design and exact copy of each message** — out of scope for the product set.

---

## 2. Domain model and vocabulary

### Entities

- **Outbound email** — one message Project Imperium sends to one email address. Every outbound email belongs to exactly one category, and is either venue-initiated or platform-account mail.
- **Recipient** — the single addressed party of an outbound email. Project Imperium addresses every email to exactly one recipient.
- **One-time link** — a randomly generated, single-use, expiring link inside an account email that lets its holder complete a sensitive action.

### Terms this subject introduces

- **Account email** — a message about a person's identity or security, or a business's contact-email verification: sign-in verification, password reset, sign-in email change confirmation, sign-in email change notice, reactivation, and business contact-email verification.
- **Operational email** — the emailed copy of an operational notification: an order confirmation/receipt, a reservation pending, deposit-requested, or decided message, a business-profile-updated message to managers, a customer conversation reply, a **business reply to a review**, a **delivery review invite**, and **platform billing** messages (billing documents, arrears dunning, freeze, and post-freeze pay-to-restart). Venue-facing operational mail names the venue it concerns; platform-billing mail is Imperium-initiated and may be portfolio-scoped.
- **Engagement email** — a venue's one-way broadcast to its related customers: a **Birthday**, **Promotion**, or **Event** email. It is **venue-initiated**.
- **Sending identity** — the single platform address every outbound email is sent from, together with the venue name Project Imperium shows on venue-initiated mail.
- **Generic response** — the single answer an unauthenticated request flow returns whether or not an account exists.
- **Link lifetime** — how long a one-time link stays valid.
- **Request cooldown** — the minimum gap between repeats of a request for one account.
- **Best-effort delivery** — a failed operational or engagement email is retried on a transient failure and then logged; it never blocks the business action behind it.
- **Rollback** — clearing the pending one-time link when its email cannot be sent, so a later attempt starts clean.
- **Unsubscribe** — the one-click control on an engagement email that turns on the person's engagement mute.

Terms reused from the product overview's core vocabulary rather than defined here: **User**, **Customer**, **Employee**, **Business**, **Order**, **Reservation**, **Delivery**, **Notification**, and **soft delete**. Terms from sibling subjects are named as that subject defines them: the **engagement mute**, **severity**, **engagement kinds**, **sign-in email**, **business contact email**, **language preference**, and the **email-verified flag**.

---

## 3. Capabilities

### 3.1 One owner, one sender

- Project Imperium has **one email service**, and this subject owns **every** message it sends, whatever triggered it — account, operational, or engagement.
- Every email is sent from **one sending identity**, the platform's address. Venue-initiated mail shows the **venue's name**, but a business holds **no sending credentials** of its own; all mail leaves through the platform.
- Every email is addressed to **exactly one recipient**. A customer never sees another customer's address; a message to many customers is many separate single-recipient emails.
- Every email is written as both a **rich** and a **plain-text** message, so it is readable in any mailbox.
- Email is sent from an address whose replies are **not monitored**: a person completes a conversation or a change **inside the product**, not by replying to the email.

### 3.2 Account and security email

Project Imperium sends account email for:

- **sign-in verification** — confirming a new user's sign-in email;
- **resend verification** — the same message, re-requested;
- **password reset** — a link to set a new password;
- **sign-in email change confirmation** — a link sent to the **new** address to confirm the change;
- **sign-in email change notice** — a security warning sent to the **old** address once a change completes; it carries **no link**;
- **reactivation** — a link that confirms restoring a soft-deleted account;
- **business contact-email verification** — confirming a business's own contact email.

Every action link is a **one-time link**: **randomly generated**, valid **once**, and **expiring**. Exactly **one active link per purpose per account** exists — requesting a new one **supersedes** the previous link, so an older link stops working. An expired or superseded link is refused and the person requests a new one.

**Link lifetimes:** sign-in verification, sign-in email change, reactivation, and business contact-email verification **24 hours**; password reset **1 hour**.

If the link email **cannot be sent**, Project Imperium **rolls back** the pending link and tells the requester, so an account is never left holding a link nobody received. This is the email-side exception to best-effort delivery (§3.7).

A completed password reset or sign-in email change has session effects owned by the users subject; the email side ends at the confirmed link.

### 3.3 Anti-enumeration

- The unauthenticated request flows — **resend verification** (for a new user or for a business contact email) and **password reset** — return a **single generic response** whether or not the address belongs to an account, and send a message **only when one exists**. A **sign-in email change** is an authenticated flow and is not part of this rule.
- **Sign-up is also generic**: it never says an address is already taken. When someone signs up with an address that already has an account, Project Imperium does not reveal it inline; it sends that address a **"you already have an account"** message pointing the owner to sign in or reset, and still returns the generic sign-up response.
- Every request flow is **cooldown-limited**: a **one-minute minimum gap per account** between repeats, so the flows cannot be used to flood an address.

### 3.4 Operational email

Project Imperium emails the operational notifications that the notifications subject marks as emailed, each concerning **one business**:

- **Order confirmed (receipt)** — sent to the ordering customer when an order is paid; it carries the order reference, the goods ordered, the amount paid, and any tip.
- **Reservation pending** — sent to the customer when a request is placed or a customer edit re-pends it; it carries the arrival date and time, party size, and status.
- **Deposit requested** — sent to the customer when the venue asks for a deposit; it carries the amount, the payment link, and that an account is required before paying.
- **Reservation decided** — sent to the customer when the request becomes reserved or is cancelled; it carries the decision and the reservation details. A reserved confirmation states late-arrival and grace rules clearly and never shows the staff-only end time; it may include an optional account-invite link when the guest has no account.
- **Business profile updated** — sent to the venue's managers and above when a profile change persists; it names the fields that changed.
- **Customer conversation reply** — sent to a customer when a venue manager replies in their conversation.
- **Business reply to a review** — sent to the reviewing customer when the venue posts or edits its one public reply on their review; it carries the venue name and that a reply is waiting in the product.
- **Delivery review invite** — sent to the attributed delivery customer **three hours after handover** when that sales instance still has no review; it carries the venue name and the one-time review invite for that instance. Detecting eligibility belongs to the ratings-and-comments subject.
- **Pay run released to accountant** — sent to the venue's configured **accountant contact** when managers **Release** a pay run; it carries the venue name, pay period, export version identity, changelog when replacing a prior version, and the CSV package. Raising Release belongs to the payroll subject. The accountant address need not belong to a User.
- **Platform billing document** — sent to the **Owner** on every platform charge, payable invoice, or adjustment; it carries charge kind, Business when commission-related, period, rates, platform-fee tax, and totals. Raising the document belongs to the platform-billing subject.
- **Platform charge overdue** — daily copy to the Owner and to Manager-and-above recipients scoped by platform-billing; it carries the unpaid amount, what it is for, and the **exact cut-off date**.
- **Platform service frozen** — sent on freeze day to the same recipients; it states that service is cut until the debt is cleared.
- **Platform post-freeze pay-to-restart** — daily for fourteen days after freeze to the same recipients; it urges payment so service can restart.
- **Inactive account warning** — sent to a User approaching inactivity soft-delete; it states the deadline and how to keep the account (sign in or keep-account confirmation). Raising the candidate belongs to the plan quotas and data retention subject.
- **Dormant business confirmation** — sent to the Owner when a venue has had no venue activity for the dormant window; it asks them to confirm the venue should stay live before soft-delete. Raising the candidate belongs to the plan quotas and data retention subject.

An operational email is the **emailed copy** of an in-app notification where one exists, and the notification remains the record. The accountant pay-run package and the Owner's **platform billing document** are email-primary. A send failure is best-effort and never blocks the action that triggered it.

### 3.5 Engagement email

- The venue engagement messages the notifications subject owns — the **Birthday**, **Promotion**, and **Event** broadcasts — are delivered as engagement email to the venue's **related customers**. This subject owns the email side of them: that they leave as email, and how.
- Engagement email is **one-way**: a recipient cannot reply to it.
- Every engagement email carries a **one-click unsubscribe** that turns on the person's **engagement mute**. Project Imperium does not email an engagement message to a person who has muted engagement.
- A **direct message** to a customer is not engagement: its emailed copy is the operational **customer conversation reply**, is addressed to the person, and is **not** suppressed by the engagement mute.

### 3.6 Language

- Every system-written email is written in the recipient's **language preference** (English or Spanish), falling back to **English** where no preference is set.
- A manager's **own words** in a conversation reply are sent **as written** and are never translated.
- Venue names and other proper nouns are not translated.

### 3.7 Delivery and retry

- Email is **best-effort**: a failed send is **retried on a transient failure** and then **logged**. It never blocks the action that triggered it, consistent with the platform rule that a communication failure never blocks a business action.
- A **permanent** failure is not retried and is dropped for operational and engagement email.
- **Account email is the exception.** Because the person is waiting to complete an action, its send failure is **surfaced to the requester** and the pending link is **rolled back** (§3.2).
- Project Imperium does **not** track bounces or spam complaints; delivery is best-effort and there is no committed bounce or complaint handling.
- The **cooldown and idempotency** that suppress repeated *triggers* belong to the notifications subject; this subject owns the send, not the trigger suppression.

### 3.8 The unsubscribe control

- The **only** email preference a person holds is reached through the engagement **unsubscribe**, which sets the single **engagement mute** that the notifications subject owns and that a person can also set in-app. There is no per-category, per-venue, or per-channel email tuning.
- **Account and operational email are mandatory** and carry no unsubscribe; a person cannot stop receiving them.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Email powers |
| --- | --- |
| **Customer** | Holds the address every email is sent to; receives account email, operational email (order receipts, reservation messages, customer conversation replies, business replies to reviews, and delivery review invites), and engagement email; may unsubscribe from engagement email. |
| **Employee** | Everything a customer can do; as staff, holds the account email flows the same as anyone. |
| **Manager** | Everything an employee can do, plus receiving the **business profile updated** email as a venue manager, and platform-billing arrears / freeze / post-freeze email when in scope for that venue or portfolio. |
| **Admin** | Everything a manager can do; Owners also receive every **platform billing document**. |

The owning user is an admin at every venue they own. Job roles and per-user capabilities follow the global model; this subject names only the entitlements that bear on email.

### Who can do what

| Activity | Who |
| --- | --- |
| Receive account and security email | Any account holder, at their sign-in email; a business contact-email verification goes to the business's own contact address |
| Receive operational email | The recipient named by the triggering event — the customer for receipts, reservation messages, conversation replies, business replies to reviews, and delivery review invites; the venue's managers and above for profile changes; the configured accountant contact for a released pay-run package; the Owner and Manager-and-above recipients named by platform-billing for billing documents and arrears mail |
| Receive engagement email | A venue's related customers who have not muted engagement |
| Unsubscribe from engagement email | The recipient (their own engagement mute) |
| Trigger an account email | The person making the request (or the sign-up itself) |
| Send engagement email | The platform, on the venue's behalf when a broadcast is due — no one sends email by hand |
| Opt out of account or operational email | No one |
