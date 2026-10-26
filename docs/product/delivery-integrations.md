# Delivery integrations

> **About this document.** This is the **target-state source of truth** for delivery integrations in Project Imperium — how a venue's delivery method is chosen, how a third-party courier provider is connected, and how the platform requests, confirms, and cancels courier work. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes delivery integrations as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **delivery integration boundary** between a venue and the courier that performs last-mile delivery. It covers:

- the **delivery method** — **Own delivery** or a **third-party courier provider**;
- the global **provider catalogue** and the per-business **courier provider connection**;
- the **courier request** raised when a paid delivery batch is sent to prep;
- the optional **courier handover** raised when venue staff record the delivery handover on a screen or POS;
- the **courier cancellation** raised when a delivery order is cancelled before handover;
- the **external delivery reference**, **sync state**, **retry**, and **failure visibility** for each provider action;
- how a venue that records **no staff handover** is reconciled at the daily close; and
- the provider contract a future provider adapter must satisfy.

It deliberately does **not** cover:

- the venue's delivery **on/off switch**, **delivery radius**, **minimum order**, **delivery windows**, or the place where the delivery method is selected — the **business** subject owns delivery configuration and the selection surface. This subject owns what the methods are, which providers exist, and what a connection does.
- the **service journey** and delivery surface flow — the **order-flow** subject owns when a delivery order is paid, sent, prepared, and handed over.
- the **order, batch, identification code, fulfilment status, and handover pass** — the **orders**, **sales-points-and-instances**, and **order-flow** subjects own those.
- **payment, tax, and settlement** — the **payments-and-tax** subject. Delivery is fully digital and paid before commit.
- **customer notifications and emails** — the **notifications** and **emails** subjects deliver the receipt, handover information, and failure alerts. This subject names the events and the status they carry.
- **printers and control screens** — the **printers-and-screens** subject owns the delivery screen, handover scanning surface, and printed kiosk ticket. This subject owns the provider calls those surfaces trigger.
- the **daily sales report** — the **sales-reports** subject owns the report and the close sweep. This subject supplies the delivery-integration status the report surfaces.
- **Superadmin console surfaces** — the **superadmin** subject owns the console. This subject owns the meaning of the provider catalogue; the console maintains it.
- **last-mile delivery execution** — the **courier provider** owns its own courier app, assignment, tracking, and proof of delivery. Project Imperium does not receive inbound courier state in stage 1.
- **own-delivery driver dispatch** — assigning venue employees as drivers, driver tracking, and doorstep proof are not in scope. **Own delivery** means the venue arranges its own courier outside Project Imperium.
- **customer-facing provider branding, tracking, and ETA** — no customer surface in stage 1.

---

## 2. Domain model and vocabulary

### Entities

- **Delivery provider** — one third-party delivery company in the global catalogue. It carries a stable provider key, a display name, the countries and optionally regions it serves, its supported integration actions, the shape of the credentials it needs, a support contact, and an enabled state.
- **Courier provider connection** — one Business's connection to one delivery provider. It carries the provider, credentials held write-only, connection status, who connected it, when, when it was last tested, and the last error. A Business has **at most one active connection**.
- **External delivery** — the provider's record of one delivery batch. It carries the provider and connection used, the external delivery reference the provider returned, optional courier name and phone, optional ETA and tracking link, and the current sync state.
- **Delivery sync log** — one attempt to call a provider for a courier request, handover, or cancellation. It carries the provider, action, external reference, attempt number, response code, error code and message, and time. It is operational troubleshooting history, not an audit entry.

### Terms this subject introduces

- **Delivery method** — how a venue fulfils delivery: **Own delivery** or a **third-party courier provider**. One method is active per Business at a time.
- **Own delivery** — the venue arranges and performs its own courier work outside Project Imperium. No provider is called; staff may record handover on a screen or POS, or the daily close reconciles it.
- **Courier provider** — a third-party delivery company connected through the delivery integration boundary.
- **Provider catalogue** — the global, Superadmin-maintained list of delivery providers available to businesses by country and region.
- **Courier provider connection** — a Business's activated relationship with one catalogue provider, including its write-only credentials.
- **Connection status** — **connected**, **disabled**, or **error**. A Business with no connection uses **Own delivery** or manually arranges a courier.
- **External delivery reference** — the provider's identifier for the delivery, stored so later handover and cancellation calls refer to the same delivery.
- **Courier request** — the action that asks a connected provider to dispatch a courier for a paid delivery batch at the moment the batch is sent to prep.
- **Courier handover** — the action that tells a connected provider that venue staff handed the batch to the courier. It is raised only when a staff screen or POS action records the handover as Delivered; without a staff handover it is skipped.
- **Courier cancellation** — the action that tells a connected provider to cancel a previously requested delivery because the delivery order was cancelled before handover. A refund alone does not trigger it.
- **Ready time** — the batch's deadline, drawn from the preparation time of its lines, sent with the courier request so the provider can aim the courier at the right time.
- **Sync state** — the current state of one provider action: **not requested**, **requesting**, **requested**, **request failed**, **handover synced**, **handover failed**, **not used**, **cancelled**, **cancel failed**, **not connected**, or **own delivery**.
- **No-handover reconciliation** — the daily close completing any delivery batch that a venue recorded no staff handover for, so the batch could not be marked Delivered by a screen or POS action.

Terms reused rather than redefined here: **Business**, **Delivery** (the channel and virtual sales point), **Order**, **Batch**, **Identification code**, **Fulfilment slice**, **Fulfilment status**, **Handover pass**, **Handover QR**, **Daily sales report**, **managers and above**, **managers on duty**, **Owner**, **Admin**, **Superadmin**, **soft delete**, and **business currency**.

---

## 3. Capabilities

### 3.1 Delivery methods

- A Business that enables delivery has exactly **one active delivery method**: **Own delivery** or one connected **third-party courier provider**.
- **Own delivery** is always available. It requires no provider connection and makes no provider calls. The venue arranges its own courier; staff may record the handover on the delivery screen or POS, and the daily close reconciles any batch that was not marked Delivered.
- A **third-party courier provider** is available only when the provider is enabled in the global catalogue for the Business's country and, where the provider narrows coverage, its region.
- A Business with no available provider still sees **Own delivery** and a clear statement that no third-party courier is available in its region yet.
- The **customer sees only “Delivery”**. The delivery method, provider name, connection state, and provider tracking are not customer-facing in stage 1.
- Changing the delivery method affects **new** delivery orders only. Orders already sent keep the method and connection that were active when they were sent.

### 3.2 Provider catalogue and per-business connection

- The **provider catalogue** is global. Each entry carries a stable provider key, display name, supported countries and optional regions, supported actions (courier request, courier handover, courier cancellation), credential requirements, support contact, documentation reference, and an enabled state.
- **Superadmin** creates, edits, enables, and disables catalogue entries. It never connects a provider on a Business's behalf.
- A Business's **Owner or Admin** connects or disconnects the provider from the Business's **Delivery partner** settings. Managers and above may see which method is active and whether the connection is healthy on operational surfaces; they cannot open the Delivery partner section, see credentials, or connect/disconnect.
- A connection stores provider credentials **write-only**: the platform may use them for provider calls, but no screen ever shows them again after they are saved.
- A connection is **connected**, **disabled**, or in **error**. A disabled or errored connection blocks new provider calls but does not stop the venue serving delivery manually; staff may still hand over and the daily close still reconciles.
- **One active connection per Business.** Connecting a different provider replaces the active connection for new orders; it does not rewrite orders already in flight.
- Credentials belong to the connection, not to the Business profile. Staff sign-in credentials remain personal to each User.

### 3.3 Courier request at batch send

- When a paid delivery batch is sent to prep and the Business has a connected provider, Project Imperium raises one **courier request** for that batch.
- The request is raised at **batch send**, not from a prep or delivery screen, so it works for venues that use no screens.
- The request carries the **ready time** — the batch deadline drawn from its lines' preparation times — so the provider can aim the courier at the moment the order should be ready.
- A courier request is **idempotent** per batch: a retry or duplicate trigger returns the same delivery outcome and never dispatches a second courier for the same batch.
- Staff on the delivery screen may **retry** a failed request manually. The platform also retries automatically under its retry policy.
- There is **no ready-time update action** in stage 1. If preparation runs late, the provider and its courier manage the wait in their own app.
- If the provider is not connected, or the Business uses **Own delivery**, no courier request is raised.

### 3.4 Courier handover when staff record Delivered

- When staff mark a delivery batch **Delivered** on the delivery screen or POS, and the Business has a connected provider, Project Imperium raises one **courier handover** for that batch.
- The handover call tells the provider that the venue has handed the batch to the courier. It is **optional by circumstance**: a venue that records no staff handover — no delivery screen and no POS handover action — cannot perform it, because there is no Delivered action to trigger it.
- The **courier provider's own app remains authoritative** for pickup and last-mile delivery. Project Imperium does not receive inbound courier state in stage 1.
- A courier handover is **idempotent** per batch. A retry or duplicate Delivered action returns the same outcome and never creates a second handover.
- A failed handover call **never blocks** the local Delivered status or the physical handover. It retries, and managers on duty are notified when the retry policy gives up.
- Marking Delivered on a screen is a local fulfilment action. It is not proof that the customer received the order; it means the venue handed the batch to the courier.

### 3.5 Courier cancellation

- When a delivery order is **cancelled** before handover, and the Business has a connected provider with an active courier request, Project Imperium raises one **courier cancellation** for that external delivery.
- A courier cancellation is **idempotent** per batch and never cancels more than the requested delivery.
- A **refund alone does not cancel the courier**. A refund returns money under the payments-and-tax subject; the delivery continues unless the order is also cancelled. If the venue wants to stop the delivery, it must cancel the order.
- If the provider has already completed the pickup in its own app, the cancellation may fail; the failure is recorded and surfaced to managers, and the provider's app remains authoritative for what happens next.

### 3.6 Failure, retry, and visibility

- Provider calls are **best-effort integrations**: Project Imperium records the local business outcome first and treats the provider call as a synchronisation, not a gate.
- Each call has a **timeout**, an **automatic retry policy** with backoff, and a **manual retry**. Retries never duplicate a courier request, handover, or cancellation.
- When the retry policy gives up on a **courier request**, **courier handover**, or **courier cancellation**, Project Imperium notifies the venue's **managers on duty**; if none are on duty, it falls back to all manager-layer users for the Business, as the notifications subject defines.
- The delivery screen shows the current sync state, the last error, and a retry action. A connection error is visible to managers and above.
- Every attempt is recorded in the **delivery sync log** with the provider, action, external reference, attempt number, response code, error, and time. The log never stores credentials and never stores more customer data than the provider call itself needed.
- The sync log follows the operational retention of the delivery order. It is **not** an audit-trail entry; manual delivery corrections that sibling subjects already audit remain audited.

### 3.7 No-handover venues and the daily close

- A venue may run delivery with **no prep or delivery screen**. Nothing in the courier request depends on a screen: the request is raised at batch send.
- When the venue records no staff handover, no **courier handover** call is raised. The courier provider's own app records the pickup, and the daily sales report close completes any fulfilment slice still not Delivered.
- The daily close **does not block** on a failed courier request or a failed handover call. It completes the batch and records the exception for the report.
- The daily sales report surfaces, per delivery batch, the **courier request status**, the **courier handover status** (including **not used** when no staff screen or POS action recorded it), and whether completion came from a **staff screen** or the **close sweep**. Failed calls are listed as exceptions.
- A delivery batch completed only by the close sweep has no recorded handover time. The timed delivery review email is therefore **not sent** for it; the customer can still review from order history or the receipt. A batch with a recorded staff handover follows the normal delivery-review timing.

### 3.8 Provider contract

A provider adapter must satisfy this semantic contract. The exact integration field names are recorded in ADR-0009; this subject states the business-level contract.

**Courier request**

- the Business and its venue identity, address, and phone;
- the batch reference and customer-facing order code;
- an optional external delivery reference when the provider already knows the order;
- the delivery address, customer name and phone, and delivery instructions;
- the items with quantity and preparation notes (no customer email and no allergen data by default);
- the order total and currency, marked as prepaid;
- the ready time;
- a stable idempotency key.

**Courier handover**

- the same Business and batch identity;
- the external delivery reference returned by the request;
- the handover time;
- a stable idempotency key.

**Courier cancellation**

- the Business and batch identity;
- the external delivery reference;
- the cancellation time and reason that the provider may show its courier;
- a stable idempotency key.

**Provider response**

- the external delivery reference;
- optional courier name and phone;
- optional ETA and tracking link;
- a status and a provider error when the call fails.

**Connection**

- the provider key, write-only credentials, connection status, who connected it, when, when it was last tested, and the last error.

**Sync log**

- the delivery batch, provider, action, external reference, attempt number, response code, error code and message, and time.

### 3.9 Stage 1 catalogue

- Stage 1 ships **Own delivery** and the provider catalogue **empty** until Superadmin adds a provider.
- The Business config shows `Own delivery` selected by default when delivery is enabled, and a disabled third-party option stating that no provider is available in the region yet.
- No production “test provider” is exposed. Provider adapters are exercised by internal test doubles, not by a customer-visible catalogue entry.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Delivery-integration powers |
| --- | --- |
| **Customer** | Sees only “Delivery”; never sees the delivery method, provider, connection, sync state, or tracking. |
| **Employee** | May mark a delivery batch Delivered on an entitled screen, which triggers a courier handover; may retry a failed courier request or handover from the delivery screen when entitled to that screen. Cannot connect providers or see credentials. |
| **Supervisor** | Same as employee for handover and retry on the delivery screen. Does not see provider connection health, connect providers, or see credentials. |
| **Manager** | Everything a supervisor can do, plus seeing the delivery-integration status, sync failures, and the daily report exceptions. Cannot connect or disconnect a provider or see credentials. |
| **Admin/owner** | Everything a manager can do, plus opening the **Delivery partner** settings, choosing the delivery method, and connecting or disconnecting a provider. |
| **Superadmin** | Maintains the global provider catalogue and its country/region availability. Does not connect providers for a Business. |

### Who can do what

| Activity | Who |
| --- | --- |
| Choose `Own delivery` or a connected third-party provider | Owner or Admin |
| Connect or disconnect a courier provider; enter or replace its credentials | Owner or Admin |
| View the active delivery method and connection health | Managers and above |
| View or use provider credentials | No one after save; the platform uses them write-only |
| Raise a courier request | Automatic at delivery batch send when a provider is connected |
| Retry a failed courier request | Staff allowed on the delivery screen; managers and above |
| Mark a delivery batch Delivered and raise a courier handover | Staff allowed on the delivery screen or POS under the fulfilment rules |
| Retry a failed courier handover | Staff allowed on the delivery screen; managers and above |
| Cancel a courier request | Automatic when a delivery order is cancelled before handover |
| See delivery-integration status and exceptions | Managers and above; employees with the daily-report view capability |
| Maintain the provider catalogue and country/region availability | Superadmin console operators |
