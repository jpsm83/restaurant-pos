# Communications Module README

This module is the unified communication layer for the backend.

Its job is to make every domain event that needs communication (email, persisted in-app notification, and live in-app push) follow one consistent flow, with one orchestration entrypoint and clear reliability rules.

## Purpose and boundaries

- Centralize all domain-triggered communication logic in one place.
- Keep domain modules focused on business actions (orders, reservations, inventory, reports), not channel implementation details.
- Persist in-app notifications as the source of truth before any live push attempt.
- Keep communications non-blocking for critical business flows by default.
- Make delivery behavior observable through structured logs and counters.

This module is for domain-triggered communications. Manual admin CRUD operations for notifications remain under the notifications route and share the same repository path for persistence/fanout consistency.

## Core architecture

### 1) Single orchestration entrypoint

- `dispatchEvent` is the single event orchestration entrypoint for domain communications.
- Domain modules call `dispatchEvent(eventName, payload, options)` with typed payloads.
- `dispatchEvent` decides:
  - Which message template to use.
  - Which recipients to target.
  - Which channels to execute.
  - How to apply feature flags, idempotency, and fire-and-forget behavior.

### 2) Channel abstraction

The module uses channel adapters so orchestration is independent of transport details:

- `email` channel:
  - Sends through the SMTP provider.
  - Uses retry with exponential backoff for transient errors.
- `inApp` channel:
  - Persists a notification.
  - Fans out inbox references to recipients in `User.notifications`.
  - Emits live event for optional WebSocket push.
- `liveInApp` channel:
  - Pushes persisted notifications to connected user sockets.
  - Never replaces persistence; it is an acceleration layer.

### 3) Provider and repository single paths

- One SMTP transport entrypoint:
  - SMTP transport is initialized and cached in the SMTP provider.
  - Email channel consumes provider state, not raw transport setup.
- One in-app persistence path:
  - Notification creation and user inbox fanout are centralized in the notification repository.
  - Both domain dispatch and manual notification route operations use this shared path.

### 4) Recipient resolvers and policies

- Recipient resolution is centralized in dedicated resolver functions.
- Manager recipient policy is event-based:
  - On-duty managers for operational urgency events.
  - All managers for report-ready review events.
- Policy can be overridden by environment variables per event when needed.

### 5) Templates

- Message templates are pure builders.
- Final message generation for domain events happens in the orchestration layer, not scattered through modules.
- This ensures consistent wording, formatting, and future localization strategy.

## Event catalog and user-facing behavior

The orchestration layer currently handles:

- `ORDER_CONFIRMED`
  - Trigger: paid self-order or paid delivery-style flow.
  - Recipients: the customer user.
  - Channels: email (if SMTP configured and enabled) + in-app persisted notification.
  - User-level outcome: customer receives receipt/confirmation by email and in app.

- `RESERVATION_PENDING`
  - Trigger: reservation request created in pending state.
  - Recipients: requesting customer and managers by policy.
  - Channels:
    - Customer: email + in-app.
    - Managers: in-app action-required notification.
  - User-level outcome: customer sees pending status; managers get approval task.

- `RESERVATION_DECIDED`
  - Trigger: reservation status set to confirmed or cancelled.
  - Recipients: customer.
  - Channels: email + in-app.
  - User-level outcome: customer receives final reservation decision.

- `LOW_STOCK_ALERT`
  - Trigger: low-stock check after inventory-impacting flow.
  - Recipients: managers by policy.
  - Channels: in-app.
  - User-level outcome: managers are alerted to inventory risk items.
  - Noise controls:
    - Domain cooldown guard.
    - Dispatch-level idempotency guard.

- `MONTHLY_REPORT_READY`
  - Trigger: monthly report closure/finalization flow.
  - Recipients: managers by policy.
  - Channels: in-app.
  - User-level outcome: managers are informed the month is ready for review.
  - Includes in-process dedup protection to avoid repeated notifications for same period.

- `WEEKLY_REPORT_READY`
  - Trigger: weekly report closure/finalization flow.
  - Recipients: managers by policy.
  - Channels: in-app.
  - User-level outcome: managers are informed the week is ready for review.

## End-to-end flow (domain event to user)

1. A domain module finishes a business action and emits a communication event through `dispatchEvent`.
2. Orchestration resolves message content and recipients for that event.
3. Enabled channels execute according to flags and optional preferred channel selection.
4. For in-app:
   - Notification is persisted.
   - User inbox entries are updated.
   - A live event is emitted for optional WebSocket delivery.
5. For live in-app:
   - Connected sockets for recipients receive the notification payload.
   - If user has no active socket, nothing is lost because persistence already happened.
6. Structured logs and counters record attempt, per-channel result, and final dispatch outcome.

## Reliability and failure strategy

### Fire-and-forget default

- Dispatch defaults to fire-and-forget to avoid blocking core business actions.
- Channel failures are captured as results/logs instead of throwing by default.

### Email reliability

- Email channel validates recipients and content.
- SMTP provider state is checked before send.
- Transient failures use retry with exponential backoff.
- Retry behavior is configurable through environment variables.

### In-app reliability

- Persistence is the source of truth.
- Live push is best-effort enhancement.
- Users without active WebSocket connections still see notifications through inbox APIs.

### Idempotency and noise control

- Orchestration supports idempotency key + window to suppress duplicate dispatches.
- Inventory low-stock flow uses both local cooldown and dispatch idempotency for noise reduction.

## Observability

The module records:

- Dispatch attempts by event.
- Dispatch success/failure by event.
- Channel success/failure by event+channel.
- Live push counters:
  - pushed events
  - delivered sockets
  - dropped pushes
  - live auth failures

Logs are structured with fields such as:

- scope
- stage or outcome
- event name
- business id
- correlation id

This supports tracing one communication operation through orchestration, persistence, and live push.

## WebSocket live in-app design

- Live route accepts user sessions only.
- Authentication failures are logged and counted.
- Connection registry tracks sockets by user id.
- Heartbeat keeps connection health and cleans dead sockets.
- Pushes target recipient user ids and count delivered vs dropped attempts.

## Feature flags and controls

Channel-level flags control runtime behavior:

- `COMMUNICATIONS_EMAIL_ENABLED`
- `COMMUNICATIONS_INAPP_ENABLED`
- `COMMUNICATIONS_INAPP_LIVE_ENABLED`

Unified dispatch is the active architecture; channel flags are used for operational control and progressive rollout behavior.

Additional controls:

- Email retry attempts and backoff delay env vars.
- Dispatch idempotency window env var.
- Event-specific manager policy override env vars.

## Design patterns used

- Event-driven orchestration.
- Channel adapter pattern.
- Repository pattern for persistence + fanout.
- Resolver pattern for recipient computation.
- Policy matrix with per-event override support.
- Template builder pattern for deterministic message content.
- Structured observability and lightweight in-process metrics.
- Fire-and-forget safe boundary for non-critical side effects.

## User-level experience summary

- Customers receive order confirmations and reservation updates consistently in the same communication style.
- Managers receive actionable operational alerts (pending reservations, low stock) and period-closure readiness signals (weekly/monthly reports).
- In-app inbox is always the durable source of truth.
- Live updates make notifications feel real-time when users are online.
- If a user is offline, they still receive the notification when they next read their inbox.

## Operational notes

- Keep domain modules calling only `dispatchEvent` for domain communications.
- Avoid direct channel or transport usage in route/domain modules.
- Keep manual/admin notification CRUD logic inside notifications route boundaries.
- Use architecture linting and communications tests as guardrails for regressions.
