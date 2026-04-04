# Restaurant POS Backend (Fastify)

This is the new Fastify backend for the Restaurant POS system, fully migrated from the legacy Next.ts API routes.

## Migration Status

**✅ Migration Completed - 2026-03-18**

All 126 endpoints have been successfully migrated from the legacy Next.ts backend to this Fastify server.

## Quick Start

```bash
# Install dependencies
npm --prefix backend install

# Start development server
npm --prefix backend run dev

# Start production server
npm --prefix backend run start
```

## Address model (shared)

Business, supplier, and user `personalDetails` embed **`addressSchema`** (`src/models/address.ts`). Optional fields include **`doorNumber`** and **`complement`** (plus `region`, `additionalDetails`, `coordinates`). See **`packages/interfaces/IAddress.ts`** and `documentation/context.md` (Shared physical address).

## Server Details

- **Default port**: `4000` (override with `PORT` env var)
- **Health check**: `GET /health`
- **API base**: `/api/v1`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes (prod) | Secret for JWT signing (defaults to dev secret) |
| `REFRESH_SECRET` | Yes (prod) | Secret for refresh tokens (defaults to dev secret) |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `PORT` | No | Server port (default: 4000) |

### Communications reliability env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `COMMUNICATIONS_EMAIL_RETRY_ATTEMPTS` | No | Number of retries for transient SMTP send failures (default: `2`) |
| `COMMUNICATIONS_EMAIL_RETRY_BASE_DELAY_MS` | No | Base backoff delay in milliseconds for retries (default: `250`) |
| `COMMUNICATIONS_EMAIL_ENABLED` | No | Enable/disable email channel (`false` disables) |
| `COMMUNICATIONS_INAPP_ENABLED` | No | Enable/disable persisted in-app channel (`false` disables) |
| `COMMUNICATIONS_INAPP_LIVE_ENABLED` | No | Enable/disable live WS push bridge and `/notifications/live` route |
| `COMMUNICATIONS_IDEMPOTENCY_WINDOW_MS` | No | Default dispatch idempotency suppression window in milliseconds |
| `BUSINESS_PROFILE_UPDATED_MANAGER_POLICY` | No | Manager recipient mode for profile-update notifications: `allManagers` (default) or `onDutyManagers` (same pattern as `MONTHLY_REPORT_MANAGER_POLICY`, etc.) |

Failed dispatch persistence policy (initial version):
- failed attempts are logged/metriced for observability
- failed attempts are **not** persisted to a replay queue yet
- core business flow remains non-blocking when `fireAndForget` is enabled

### Communications rollout (progressive)

Use this rollout sequence to enable unified communications safely:

1. Non-production first (required)
   - set `COMMUNICATIONS_EMAIL_ENABLED=true`
   - set `COMMUNICATIONS_INAPP_ENABLED=true`
   - set `COMMUNICATIONS_INAPP_LIVE_ENABLED=true`
2. Validate in staging/UAT with route + communications suites.
3. Production enablement
   - optional burn-in: keep `COMMUNICATIONS_INAPP_LIVE_ENABLED=false` for 24-48h
   - then enable live push (`COMMUNICATIONS_INAPP_LIVE_ENABLED=true`)
4. Unified dispatcher cutover status
   - unified dispatch is always active after Phase 6 cutover
   - channel-level controls remain available via `COMMUNICATIONS_EMAIL_ENABLED`, `COMMUNICATIONS_INAPP_ENABLED`, and `COMMUNICATIONS_INAPP_LIVE_ENABLED`

Module migration order used in this project:
- Orders
- Reservations
- Inventory alerts
- Monthly reports
- Weekly reports
- Notifications route internals (optional)

## Notifications and communications architecture

Current backend notification design uses a single write boundary for both domain and manual flows:

- Domain-triggered flow:
  - domain module -> `dispatchEvent` -> `inAppChannel.send` -> `notificationService.createAndDeliver`
  - **Business profile:** authenticated `PATCH /api/v1/business/:businessId` emits `BUSINESS_PROFILE_UPDATED` when there are real field changes (templates + manager resolver in `src/communications`; details in `src/communications/README.md`)
- Manual admin flow:
  - `POST /api/v1/notifications` -> `notificationService.createAndDeliver`
- Shared persistence path:
  - `notificationRepository.createAndFanoutResolved`
- Live bridge ownership:
  - `liveBridge` subscribes to persisted notification events and calls live push channel
- Live route ownership:
  - `GET /api/v1/notifications/live` handles connection/auth/registry only (no persistence writes)

### Notifications API behavior (current)

- List endpoints return `200` with arrays (empty list returns `[]`):
  - `GET /api/v1/notifications`
  - `GET /api/v1/notifications/business/:businessId`
  - `GET /api/v1/notifications/user/:userId`
- List endpoints support pagination query parameters:
  - `page` (default `1`)
  - `limit` (default `20`, max `100`)
- Optional heavy recipient population can be enabled by:
  - `includeRecipients=true`

### WebSocket notifications contract (current)

- Connection ack event:
  - `type: "notification.live.connected"`
  - `data: { userId }`
- Notification push event:
  - `type: "notification.created"`
  - `data: { notificationId, businessId, message, notificationType, correlationId }`
- Live auth supports:
  - `Authorization: Bearer <token>`
  - `?access_token=<token>` query fallback for browser WS constraints

### Operational notes

- Persistence is the source of truth; live push is best-effort acceleration.
- Idempotency is supported in dispatch via key + window controls.
- Live metrics include drop/auth reasons for diagnostics.
- Index migration/rollback notes for notification performance tuning:
  - `src/communications/NOTIFICATION_INDEX_MIGRATION_NOTES.md`

## API Modules

| Module | Prefix | Endpoints |
|--------|--------|-----------|
| Auth | `/api/v1/auth` | 6 |
| Business | `/api/v1/business` | 5 |
| BusinessGoods | `/api/v1/businessGoods` | 6 |
| Orders | `/api/v1/orders` | 6 |
| SalesInstances | `/api/v1/salesInstances` | 11 |
| SalesPoints | `/api/v1/salesPoints` | 5 |
| Suppliers | `/api/v1/suppliers` | 6 |
| SupplierGoods | `/api/v1/supplierGoods` | 6 |
| Inventories | `/api/v1/inventories` | 11 |
| Purchases | `/api/v1/purchases` | 10 |
| Employees | `/api/v1/employees` | 6 |
| Schedules | `/api/v1/schedules` | 10 |
| Users | `/api/v1/users` | 7 |
| Promotions | `/api/v1/promotions` | 6 |
| DailySalesReports | `/api/v1/dailySalesReports` | 8 |
| WeeklyBusinessReport | `/api/v1/weeklyBusinessReport` | 3 |
| MonthlyBusinessReport | `/api/v1/monthlyBusinessReport` | 5 |
| Reservations | `/api/v1/reservations` | 6 |
| Ratings | `/api/v1/ratings` | 3 |
| Notifications | `/api/v1/notifications` | 7 |
| Printers | `/api/v1/printers` | 9 |

## Authentication

The backend uses JWT-based authentication with:

- `@fastify/jwt` for JWT signing/verification
- `@fastify/cookie` for refresh tokens

### Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login with email/password |
| POST | `/api/v1/auth/logout` | Clear session |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/set-mode` | Set auth mode (customer/employee) |
| GET | `/api/v1/auth/mode` | Get current auth mode |

### Token Strategy

- **Access Token**: Short-lived (15 min), sent in `Authorization: Bearer <token>` header
- **Refresh Token**: Long-lived (7 days), stored in httpOnly cookie

## Project Structure

```
backend/
├── src/
│   ├── auth/           # Authentication module
│   ├── cloudinary/     # Image upload utilities
│   ├── db/             # Database connection
│   ├── models/         # Mongoose models
│   ├── communications/ # Communications, notifications, live bridge
│   ├── routes/
│   │   └── v1/         # API v1 routes
│   ├── utils/          # Shared utilities
│   └── server.ts       # Server entry point
└── package.json
```

## Development

### Adding New Routes

1. Create route file in `backend/src/routes/v1/`
2. Register in `backend/src/routes/v1/index.ts`
3. Add authentication hooks as needed

### Authentication Hooks

```typescript
import { createAuthHook, requireBusinessHook } from "../../auth/middleware.ts";

// Protected route
app.get("/protected", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
  const session = req.authSession; // User session data
  // ...
});

// Business-only route
app.get("/admin", { 
  preValidation: [createAuthHook(app), requireBusinessHook()] 
}, async (req, reply) => {
  // Only business accounts can access
});
```

## Testing

The backend uses **Vitest** with Fastify's built-in `inject()` method for testing.

### Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run only route tests
npm run test:routes
```

### Test Structure

```
backend/tests/
├── setup.ts           # Global setup (MongoDB Memory Server)
├── helpers/
│   ├── app.ts         # App builder for tests
│   ├── auth.ts        # Authentication helpers
│   ├── fixtures.ts    # Test data factories
│   └── index.ts       # Barrel export
└── routes/
    ├── auth.test.ts
    ├── business.test.ts
    └── ...
```

### Writing Tests

```typescript
import { describe, it, expect } from "vitest";
import { getTestApp, createTestBusiness, loginAsBusiness, authHeader } from "../helpers";

describe("Business Routes", () => {
  it("GET /api/v1/business returns list", async () => {
    const app = await getTestApp();
    
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/business",
    });

    expect(response.statusCode).toBe(200);
  });
});
```

## Migration Notes

- This backend replaces the legacy Next.ts API routes that used to live under `app/api/`.
- Shared types and interfaces are in `packages/shared/`
- The legacy routes are kept for reference but not used
- See `docs/migration/MIGRATION_PLAN.md` for complete migration history
