# Communications and Notifications (Backend)

This is the single source of truth for backend communications/notifications documentation.

It consolidates architecture, API contracts, WebSocket contracts, runbook operations, index/migration guidance, and performance baseline notes.

## Scope and boundaries

- Module scope: backend communications pipeline and notifications routes.
- REST base path: `/api/v1/notifications`
- WebSocket path: `/api/v1/notifications/live`
- Source of truth: persisted in-app notification (live push is best-effort acceleration).

## Core architecture

### 1) Orchestration entrypoint

- `dispatchEvent` is the domain communications entrypoint.
- Domain modules call `dispatchEvent(eventName, payload, options)`.
- Orchestration resolves:
  - message templates,
  - recipients,
  - channels,
  - feature flags, idempotency, and fire-and-forget behavior.

### 2) Channel boundaries

- `email` channel:
  - SMTP send path with retry/backoff.
- `inApp` channel:
  - Delegates to `notificationService.createAndDeliver(...)`.
  - Persists notification and fans out inbox refs in `User.notifications`.
  - Emits persisted-notification live event.
- `liveInApp` channel:
  - Pushes normalized payload to connected recipient sockets.
  - Never replaces persisted inbox delivery.

### 3) Service and repository boundaries

- Shared create path: `notificationService.createAndDeliver(...)`
  - used by both manual `POST /notifications` and domain-triggered flows.
- Persistence path: `notificationRepository.createAndFanoutResolved(...)`
  - persistence/fanout focused.

### 4) Live bridge ownership

- `liveBridge` subscribes to persisted-notification events.
- Live route (`notificationsLive.ts`) only handles connection/auth/registry.
- Bridge/channel handle push orchestration.

## Event catalog (domain-triggered)

- `ORDER_CONFIRMED`
- `RESERVATION_PENDING`
- `RESERVATION_DECIDED`
- `LOW_STOCK_ALERT`
- `MONTHLY_REPORT_READY`
- `WEEKLY_REPORT_READY`
- `BUSINESS_PROFILE_UPDATED`

### `BUSINESS_PROFILE_UPDATED` (business profile saved)

- **Trigger:** successful `PATCH /api/v1/business/:businessId` in `backend/src/routes/v1/business.ts` after `findByIdAndUpdate`, only when the computed `$set` object has at least one changed path (no dispatch on no-op updates). Typical web entry: tenant **`BusinessProfileSettingsPage`** (**`/business/:businessId/settings/profile`**).
- **Payload:** typed in `backend/src/communications/types.ts` (`businessId`, `actor` snapshot from session, flattened `changedFields` + count, `occurredAt`, optional `context` with correlation/operation id and request metadata).
- **Correlation / idempotency:** route forwards `X-Correlation-Id` and `X-Idempotency-Key` (when present) into `dispatchEvent` options so repeated saves can dedupe within `COMMUNICATIONS_IDEMPOTENCY_WINDOW_MS`.
- **Recipients:** management employees resolved via `resolveManagersByPolicy`. Default policy for this event is **`allManagers`**; override with env `BUSINESS_PROFILE_UPDATED_MANAGER_POLICY` (`onDutyManagers` | `allManagers`), consistent with other events.
- **Channels:** in-app notification to manager `employeeIds` (persisted path); email to resolved manager user emails when the email channel is enabled and SMTP is available. Copy is built by `templates/businessProfileUpdatedTemplate.ts` (sensitive field paths are not echoed verbatim in message text).
- **Failure semantics:** route uses `fireAndForget: true` and a local `.catch` log so **HTTP 200 profile save is not blocked** by communications failures.

## Reliability model

- Durability first:
  - in-app persistence is the delivery source of truth.
- Live push:
  - best-effort acceleration for online recipients.
- Fire-and-forget:
  - default for non-blocking business flows.
- Idempotency:
  - process-local in-memory dispatch window.
  - multi-instance duplicate suppression is not guaranteed yet.

Future-ready interface (not implemented yet):

- `isDuplicate(key, windowMs): Promise<boolean>`
- `markDispatched(key, atMs): Promise<void>`

## Observability and metrics

Recorded counters include:

- `dispatchAttemptsByEvent`
- `dispatchSuccessByEvent`
- `dispatchFailureByEvent`
- `channelSuccessByEvent`
- `channelFailureByEvent`
- `live.pushedEvents`
- `live.deliveredSockets`
- `live.droppedPushes`
- `live.droppedPushesByReason`
- `live.authFailures`
- `live.authFailuresByReason`

Initial threshold guidance:

- live auth failures: `> 20` in 5 minutes
- socket send failure drops: `> 10` in 5 minutes
- dropped/pushed ratio: `> 0.30` for 10 minutes

## REST API contract

### `GET /api/v1/notifications`

List all notifications.

Query params:

- `page` (optional, integer >= 1, default `1`)
- `limit` (optional, integer `1..100`, default `20`)
- `includeRecipients` (optional, `true|false`, default `false`)

Response:

- `200` with `Notification[]` (including `[]` for empty)

### `POST /api/v1/notifications`

Create notification + fanout + live best-effort push.

Required:

- `notificationType`
- `message`
- `businessId`
- exactly one recipient mode:
  - `employeesRecipientsIds`, or
  - `customersRecipientsIds`

Response:

- `201` with `{ "message": "Notification message created and sent" }`

Common errors:

- `400` invalid/missing data
- `404` business not found
- `500` create failed

### `GET /api/v1/notifications/:notificationId`

- `200` notification
- `400` invalid id
- `404` not found

### `PATCH /api/v1/notifications/:notificationId`

Update fields/recipients.

Rules:

- exactly one recipient mode (`employeesRecipientsIds` xor `customersRecipientsIds`)
- recipient list cannot be empty

Response:

- `200` with `{ "message": "Notification and recipients updated successfully" }`

### `DELETE /api/v1/notifications/:notificationId`

Delete notification and recipient inbox references.

Response:

- `200` with `{ "message": "Notification deleted successfully" }`

### `GET /api/v1/notifications/business/:businessId`

Business-scoped list with same pagination/query rules.

Response:

- `200` with `Notification[]` (including empty list)
- `400` invalid business id

### `GET /api/v1/notifications/user/:userId`

User inbox list with same pagination/query rules.

Response:

- `200` with `Notification[]` (including empty list)
- `400` invalid user id

## WebSocket contract

Endpoint:

- `GET /api/v1/notifications/live`

Auth methods:

- `Authorization: Bearer <token>` (preferred)
- `?access_token=<token>` query fallback

Auth failure close behavior:

- missing token -> `1008 Unauthorized`
- invalid token -> `1008 Unauthorized`
- non-user session -> `1008 Forbidden`

### Connection ack event

```json
{
  "type": "notification.live.connected",
  "data": {
    "userId": "..."
  }
}
```

### Notification event

```json
{
  "type": "notification.created",
  "data": {
    "notificationId": "...",
    "businessId": "...",
    "message": "...",
    "notificationType": "...",
    "correlationId": "..."
  }
}
```

Contract evolution policy:

- additive changes: optional fields only
- breaking changes: introduce versioning (`schemaVersion` and/or versioned event name)
- keep old contract version active during migration window

## Operations runbook

### Local setup

```bash
npm --prefix backend install
npm --prefix backend run dev
```

### Validation commands

```bash
# full backend suite
npm --prefix backend test

# focused notifications/communications regression
npm --prefix backend test -- tests/routes/notifications.test.ts tests/routes/notificationsLive.test.ts tests/integration/communicationsDomainFlows.test.ts tests/communications/communicationsCore.test.ts

# performance baseline harness
npm --prefix backend test -- tests/perf/notificationsReadPerf.test.ts
```

### Required environment controls

- `COMMUNICATIONS_EMAIL_ENABLED`
- `COMMUNICATIONS_INAPP_ENABLED`
- `COMMUNICATIONS_INAPP_LIVE_ENABLED`
- `COMMUNICATIONS_IDEMPOTENCY_WINDOW_MS`
- `COMMUNICATIONS_EMAIL_RETRY_ATTEMPTS`
- `COMMUNICATIONS_EMAIL_RETRY_BASE_DELAY_MS`

Recommended local/staging baseline:

- `COMMUNICATIONS_INAPP_ENABLED=true`
- `COMMUNICATIONS_INAPP_LIVE_ENABLED=true`
- `COMMUNICATIONS_EMAIL_ENABLED=false` (optional local simplification)

### Manual WebSocket checks

Connection/auth:

1. No token -> close `1008 Unauthorized`
2. Invalid token -> close `1008 Unauthorized`
3. Non-user token -> close `1008 Forbidden`
4. Valid user token -> receive `notification.live.connected`

Push/fallback:

1. Keep valid user connected.
2. `POST /api/v1/notifications` targeting that user.
3. Expect `notification.created`.
4. Disconnect user and create another notification.
5. Confirm REST inbox fallback: `GET /api/v1/notifications/user/:userId`.

### Troubleshooting quick matrix

| Symptom | Likely cause | Check | Fix |
|---|---|---|---|
| No `notification.created` | live disabled | `COMMUNICATIONS_INAPP_LIVE_ENABLED` | enable and restart |
| WS unauthorized | missing/invalid token | auth header/query token | send valid user JWT |
| WS forbidden | non-user session | token payload `type` | use user token |
| Persisted but no live push | user offline/no socket | live counters/registry logs | expected; use REST inbox |
| Slow read endpoints | query/index mismatch | explain stats, query params | tune indexes/projections |
| Auth failure spike | token lifecycle issue | `authFailuresByReason` | fix token refresh/session |
| Push drop spike | socket/network instability | `droppedPushesByReason` | inspect WS/network lifecycle |

### Rollback checklist

1. Disable live quickly if needed: `COMMUNICATIONS_INAPP_LIVE_ENABLED=false`
2. Optionally disable email channel: `COMMUNICATIONS_EMAIL_ENABLED=false`
3. Keep durability path on: `COMMUNICATIONS_INAPP_ENABLED=true`
4. Re-run focused regression tests
5. Validate manual create, domain dispatch, inbox reads, and WS connect behavior
6. Review logs/metrics for elevated failures

## Indexes, migration, and rollback

### Canonical indexes

`notifications`:

- `{ businessId: 1, createdAt: -1 }`
- `{ customersRecipientsIds: 1, createdAt: -1 }`
- `{ employeesRecipientsIds: 1, createdAt: -1 }`

`users`:

- `{ "notifications.notificationId": 1 }`

Definition locations:

- `backend/src/models/notification.ts`
- `backend/src/models/user.ts`

### Deployment notes

- Indexes are additive, no data migration required.
- Build in maintenance windows for large datasets.
- Validate query plans using `explain("executionStats")`.

### Post-deploy checks

- `db.notifications.getIndexes()`
- `db.users.getIndexes()`
- Verify query shapes:
  - `/api/v1/notifications`
  - `/api/v1/notifications/business/:businessId`
  - `/api/v1/notifications/user/:userId`

### Explain commands

```javascript
// global list
db.notifications
  .find({}, { _id: 1, notificationType: 1, message: 1, businessId: 1, senderId: 1, employeesRecipientsIds: 1, customersRecipientsIds: 1, createdAt: 1, updatedAt: 1 })
  .sort({ createdAt: -1 })
  .limit(20)
  .explain("executionStats");

// business list
db.notifications
  .find({ businessId: ObjectId("<businessId>") }, { _id: 1, notificationType: 1, message: 1, businessId: 1, senderId: 1, employeesRecipientsIds: 1, customersRecipientsIds: 1, createdAt: 1, updatedAt: 1 })
  .sort({ createdAt: -1 })
  .limit(20)
  .explain("executionStats");

// user inbox notification fetch step
db.notifications
  .find({ _id: { $in: [ObjectId("<notificationId1>"), ObjectId("<notificationId2>")] } }, { _id: 1, notificationType: 1, message: 1, businessId: 1, senderId: 1, employeesRecipientsIds: 1, customersRecipientsIds: 1, createdAt: 1, updatedAt: 1 })
  .sort({ createdAt: -1 })
  .limit(20)
  .explain("executionStats");

// user-side inbox ref lookup
db.users.find({ _id: ObjectId("<userId>") }, { "notifications.notificationId": 1 }).explain("executionStats");
```

Validation expectations:

- Indexed query shapes should avoid `COLLSCAN`.
- `totalDocsExamined` should stay near returned docs for targeted queries.

### Index rollback

Drop in this order if required:

1. `db.users.dropIndex({ "notifications.notificationId": 1 })`
2. `db.notifications.dropIndex({ employeesRecipientsIds: 1, createdAt: -1 })`
3. `db.notifications.dropIndex({ customersRecipientsIds: 1, createdAt: -1 })`
4. `db.notifications.dropIndex({ businessId: 1, createdAt: -1 })`

## Performance baseline and history

Baseline harness:

- `backend/tests/perf/notificationsReadPerf.test.ts`

Current snapshots:

- latest rolling:
  - `backend/src/communications/NOTIFICATIONS_PERFORMANCE_BASELINE_SNAPSHOT.json`
- date-stamped history:
  - `backend/src/communications/NOTIFICATIONS_PERFORMANCE_BASELINE_SNAPSHOT_2026-03-24.json`

Notes:

- values are local synthetic baseline numbers (not production SLOs).
- use date-stamped snapshots for before/after optimization comparisons.
- evaluate global read indexing (`createdAt`-first path) only if production telemetry confirms sustained pressure.

## Verification history (latest closure highlights)

- two-user live flow regression:
  - `npm --prefix backend test -- tests/routes/notificationsLive.test.ts tests/routes/notifications.test.ts`
  - result: `2` files, `32` tests passed.
- perf baseline harness:
  - `npm --prefix backend test -- tests/perf/notificationsReadPerf.test.ts`
  - result: `1` file, `1` test passed.
- full backend closure proof:
  - `npm --prefix backend test`
  - result: `40` files, `605` tests passed.

## Related implementation paths

- `backend/src/routes/v1/notifications.ts`
- `backend/src/routes/v1/notificationsLive.ts`
- `backend/src/communications/dispatchEvent.ts`
- `backend/src/communications/services/notificationService.ts`
- `backend/src/communications/live/liveBridge.ts`
- `backend/src/communications/live/connectionRegistry.ts`
