# Conversations

> **About this document.** This is the **target-state source of truth** for conversations in Project Imperium — staff messaging inside a venue, and the one-shot manager email to a customer when needed. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes conversations as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **how people who work at a venue talk to each other in product**, and the narrow case where a manager emails a customer outside that chat model. It covers:

- the **Conversation** entity — one-to-one and group threads among **active Employees** of the **same Business**;
- who may **start**, **message**, **leave**, and **manage group membership**;
- the **open-only** lifecycle (no close, resolve, or archive product action);
- that staff conversation messages are **in-app only** (never emailed) and are **not** gated by marketing consent or the engagement mute;
- the **manager-to-customer one-shot email** when a venue must reach a related customer without opening a thread;
- that **customers have no conversations** — customer↔venue dialogue is the review and business reply owned by the ratings-and-comments subject.

It deliberately does **not** cover:

- **inbox delivery, unread/read, live push, severities, operational event catalogue, broadcasts, and the engagement mute** — the notifications subject. Conversation threads may appear in the same inbox; this subject owns the thread rules, not notification delivery mechanics.
- **email templates, sending identity, language of system copy, delivery and retry** — the emails subject. This subject owns **when** a manager may send the one-shot customer email and **who** may send it; emails owns how that mail is written and delivered.
- **marketing consent, privacy notice, and customer DSAR package shape** — the privacy, consent, and DSAR subject. One-shot manager email is operational outreach (not a broadcast) and is not consent- or mute-gated.
- **review and business reply** as the customer↔venue dialogue path — the ratings-and-comments subject.
- **Employee membership, employment status, and job roles** — the employees and access-and-permissions subjects. This subject reads **Active** membership at a Business as eligibility for the roster.
- **screens and navigation** that render the inbox or a thread — the user-navigation subject.
- **SMS or other external chat channels** — out of stage-1 product scope.

---

## 2. Domain model and vocabulary

### Entities

- **Conversation** — a messaging thread belonging to **one Business**, among **active Employees** of that venue. It is either a **one-to-one conversation** or a **group conversation**. Soft-delete applies under the platform convention.
- **Conversation message** — one contribution in a conversation, authored by a current participant, delivered in-app to the other current participants.
- **Manager-to-customer one-shot email** — a one-way operational email a manager-and-above sends to one related customer of the venue. It is **not** a conversation and opens **no** in-app thread or inbox conversation entry for the customer.

### Terms this subject introduces

- **One-to-one conversation** — the unlabeled pair thread between exactly two eligible participants. Starting chat with one colleague always opens or reuses this thread — it is not a group.
- **Group conversation** — a **named** conversation with **two or more** eligible participants and a mutable roster. Creating a group is an explicit act, distinct from a one-to-one even when the group has only two members.
- **Eligible participant** — a User with an **Active** Employee membership at that Business. Suspended or terminated memberships are not eligible.

Terms reused rather than redefined here: **User**, **Customer**, **Employee**, **Business**, **Active** employment status, **managers and above**, **base access layer**, **inbox**, **engagement mute**, **marketing consent**, **broadcast**, **related customer**, **soft delete**, **operational** retention, **data-integrity rule**, and **business reply** (to a review).

---

## 3. Capabilities

### 3.1 Staff conversations only

- Conversations exist **only among staff** of one Business. Customers are never participants and never see staff threads.
- There is **no** customer inbox conversation with the venue. A customer who needs to talk with the venue about a visit does so through a **review**; the venue answers with its **one business reply** (ratings-and-comments subject).
- Staff conversation messages are delivered **in-app only**. Project Imperium does **not** email conversation messages to staff.

### 3.2 Eligibility and roster

- Only **Active** Employees of the Business appear on the roster and may use conversations at that venue.
- When a person loses eligibility (membership suspended or terminated), they are **removed** from every group at that Business and can neither send nor receive further messages in any conversation there. History they already had follows the same per-person hide and retention rules as other inbox items.
- Conversations are **Business-scoped**. There is no Company-wide or cross-venue staff chat in stage 1.

### 3.3 One-to-one conversations

- Any eligible participant may **start** a one-to-one conversation with any other eligible participant at the same Business. There is **no** initiate hierarchy among staff.
- Either participant may send messages for the life of the thread while both remain eligible.
- Starting a second one-to-one between the same two people **reuses** the existing thread rather than creating a duplicate.

### 3.4 Group conversations

- Any eligible participant may **create** a group, give it a **name**, and pick the initial members (two or more eligible people at that Business, including themselves). This does **not** replace or merge with any one-to-one those people already share.
- **Any current member** may rename the group, **add** eligible colleagues, or **remove** members. The creator has no lasting special privilege.
- A member may **leave** the group themselves. A group may continue with two members; if membership falls to one or zero, the group **ends** for remaining members (history stays under per-person hide and retention).
- Any **current** member may send messages. Someone who left or was removed stops receiving and cannot send; messages they already saw remain subject to their own inbox hide and soft-delete rules.

### 3.5 Lifecycle and disappearance

- A conversation stays **open**. Stage 1 has **no** close, resolve, or archive action.
- A participant's delete of a conversation entry is a **per-person hide** in their inbox (notifications subject's inbox model). Hiding does not delete the thread for other participants.
- Conversation records follow **operational** retention: soft-deleted material may later be physically removed under the plan quotas and data retention subject's classes when the **data-integrity rule** allows. This subject does not invent a separate chat retention class.

### 3.6 Mute and consent

- Staff conversations are **mandatory** for participants: there is **no** per-thread mute and **no** per-conversation mute.
- The **engagement mute** suppresses venue **broadcasts** only (notifications subject). It does **not** suppress staff conversation delivery.
- **Marketing consent** does not gate staff conversations.

### 3.7 Delivery surface

- Conversation threads surface in the person's **inbox** alongside notifications. Opening a thread shows its messages; reading clears unread state for that person (inbox mechanics owned by notifications).
- New messages notify other current participants **in-app** (and by live push when they are online). Delivery failure never blocks sending the message into the stored thread.

### 3.8 Manager-to-customer one-shot email

- When a venue must reach a customer outside reviews, **managers and above** at that Business may send a **manager-to-customer one-shot email** to one **related customer**'s sign-in email.
- The email is **email-primary** and **one-way**: it opens **no** conversation, creates **no** customer inbox conversation entry, and mailbox replies are **not** monitored (emails subject). Further dialogue, if any, is another one-shot email or a **review** / **business reply**.
- The one-shot email is **not** a broadcast: it is **not** gated by marketing consent and is **not** suppressed by the engagement mute.
- **Employees and supervisors** cannot send this email.
- Raising the send is owned here; the emailed copy, language of system framing, and delivery/retry belong to the emails subject. The manager's **own words** in the body are sent **as written** and are never translated. Notifications does **not** catalogue an in-app copy of this send.

### 3.9 Ownership of related email and notification events

- **Staff conversation activity** has **no** email event. Notifications may deliver in-app (and live) notice of new messages; this subject owns whether a message exists and who may send it.
- There are **no** customer conversation threads and **no** emailed reply-in-thread event for customers.
- The **manager-to-customer one-shot email** is the sole customer-addressed mail this subject authorises; **emails** owns the catalogue entry and delivery; **notifications** does not own an in-app side for it.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Conversation powers |
| --- | --- |
| **Customer** | No conversations. Interacts with the venue through reviews (ratings-and-comments). May receive a manager-to-customer one-shot email when a manager sends one. |
| **Employee** | When Active at the Business: start and use one-to-one and group conversations with other Active Employees of that Business; create groups; manage group roster as a member; leave groups. Cannot email customers. |
| **Supervisor** | Same conversation powers as employee at that Business. Cannot email customers. |
| **Manager** | Everything an employee can do for staff chat, plus send the **manager-to-customer one-shot email** to a related customer of that venue. |
| **Admin** | Everything a manager can do. |

The owning user is an admin at every venue they own. Job roles and per-user capabilities follow the global model; this subject names only the entitlements that bear on conversations.

### Who can do what

| Activity | Who |
| --- | --- |
| Start a one-to-one conversation | Any Active Employee of that Business with any other Active Employee of that Business |
| Send a message in a one-to-one | Either current eligible participant |
| Create a group conversation | Any Active Employee of that Business |
| Rename a group / add or remove members | Any current member of the group |
| Leave a group | Any current member (themselves) |
| Send a message in a group | Any current member |
| Hide a conversation from own inbox | The participant (per-person hide) |
| Mute a conversation or staff chat | No one |
| Send manager-to-customer one-shot email | Managers and above at that Business, to a related customer of that venue |
| Participate in a customer conversation thread | No one — customer threads do not exist |
