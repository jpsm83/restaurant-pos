# Realtime and concurrency

> **About this document.** This is the **target-state source of truth** for live updates and concurrency in Project Imperium — which surfaces stay on live server truth, how reconnect and stale UI behave, and who wins or is blocked when sales instances, batches, and settlement collide. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes realtime and concurrency as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **live data** and **conflict outcomes** across Project Imperium. It covers:

- the commitment that every entitled open screen works on **live** server truth;
- **reconnect** and **disconnected** behaviour (including that mutating actions are blocked while offline);
- **stale action** outcomes when a client’s view has fallen behind;
- concurrency rules for **sales instances**, **draft and send**, **settlement**, and **fulfilment**;
- **ordering-session** isolation for concurrent self-service baskets; and
- that transport and attempt-identity mechanics are decided in **ADR-0006**, not here.

It deliberately does **not** cover:

- **what** each surface displays or which lifecycle stages a sitting walks — sales-points-and-instances, orders, order-flow, printers-and-screens, and sibling subjects own those behaviours; this subject owns that they update live and how conflicting writes resolve.
- **notification catalogue and persistence-first delivery** — the notifications subject. Live push of inbox items follows this subject’s live-surface rule; storage and email copies stay with notifications and emails.
- **email** as a channel — emails are best-effort and are **not** a live surface.
- **plan entitlements and feature flags** — monetization and the feature-flags subject (Superadmin owns console toggles). This subject assumes the actor is already entitled to the surface.
- **exclusive editor locks** (“only Alice may open this tab”) — stage 1 does not use them; responsible-employee attribution stays with sales-points-and-instances.
- **offline write queues or local-first sync** — Project Imperium is online-only (product overview).

---

## 2. Domain model and vocabulary

### Entities

This subject introduces **no new persistent business entity**. It constrains how existing entities — sales instances, orders, batches, payments, fulfilment slices, stock, notifications, and every other domain record an entitled screen shows — are observed and mutated under concurrency.

### Terms this subject introduces

- **Ordering session** — the client session that owns one self-service **basket** from the moment ordering starts until pay-to-commit, abandon, or session end. Many ordering sessions may target the same sales point (or the virtual Delivery point) at once; baskets never merge across sessions.
- **Stale action** — a mutating attempt the server rejects because the client’s view no longer matches server truth (or the lifecycle no longer allows the act). The actor is told clearly; the UI must refresh to current truth before they retry with a new intent.
- **Same attempt** — a retry or double-tap of one intentional act (one Send, one Pay, one fulfilment advance). A same attempt yields the **same business outcome**, never a second kitchen ticket or a second charge.
- **Live surface** — any entitled open screen in the Customer app, Business app, or Superadmin console. While connected, it reflects server truth continuously.

Terms reused rather than redefined here: **Business**, **Sales point**, **Sales instance**, **Staff tab**, **Order**, **Batch**, **Identification code**, **Fulfilment slice**, **Fulfilment status**, **Bill**, **Payment**, **Outstanding balance**, **Guest basket**, **Pay-to-commit**, **Notification**, and **soft delete**.

---

## 3. Capabilities

### 3.1 The whole product is live

- Project Imperium is **live by design**. Every **live surface** an entitled person has open — POS, Host and floor occupancy, fulfilment and pickup boards, stock and inventory views, inbox, customer order status, Manage screens, Superadmin operational screens, public venue and menu browse while viewing, and every other entitled open screen — works on **current server truth**, not a stale local copy that drifts.
- When another actor changes something the open screen shows, that screen updates **without a manual refresh**.
- **Email** is not a live surface. Inbox items remain **persistence-first** (notifications subject); live push accelerates delivery to online recipients.
- A **closed or historical** period opened as finished work stays consistent with server truth: if that period is later **reopened or amended**, the open screen **refreshes** so it does not keep a wrong closed picture. This subject does not invent a separate streaming-analytics product beyond “the screen shows current server data.”

### 3.2 Disconnect and reconnect

- Connectivity is required. There is **no offline mode** and **no offline write queue**.
- When the live connection drops, the UI shows a clear **disconnected / reconnecting** state. The person may still see the last known screen **read-only**.
- **Mutating actions are blocked** until the connection is restored and the client has **resynced** to server truth.
- On reconnect, the client loads server truth. Any local draft that lost a conflict or lifecycle race is **discarded or replaced** from the server — never silently applied on top of newer truth.

### 3.3 Conflict model (general)

Structural writes follow four complementary rules (how the platform enforces them is ADR-0006):

1. **Stale action** — a write that would overwrite based on an out-of-date view is rejected; the UI refreshes; the actor may retry with current truth.
2. **Same-attempt replay** — retries and double-taps of one intentional Send, Pay, or fulfilment advance return the **same** outcome.
3. **Lifecycle block** — an act that the current state forbids (already sent, already closed, invalid fulfilment jump) fails with a clear reason; no silent overwrite.
4. **Compatible concurrent adds** — two actors adding **different** draft lines on the same staff tab both succeed when the server can apply both without clobbering the same line.

Stage 1 uses **no exclusive editor lock**. Two staff may open the same staff tab; live updates keep them aligned. Operational practice may still assign one responsible employee per tab (sales-points-and-instances); the product does not hard-lock the tab to one device.

### 3.4 Staff tab: draft, send, void, and edit

- Two staff editing the same open staff tab is uncommon and not the intended floor pattern, but the product **must** behave safely if it happens.
- **Compatible adds** of different draft lines both succeed; each actor sees the other’s lines live.
- **Same draft line, concurrent edits** (two actors change quantity, add-ons, or notes on the **same** line): the first successful write wins; the second is a **stale action** — no silent last-write-wins merge of conflicting edits on one line.
- **Send:** the first successful send commits those draft lines into a batch (identification code, stock, kitchen). A **same attempt** replay returns that batch. A **new** attempt to send lines **already sent** is a lifecycle block — **no second kitchen ticket**. Draft lines the first send did not include may still go out as a **later batch** (multi-batch sittings remain normal).
- **Void or edit racing send** on the same draft lines: the server applies commits in order. Send-first makes those lines sent (immutable except as the orders subject allows for managers); a draft void/edit of them fails and must use the sent-line correction path. Void/edit-first removes or changes those drafts; send applies only to what remains. There is **no silent dual success** on the same draft line.

### 3.5 Self-service: ordering sessions

- On **QR self-ordering**, **kiosk**, and **delivery**, many customers order at the same time. Each **ordering session** owns its own basket from the start of ordering.
- Baskets **never merge** because they share a sales point or the virtual Delivery point. Sharing a table QR does not share a basket.
- Each successful **pay-to-commit** creates its **own** sales instance, batch(es), and **identification code** (handover ticket). Abandoned sessions leave no shared basket for others.
- A **kiosk** is one ordering session per terminal use. Journey sequencing remains with the order-flow subject; sales-points-and-instances owns instance creation at pay.

### 3.6 Settlement

- A **same attempt** payment retry returns the same payment outcome — never a second charge for that intentional pay.
- Two **different** attempts that would **fully settle** the same bill: the first valid payment applies; the second is blocked (or cannot over-collect). An instance already **Closed** rejects further settle.
- Concurrent **partial** payments that each fit under the remaining outstanding balance both succeed in server commit order; live UI updates between them. Outstanding balance and over-tender rules stay with the payments-and-tax subject.

### 3.7 Fulfilment

- Advancing a fulfilment slice (Sent → Preparing → Ready → Delivered) replays safely for a same attempt and for a client that applies a status the slice **already holds** (success / no-op).
- An **invalid or backward** jump is a lifecycle block.
- Different slices of the same batch remain independent (orders subject).

### 3.8 Stock, inbox, and other live domains

- Stock movement, availability (including day-of sold-out), inbox contents, and every other domain record shown on a live surface update under the same live and conflict rules: observers see server truth; racing writers hit stale-action, lifecycle, or same-attempt replay as the act requires.
- Noisy notification triggers keep the cooldown and repeat-suppression the notifications subject already defines; this subject does not replace that catalogue.

---

## 4. Roles and entitlements

This subject adds **no new capabilities**. Who may open, send, pay, void, fulfil, or manage a record stays with access-and-permissions and the owning subject.

| Base access layer | What this subject adds |
| --- | --- |
| **Customer** | Sees entitled Customer live surfaces (order status, basket in their ordering session, inbox, public browse). Conflict and disconnect outcomes apply to their attempts. |
| **Employee** / **Supervisor** | Sees entitled Service live surfaces. Stale, lifecycle, and disconnect outcomes are shown to the **actor** who attempted the blocked action. |
| **Manager** / **Admin** | Same live and conflict rules on every surface they are entitled to, including Manage. |
| **Superadmin** | Console screens they may open are live surfaces under the same rules. |

| Outcome | Who sees it |
| --- | --- |
| Stale action, lifecycle block, disconnect write-block | The actor who attempted the mutation |
| Live update of a change | Every entitled open screen watching that record |
