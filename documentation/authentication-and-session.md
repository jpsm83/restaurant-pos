# Authentication, login, logout, and signup (backend)

This document describes how **identity**, **credentials**, **JWT sessions**, **cookies**, and **employee vs customer mode** work in the Fastify backend. It is the technical companion to the product summary in [`context.md`](./context.md) (login and flow routing).

**Primary code locations**

| Area | Path |
|------|------|
| HTTP routes | `backend/src/routes/v1/auth.ts` |
| JWT + cookies (app wiring) | `backend/src/server.ts` |
| Session types and config | `backend/src/auth/types.ts`, `backend/src/auth/config.ts` |
| Route guards | `backend/src/auth/middleware.ts` |
| Mint access + refresh + refresh cookie | `backend/src/auth/issueSession.ts` (`issueSessionWithRefreshCookie`, `buildAuthUserSessionFromUserId`, `buildAuthBusinessSessionFromId`, refresh **`v`**) |
| Auth email (confirm / reset / resend) | `backend/src/auth/requestEmailConfirmation.ts`, `requestPasswordReset.ts`, `confirmEmail.ts`, `resetPassword.ts`, `resendEmailConfirmation.ts`, `authEmailSend.ts`, `authEmailRateLimit.ts`, `emailLinks.ts`, `emailToken.ts`, `emailTemplates.ts`, `verificationIntent*.ts`, `verificationIntentAudit.ts`, `authEmailMetrics.ts` |
| Schedule / “can use employee mode” | `backend/src/auth/canLogAsEmployee.ts` |
| Domain “employee vs customer” at request time | `backend/src/auth/getEffectiveUserRoleAtTime.ts` |
| Tenant (business) credentials | `backend/src/models/business.ts`, `backend/src/routes/v1/business.ts` |
| Person credentials | `backend/src/models/user.ts`, `backend/src/models/personalDetails.ts`, `backend/src/routes/v1/users.ts` |
| ID validation (users routes) | `backend/src/utils/isObjectIdValid.ts` |
| HTTP error helpers | `backend/src/utils/httpError.ts` |
| Business open hours (self-order gating, not login) | `backend/src/business/isBusinessOpenNow.ts` |

API base path: **`/api/v1`**. Auth plugin prefix: **`/auth`** → full paths like `POST /api/v1/auth/login`.

### Frontend (web app) consumption

The Vite/React client mirrors JWT **`type`** and **`id`** into path-based shells (**`/business/:businessId`**, **`/:userId/customer`**, **`/:userId/mode`**, **`/:userId/employee`**), route guards, and post-login redirects. Product-level URL rules and the ordered implementation checklist live in [**`FRONTEND_AUTHENTICATION_AND_NAVIGATION_STRATEGY.md`**](../FRONTEND_AUTHENTICATION_AND_NAVIGATION_STRATEGY.md) and [**`FRONTEND_AUTH_NAVIGATION_IMPLEMENTATION_PLAN.md`**](../FRONTEND_AUTH_NAVIGATION_IMPLEMENTATION_PLAN.md). Session payload shapes match **`backend/src/auth/types.ts`** (`AuthBusiness`, `AuthUser`, union `AuthSession`) — do not maintain a second field table in this doc. **Login/sign-up/mode UI strings** are translated on the client (**English / Spanish**) via **i18next** (`auth`, `mode`, `nav`, …); see [`frontend-i18n.md`](./frontend-i18n.md).

---

## 1. Two kinds of accounts (credential stores)

The product uses **one email + password form** on the client, but the backend stores credentials in **two separate MongoDB collections**:

1. **`Business`** — the restaurant/tenant. Login email is top-level `email`; password is top-level `password` (bcrypt hash in DB).
2. **`User`** — a person. Login email is `personalDetails.email` (stored lowercase per schema); password is `personalDetails.password` (bcrypt hash).

**Login resolution order** (`POST /auth/login`):

1. Normalize email: `toLowerCase()` + `trim()`.
2. **`Business.findOne({ email })`** — if found, verify password with `bcrypt.compare`. On success, issue tokens with `type: "business"`.
3. Else **`User.findOne({ "personalDetails.email": normalizedEmail })`** — verify `personalDetails.password`. On success, issue tokens with `type: "user"` and optionally enrich session with employee fields (see §5).

So the **business record wins** if the same email existed in both (signup and login both try to prevent collisions across the two stores).

**Dummy data** (`backend/dummyData/`):

- `business.json` — e.g. `demo-bistro@restaurantpos.test` / `demoBusinessPassword123` (hashed when imported).
- `users.json` — e.g. `manager@restaurantpos.test`, `waiter@restaurantpos.test` with `employeeDetails` pointing at `Employee` documents.

---

## 2. Password hashing and validation rules

- **bcrypt** cost factor **10** is used for:
  - `auth.ts` (login verification; signup hash)
  - `business.ts` and `users.ts` (create/update with `hash` from `bcrypt`)

**Creation policy (shared):** `packages/utils/passwordPolicy.ts` defines `isValidPassword` and `PASSWORD_POLICY_MESSAGE`. New passwords must be **at least 8 characters** and include **at least one lowercase letter, one uppercase letter, one number, and one symbol** (any non–letter-or-digit character except whitespace).

| Flow | Password rules |
|------|----------------|
| `POST /auth/signup` | Same creation policy as below; email regex in route handler. |
| `POST /auth/login` | No format check — only non-empty email/password. |
| `POST /business` (create tenant) | Creation policy. |
| `PATCH /business/:id` | Creation policy **if** `password` is sent. |
| `POST /users`, `PATCH /users/:id` | Creation policy on create; on patch **if** `password` is sent. |

User documents created via **`/auth/signup`** get placeholder `personalDetails` (default address “Unknown”, auto `idNumber`, etc.) so the Mongoose `personalDetails` schema requirements are satisfied without a multipart admin form.

---

## 3. JWT and cookies (access + refresh)

Configured in `backend/src/auth/config.ts` and `@fastify/jwt` in `server.ts`.

| Item | Value / behavior |
|------|------------------|
| Access token TTL | **15 minutes** (`ACCESS_TOKEN_EXPIRES_IN: "15m"`) |
| Access signing secret | `JWT_SECRET` or fallback `AUTH_SECRET` or dev default |
| Refresh token TTL | **7 days** |
| Refresh signing secret | `REFRESH_SECRET` (separate from access secret) |
| Refresh transport | **HttpOnly cookie** `refresh_token` (`REFRESH_COOKIE_NAME`) |
| Cookie attributes | `path: "/"`, `sameSite: "lax"`, `secure` when `NODE_ENV === "production"`, `maxAge` 7 days |
| Auth mode cookie | `auth_mode` — values `customer` \| `employee` (see §7) |

**Access token** is returned in the **JSON body** (`accessToken`) on login, signup, **`POST /business`** (after create), **`PATCH /business/:id`** (after update, with auth), **`PATCH /users/:id`** (self-service update with auth), and refresh. Clients should send:

```http
Authorization: Bearer <accessToken>
```

**Refresh token** is **not** returned in the body; it is set via `Set-Cookie` on login, signup, business create/update (when tokens are issued), and user self PATCH. `@fastify/cookie` is registered with `secret: REFRESH_SECRET` (used for cookie signing options, distinct from JWT `key` used in `jwt.sign(..., { key: REFRESH_SECRET })` for refresh JWTs).

**Refresh flow** (`POST /auth/refresh`): reads `refresh_token` from cookies, verifies with **refresh secret**, reloads `Business` or `User` from DB, compares **`refreshSessionVersion`** on the document to the refresh JWT claim **`v`** (defaults treated as **0** if absent). On mismatch → cookie cleared + **`401`** (same message as invalid refresh). Otherwise rebuilds full session (including recomputing `canLogAsEmployee` for linked employees) and returns new **access token** in JSON. Invalid signature / expiry → cookie cleared + **`401`**.

**Refresh invalidation:** `User` and `Business` store **`refreshSessionVersion`** (number). Successful **password reset via email link** and **authenticated password change** on **`PATCH /business/:id`** / **`PATCH /users/:id`** increment it so existing refresh cookies stop working.

**Logout** (`POST /auth/logout`): clears `refresh_token` and `auth_mode` cookies (`path: "/"`). Does not invalidate access JWT until expiry (short TTL).

---

## 4. Session payload shapes (`backend/src/auth/types.ts`)

Types are documented to **match legacy NextAuth session shape** for parity with older clients.

### `AuthBusiness`

- `id` — stringified `Business._id`
- `email`
- `type: "business"`
- `emailVerified` — mirrors **`Business.emailVerified`** (drives client banners / resend UX)

### `AuthUser`

- `id` — stringified `User._id`
- `email` — from `personalDetails.email`
- `type: "user"`
- `emailVerified` — mirrors **`User.emailVerified`**
- Optional (only when user is linked to an **active**, **non-terminated** employee):
  - `employeeId` — stringified `User.employeeDetails`
  - `businessId` — from `Employee.businessId`
  - `canLogAsEmployee` — boolean from `canLogAsEmployee()` (§5)

If the user has **no** `employeeDetails`, or employee is inactive/terminated, the session is a plain user with no `employeeId` / `businessId` / `canLogAsEmployee`.

### `RefreshTokenPayload`

`{ id, type, v? }` — **`id`** and **`type`** reload the account; **`v`** is the **`refreshSessionVersion`** snapshot at issue time. Refresh rejects when **`(payload.v ?? 0) !==`** current DB version.

---

## 5. `canLogAsEmployee` (schedule gate for “employee mode”)

**File:** `backend/src/auth/canLogAsEmployee.ts`

This answers: *“Is this employee allowed to authenticate into **employee** context right now?”* (used when building JWT/session and when setting `auth_mode` to `employee`).

Rules:

1. Load `Employee` by id. If missing, `active !== true`, or `terminatedDate` is set → **`false`**.
2. If `allEmployeeRoles` intersects **`managementRolesEnums`** → **`true`** (schedule bypass for management).
3. Otherwise load **today’s** `Schedule` for `employee.businessId` (calendar day window).
4. Find this employee in `employeesSchedules`, skip `vacation: true` entries.
5. For a matching shift, allow if current time ∈ **`[shiftStart - 5 minutes, shiftEnd]`** (constant `FIVE_MINUTES_MS`).

**Not** included here: `Employee.onDuty`. That flag is used by **`getEffectiveUserRoleAtTime`** (§6), not by `canLogAsEmployee` alone.

---

## 6. `getEffectiveUserRoleAtTime` (domain operations)

**File:** `backend/src/auth/getEffectiveUserRoleAtTime.ts`

Used by operational routes (e.g. sales instances, orders) to decide **`"employee"` vs `"customer"`** for a **userId + businessId** at a point in time:

1. No `User.employeeDetails` → **`customer`**
2. Load `Employee`; if `onDuty !== true` → **`customer`**
3. If `Employee.businessId` ≠ requested `businessId` → **`customer`**
4. Else `scheduleAllowed = canLogAsEmployee(employeeId, now, session)`
5. Return **`employee`** only if `scheduleAllowed === true`; else **`customer`**

So **JWT `canLogAsEmployee`** (schedule + management bypass) and **onDuty** together define whether POS treats the user as staff for that business. This is stricter than “has employee link on the token.”

**Related (not login):** `backend/src/business/isBusinessOpenNow.ts` gates **customer self-order** by `businessOpeningHours`; it does not affect credential checks.

---

## 7. Customer vs employee **mode** cookie (`auth_mode`)

Endpoints in `auth.ts`:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/auth/set-mode` | Body `{ mode: "customer" \| "employee" }`. Requires `Authorization: Bearer` access token. Only `type === "user"`. If `mode === "employee"`, requires `session.canLogAsEmployee === true`; else **403**. Sets httpOnly `auth_mode` cookie. |
| `GET` | `/auth/mode` | Returns `{ mode }` from cookie, default **`customer`** if absent. |

**Business** sessions cannot set mode (`400`).

The access JWT **does not** embed `mode`; mode is **cookie-only** for the client + backend to agree on UI/routing. Domain code should still use **`getEffectiveUserRoleAtTime`** where on-duty matters.

---

## 8. Auth HTTP API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/signup` | None | Create **User** (customer path). Conflicts if email exists on Business or User. Returns `201` + `accessToken` + `user`; sets refresh cookie. **Non-blocking:** may enqueue **email confirmation** (see [`auth-email-security-flows.md`](./auth-email-security-flows.md)). |
| `POST` | `/auth/login` | None | Business-first, then User. Returns `accessToken` + `user`; sets refresh cookie. |
| `POST` | `/auth/refresh` | Cookie `refresh_token` | New access token + rebuilt `user`. |
| `POST` | `/auth/logout` | None | Clears refresh + `auth_mode` cookies. |
| `GET` | `/auth/me` | Bearer access | Returns `{ user: session }` from JWT. |
| `POST` | `/auth/set-mode` | Bearer access | Sets `auth_mode` cookie (users only). |
| `GET` | `/auth/mode` | Cookie optional | Reads `auth_mode`. |
| `POST` | `/auth/request-email-confirmation` | None | Body `{ email }`. **Anti-enumeration:** always **`200`** + generic message when validation passes; sends only if account exists and is unverified (subject to per-email rate cap). |
| `POST` | `/auth/request-password-reset` | None | Same response shape; issues **reset** email when applicable. |
| `POST` | `/auth/confirm-email` | None | Body `{ token }` (opaque link token). One-time verify. |
| `POST` | `/auth/reset-password` | None | Body `{ token, newPassword }`. Clears reset token; **increments** `refreshSessionVersion`. |
| `POST` | `/auth/resend-email-confirmation` | Bearer | Resend for **session** account’s DB email; **IP** rate limit may return **`429`**. |

**Common errors:** `400` validation, `401` invalid credentials / missing token / bad refresh (including **refresh version mismatch**), `403` employee mode not allowed, `409` signup conflict, `429` auth-email **IP** rate limit.

---

## 9. Route middleware (`backend/src/auth/middleware.ts`)

Hooks attach decoded JWT to **`req.authSession`** (`AuthSession`).

| Hook | Behavior |
|------|----------|
| `createAuthHook` | Requires `Authorization: Bearer`; verifies access JWT; sets `req.authSession`. |
| `createOptionalAuthHook` | Same if header present; invalid token ignored (no session). |
| `requireBusinessHook` | After auth: `authSession.type === "business"`. |
| `requireManagementHook` | After auth: **business** passes. For **user**, requires `canLogAsEmployee === true` (same flag as schedule/management gate — **not** a separate “is manager” check in this hook). |
| `requireEmployeeHook` | After auth: **user** with `employeeId` and `canLogAsEmployee`. |
| `requireValidObjectIdParamHook("businessId" \| "userId")` | Before auth: **400** if the path param is not a valid ObjectId (used on PATCH business / PATCH user). |
| `requireBusinessIdMatchesSessionHook` | After auth: **`type === "business"`** and **`authSession.id`** equals **`:businessId`**. |
| `requireUserIdMatchesSessionHook` | After auth: **`type === "user"`** and **`authSession.id`** equals **`:userId`**. |

Helpers:

- **`hasBusinessAccess(session, businessId)`** — business id match, or user with `businessId` match and `canLogAsEmployee`.
- **`getSessionBusinessId(session)`** — business’s own id, or user’s `businessId`.

Individual route modules may apply additional checks (e.g. manager-only actions inside employees or daily reports).

---

## 10. Business lifecycle vs auth (`business.ts`)

Session minting uses **`issueSessionWithRefreshCookie`** from `issueSession.ts` (same shape as **`/auth/login`** for `type: "business"`).

- **`POST /business`** — Multipart form. Validates email/password, address, enums, duplicates. After create: **`201`** with `message`, **`accessToken`**, **`user`** (`type: "business"`), and **refresh cookie** set — no separate login call required. **Non-blocking:** may enqueue **email confirmation** for the new tenant (see [`auth-email-security-flows.md`](./auth-email-security-flows.md)).
- **`GET /business`** — Unauthenticated listing/discovery; **`password` excluded**.
- **`GET /business/:businessId`** — Unauthenticated; no password in response.
- **`PATCH /business/:businessId`** — **`preValidation`:** valid `:businessId`, **`Authorization: Bearer`**, session must be **business** and **`session.id === :businessId`**. Updates fields; optional password change. When sending a **new `password`**, multipart field **`currentPassword`** must match the stored hash (**`400`** if missing, **`401`** if wrong). Successful password change **increments** **`refreshSessionVersion`** (invalidates prior refresh cookies). The split settings shell validates the bound form on **Save** with Zod; **`email`** / **`confirmEmail`** use the same **`emailRegex`** as server-side checks on this route (**`packages/utils/emailRegex.ts`**). Response **`200`:** `message`, fresh **`accessToken`**, **`user`** (current email from DB), and **refresh cookie** re-set.
  - **Communications (non-blocking):** when the persistence layer actually changes at least one field, the route emits **`BUSINESS_PROFILE_UPDATED`** through `dispatchEvent` (fail-soft: profile save still returns **`200`** if dispatch fails). Optional request headers **`X-Correlation-Id`** and **`X-Idempotency-Key`** are forwarded into dispatch for tracing and process-local idempotency. Management employees receive **in-app** notifications and **email** (if channels enabled) per `backend/src/communications/README.md`. The main profile editor is **`BusinessProfileSettingsPage`** (**`/business/:businessId/settings/profile`**); **postal address** (and map preview) is **`/business/:businessId/settings/address`** — both use multipart **`PATCH`** via the split settings form shell. **Tenant password change** in the web app is **`BusinessCredentialsSettingsPage`** (**`/settings/credentials`**) → **`POST /auth/request-password-reset`** → link to **`/reset-password`** (not inline **`PATCH`** password fields). Optional **`password`** + **`currentPassword`** on **`PATCH /business/:id`** remain for API clients. See **`documentation/context.md`** and **`documentation/auth-email-security-flows.md`**.
- **`DELETE /business/:businessId`** — Still unauthenticated in the current code (transactional cascade + Cloudinary); tighten with auth in a follow-up if needed.

---

## 11. User CRUD vs auth (`users.ts`)

**Different from `/auth/signup`:**

| Aspect | `/auth/signup` | `POST /users` |
|--------|----------------|---------------|
| Content-Type | JSON | **Multipart** form-data |
| Profile | Minimal placeholders | Full required profile + optional image |
| Response | `accessToken` + session | Message only — **no tokens** (admin provisioning; user signs in via **`/auth/login`** or future invite flow) |
| Typical use | Self-service customer registration | Admin/onboarding tooling |

**`PATCH /users/:userId`** — **Self only:** `preValidation` requires valid `userId`, **`Authorization: Bearer`**, and **`session.type === "user"`** with **`session.id === :userId`**. On success: **`200`** with `message`, fresh **`accessToken`**, **`user`** (rebuilt with `canLogAsEmployee` from DB), and **refresh cookie** re-set. If **`password`** was updated, **`refreshSessionVersion`** is incremented server-side.

**Security note:** `GET` / `POST` / `DELETE` on `users` remain without `createAuthHook` in the current code; deployment should limit exposure as appropriate.

**Read paths** strip passwords: projection `{ "personalDetails.password": 0 }`.

**Delete** (`DELETE /users/:userId`): If `Employee.findOne({ userId })` returns a document **with** `terminatedDate` set, delete is rejected (`400`). Otherwise the user document is removed (note: **active** employees without `terminatedDate` are not blocked by this check—verify intended product rules if tightening).

---

## 12. Utils used by user (and related) routes

### `isObjectIdValid` (`backend/src/utils/isObjectIdValid.ts`)

Returns true only if **every** id in the array is a valid `ObjectId` string. Used for `userId`, `notificationId`, etc., on users routes.

### `httpError` (`backend/src/utils/httpError.ts`)

`toHttpError`, `badRequest`, `unauthorized`, `forbidden`, `notFound` — used by the **global Fastify error handler** in `server.ts` to normalize error responses. Auth routes generally use `reply.code().send({ message })` directly.

---

## 13. End-to-end mental model (user level)

1. **Restaurant signs up** as a **Business** (multipart) → receives **tokens immediately** (`type: "business"`) → admin UI; **`PATCH`** updates require the **business** Bearer token for the same `businessId`.
2. **People** are created as **User** (admin multipart) or **self-signup** (JSON `/auth/signup`) → `type: "user"`.
3. **Staff** users get `employeeDetails` set (via employees API / transactions) → login adds `employeeId`, `businessId`, `canLogAsEmployee` to JWT when employee is active.
4. Client shows **mode selection** when `canLogAsEmployee` is true; choosing **employee** calls **`POST /auth/set-mode`** → `auth_mode` cookie.
5. **Short access token** + **refresh cookie** keep sessions alive; **`/auth/refresh`** refreshes claims (e.g. schedule window elapsed → `canLogAsEmployee` becomes false on next refresh).
6. **POS actions** use Bearer token + **`getEffectiveUserRoleAtTime`** (and business rules) so “employee on JWT” is not enough without **on duty** + schedule/management rules.

---

## 14. Environment variables (auth-related)

| Variable | Role |
|----------|------|
| `JWT_SECRET` / `AUTH_SECRET` | Access token signing |
| `REFRESH_SECRET` | Refresh JWT signing; cookie plugin secret |
| `NODE_ENV` | `production` → `secure` cookies |
| Auth email / SMTP / rate limits | See **`backend/README.md`** (Auth email env table) and [`auth-email-security-flows.md`](./auth-email-security-flows.md) §10–11 |

`server.ts` calls `validateEnv()` so missing secrets fail fast at startup (after defaults from `AUTH_CONFIG` — production should override dev defaults).

---

## 15. Related documentation

- **Email confirmation, password reset, rate limits, audit/metrics:** [`auth-email-security-flows.md`](./auth-email-security-flows.md).
- Product-level login and routing: [`context.md`](./context.md) → **Login and flow routing**, **People and operations**.
- Operational employee vs customer at the table: [`sales-point-sales-instance-orders.md`](./sales-point-sales-instance-orders.md) (references `getEffectiveUserRoleAtTime`).
- User journey narrative: [`user-flow.md`](./user-flow.md).
