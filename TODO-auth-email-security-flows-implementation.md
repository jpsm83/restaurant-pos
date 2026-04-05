# Auth Email Security Flows Implementation Plan

## Goal

Implement secure email-driven verification flows in this app (Fastify backend + React frontend) so critical account actions are confirmed through inbox links/tokens, including:

1. Email confirmation
2. Forgot password (request reset email)
3. Reset password (via secure token link)
4. Foundation for future security-sensitive actions (email change confirmation, high-risk action confirmation)

This plan is based on the reference logic in `_emailSending/` and adapted to this codebase architecture.

---

## Current state summary (this repository)

- Backend already has auth session endpoints in `backend/src/routes/v1/auth.ts`:
  - `POST /api/v1/auth/signup`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me`
  - `POST /api/v1/auth/set-mode`, `GET /api/v1/auth/mode`
- Frontend already has `LoginPage` and `SignUpPage` wired through `frontend/src/auth/api.ts`.
- SMTP infrastructure already exists in communications:
  - `backend/src/communications/providers/smtpProvider.ts`
  - `backend/src/communications/channels/emailChannel.ts`
- Missing today:
  - No email-confirmation token fields on account models
  - No forgot/reset-password token flow endpoints
  - No public confirm-email/reset-password routes in frontend
  - No standardized auth-email template/link-generation module

---

## Scope lock (do before coding)

**Status: executed (locked for implementation).** Detailed rationale and numbers live under **Phase 0 deliverable** below.

- [x] Decide actor scope for V1:
  - [ ] `user` only first
  - [x] both `user` + `business` in same release
- [x] Decide policy for login with unverified email:
  - [x] allow login but show banner + restricted sensitive actions
  - [ ] block login until email confirmed
- [x] Decide token storage approach:
  - [ ] plain random token in DB (faster implementation, weaker DB-leak posture)
  - [x] hashed token in DB (recommended)
- [x] Decide confirmation token expiry:
  - [x] enforce expiry (recommended)
  - [ ] no expiry (not recommended)
- [x] Decide link base URL strategy:
  - [x] single primary `APP_BASE_URL` env **plus** ordered fallbacks when unset (see locked table)
- [x] Decide if credential changes on business settings must be email-confirmed in V1 or V2.

### Locked product decisions (summary)

| Topic | Decision |
|--------|-----------|
| **V1 actors** | **`user` and `business` in the same release.** Both authenticate with email/password today (`POST /auth/login` checks `Business` then `User`). Forgot/reset and email confirmation apply to both account types so behavior stays consistent. |
| **Login while unverified** | **Allow login** (no change to `POST /auth/login` success path in V1). **Frontend:** after auth, if `emailVerified === false`, show a dismissible banner + CTA to resend confirmation. **Backend:** optional follow-up to return `emailVerified` on session/`/me` once the field exists. **Do not** block login in V1 (avoids locking out existing rows before backfill/migration). |
| **Token storage** | **Hashed only in MongoDB.** Opaque token sent by email is **never** stored plaintext. Persist **`SHA-256`** hex digest of `rawToken + AUTH_EMAIL_TOKEN_PEPPER` (pepper optional but recommended in production). Lookup: hash incoming token and query by hash. |
| **Confirmation TTL** | **24 hours** from issuance (`emailVerificationExpiresAt`). Email copy must match this TTL. |
| **Reset TTL** | **60 minutes** from issuance (`passwordResetExpiresAt`). |
| **Base URL for links** | **Primary:** `APP_BASE_URL` (backend env), trimmed, no trailing slash. **Fallback chain** when unset (dev ergonomics): `PUBLIC_APP_URL` → `FRONTEND_URL` → `VITE_APP_BASE_URL` (if present in server env) → reject send with clear log (do not guess production host). |
| **Business credentials / PATCH** | **V2.** Tenant credential changes stay as today (**current password** on `BusinessCredentialsSettingsPage`). No extra “confirm via email” gate in V1. |

---

## Architecture mapping from reference app

Reference app uses Next.js API routes + server actions. This repo should use:

- Fastify routes in `backend/src/routes/v1/auth.ts` (or split file if needed)
- Service layer modules under `backend/src/auth/` and/or `backend/src/services/`
- Existing SMTP provider/channel in communications module
- React Router pages in `frontend/src/pages/*`
- Frontend auth client extension in `frontend/src/auth/api.ts`
- Shared validation from `packages/utils/emailRegex.ts` and `packages/utils/passwordPolicy.ts`

Do not copy Next.js-specific patterns (server actions, app router files) directly.

---

## Mandatory testing rule (all new code)

**Every source file introduced or materially changed for this feature must have automated tests that prove it behaves correctly.** Do not merge routes, services, helpers, templates, or UI without tests.

- **Backend:** For each new module (e.g. `emailToken.ts`, `emailLinks.ts`, `emailTemplates.ts`, `emailSecurityService.ts`, rate-limit helper), add or extend **Vitest** tests beside or under `backend/tests/` (unit tests for pure helpers; `app.inject` route tests for HTTP). Mock SMTP / `emailChannel` where real send is not desired.
- **Frontend:** For each new page, hook, or auth client function, add or extend **Vitest + Testing Library** tests (same patterns as `LoginPage.test.tsx`, `SignUpPage.test.tsx`).
- **Shared packages:** If anything is added under `packages/` for this feature, add matching `*.test.ts` in that package or in the consumer test suite.
- **Definition:** A PR is incomplete if it adds a file with no test file or no new cases in an existing test file that exercise the new behavior.
- **Gate:** Before closing a phase or task, run the relevant test commands (`npm --prefix backend test`, `npm --prefix frontend test` or focused file paths) and ensure they pass.

This matches the execution standard used in `TODO-business-profile-implementation.md` (tests required for new work, not optional follow-up).

---

## Dependencies and libraries

**Status: executed (verified / locked).**

### Existing (reuse)

- [x] `nodemailer` already present via communications module (declared in `backend/package.json`, used by `backend/src/communications/providers/smtpProvider.ts`)
- [x] `bcrypt` already present for password hashing
- [x] Node `crypto` (built-in) for secure token generation
- [x] Existing password policy (`packages/utils/passwordPolicy.ts`)
- [x] Existing email regex (`packages/utils/emailRegex.ts`)

### New packages

- [x] No mandatory new package for MVP
- [x] Optional later: dedicated HTML template engine (only if inline templates become hard to maintain)

---

## Execution plan

### Phase 0 - Contracts and threat-model lock

**Status: executed.**

- [x] Define endpoint contracts and response semantics (success/error payloads, status codes).
- [x] Lock anti-enumeration behavior:
  - [x] request-confirmation and request-reset return generic success for unknown emails.
- [x] Lock token lifetimes:
  - [x] confirmation token TTL
  - [x] reset token TTL (e.g. 60 min)
- [x] Lock replay behavior:
  - [x] one-time use tokens
  - [x] invalidate old token on new request
- [x] Lock rate limiting and abuse protection strategy:
  - [x] per IP
  - [x] per email
  - [x] per endpoint

#### Phase 0 deliverable — API & threat model (locked)

**Base path:** all routes below are under **`/api/v1/auth`** (same prefix as existing auth routes).

| Method | Path | Body (JSON) | Success | Client errors | Server errors |
|--------|------|-------------|---------|----------------|---------------|
| `POST` | `/request-email-confirmation` | `{ "email": string }` | **200** + body below | **400** invalid/missing email format | **500** only if configured account exists, token was written, and **email send failed** after rollback attempt (same generic message as below) |
| `POST` | `/confirm-email` | `{ "token": string }` | **200** `{ "message": string }` | **400** missing token, invalid/expired/already-used token, already verified | **500** unexpected |
| `POST` | `/request-password-reset` | `{ "email": string }` | **200** + body below | **400** invalid/missing email format | **500** same pattern as confirmation when send fails after token write |
| `POST` | `/reset-password` | `{ "token": string, "newPassword": string }` | **200** `{ "message": string }` | **400** missing fields, weak password (`PASSWORD_POLICY_MESSAGE`), invalid/expired token | **500** unexpected |

**Anti-enumeration (request-email-confirmation & request-password-reset):**

- Normalize email (trim + lowercase) before any logic.
- If email **fails format validation** → **400** with a single message, e.g. `"Please provide a valid email address"` (reuse existing auth style where possible).
- If format is valid and **no account exists** for that email → **200** with the **same** generic payload as the success case (see below).
- If account exists and is in a state where **no email should be sent** (e.g. already verified for confirmation-only resend — see nuance): still return **200** + generic payload for **request-email-confirmation** when the goal is “do not reveal account state.” **Exception (optional clarity):** `request-email-confirmation` may return **400** `"Email is already verified"` **only** if product accepts slight enumeration; **locked choice: prefer 200 generic** for confirmation request to match reset semantics.
- Generic success body (locked):

```json
{
  "message": "If an account exists for this email, you will receive instructions shortly."
}
```

**Token lifetimes (locked):**

- Email confirmation: **24 hours** (`86400000` ms).
- Password reset: **60 minutes** (`3600000` ms).

**Replay & invalidation (locked):**

- Tokens are **one-time use**: successful `confirm-email` or `reset-password` clears the corresponding token fields and expiry.
- Issuing a **new** confirmation or reset token **replaces** the previous hash + expiry on that account (old links die).

**Rate limiting & abuse (locked):**

- **Per IP** (separate buckets per route: `request-email-confirmation` vs `request-password-reset`): default **30 requests / 15 minutes**. Exceed → **429** `{ "message": "Too many requests. Please try again later." }` (generic).
- **Per normalized email** (combined sends for confirmation + reset): default **5 emails / hour** per email. Exceed → **200** + generic success body above but **do not send** and **do not** rotate token (silent throttle; avoids leaking activity to third parties).
- Implementation note: use in-memory counters in V1 keyed by IP and email (process-local; document multi-instance limitation) or introduce Redis later; **document** in Phase 8 if staying in-memory.

**confirm-email / reset-password errors:**

- Do **not** distinguish “wrong token” vs “expired” in the JSON message if product wants minimal oracle; **locked:** single user-facing message for all consumption failures, e.g. `"This link is invalid or has expired. Please request a new one."` with **400**.

**Security notes (locked):**

- Log **never** include raw tokens or hashes in full; log only correlation id / account id / outcome.
- `reset-password` must validate `newPassword` with **`isValidPassword`** from `packages/utils/passwordPolicy.ts` (aligned with signup).

**Environment variables introduced in Phase 1–3 (reference list):**

- `APP_BASE_URL` — required in production for correct email links; fallbacks listed in scope lock.
- `AUTH_EMAIL_TOKEN_PEPPER` — optional string; if set, appended in HMAC/sha256 input material.
- `AUTH_EMAIL_RATE_LIMIT_IP_MAX` — default `30`
- `AUTH_EMAIL_RATE_LIMIT_IP_WINDOW_MS` — default `900000` (15 min)
- `AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX` — default `5`
- `AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS` — default `3600000` (1 hour)

Deliverable: this subsection is the contract gate — **implementation may proceed from Phase 1 onward.**

---

### Phase 1 - Data model extensions

- [x] Extend account models with verification/reset fields.

#### 1.1 User model

- [x] Add fields to user auth data (choose final location after schema review):
  - [x] `emailVerified` (boolean, default false)
  - [x] `emailVerificationTokenHash` (or plain token if non-hash approach)
  - [x] `emailVerificationExpiresAt`
  - [x] `passwordResetTokenHash`
  - [x] `passwordResetExpiresAt`

Target files (likely):

- `backend/src/models/user.ts` — **done** (top-level fields on `User`, tied to sign-in email `personalDetails.email`)
- `backend/src/models/personalDetails.ts` — **not used** for tokens (keeps profile vs auth-lifecycle separation)

Tests: `backend/tests/models/userEmailSecuritySchema.test.ts`

#### 1.2 Business model (if included in V1)

- [x] Mirror equivalent verification/reset fields for `Business` account email/password flows.

Target file:

- `backend/src/models/business.ts` — **done** (same five fields as `User`, tied to tenant `email`)
- `packages/interfaces/IBusiness.ts` — **done**; `IBusinessProfileDto` omits token hashes and expiry fields but keeps `emailVerified` for UI
- `backend/src/routes/v1/business.ts` — **done** — public GET/list `.select` extended so token secrets are never returned

Tests: `backend/tests/models/businessEmailSecuritySchema.test.ts`

#### 1.3 Indexing

- [x] Add indexes for token lookup fields with performance in mind.
- [x] Ensure token fields are nullable and easy to clear atomically. (Fields remain optional; `$unset` / `undefined` clears; covered by existing schema tests.)

**Implemented:** sparse single-field indexes on `emailVerificationTokenHash` and `passwordResetTokenHash` for both `User` and `Business` (`backend/src/models/user.ts`, `backend/src/models/business.ts`).

Tests: `backend/tests/models/authEmailSecurityIndexes.test.ts` (`syncIndexes` + assert `sparse: true` on both collections).

---

### Phase 2 - Shared auth-email service layer (backend)

- [x] Create a dedicated service module for auth-email flows. **Primitives:** `emailToken.ts`, `emailLinks.ts`, `emailTemplates.ts`, `authEmailSend.ts`. **Orchestration** (`emailSecurityService.ts` / route handlers) follows in Phase 3.

Suggested new files:

- `backend/src/auth/emailSecurityService.ts`
- `backend/src/auth/emailToken.ts` (token generation/hash helpers)
- `backend/src/auth/emailLinks.ts` (safe URL builder)
- `backend/src/auth/emailTemplates.ts` (confirmation/reset templates)

#### 2.1 Token helpers

- [x] Generate opaque token with `crypto.randomBytes`.
- [x] Hash token before persistence (recommended).
- [x] Constant-time compare approach (or query by hash only). **Locked:** compare path is **DB lookup by `hashEmailToken(raw)`** only (no plaintext token stored).
- [x] Include expiry checks.

**Implemented:** `backend/src/auth/emailToken.ts` — `generateRawEmailToken`, `hashEmailToken` (SHA-256 + optional `AUTH_EMAIL_TOKEN_PEPPER`), TTL readers (`AUTH_EMAIL_CONFIRM_TTL_MS`, `AUTH_RESET_TTL_MS` with defaults), `compute*Expiry`, `isAuthTokenExpired`.

Tests: `backend/tests/auth/emailToken.test.ts`

#### 2.2 URL generation

- [x] Build links like:
  - [x] `.../confirm-email?token=...`
  - [x] `.../reset-password?token=...`
- [x] Keep locale support optional in V1 (can add in V2; current app is not locale-prefixed routes).
- [x] Validate that generated URL host is from trusted config/env.

**Implemented:** `backend/src/auth/emailLinks.ts` — `normalizeAppBaseUrl` (http/https only, hostname required), `resolveAppBaseUrl` (env chain `APP_BASE_URL` → `PUBLIC_APP_URL` → `FRONTEND_URL` → `VITE_APP_BASE_URL`), `buildConfirmEmailLink` / `buildResetPasswordLink` via `URL` + `URLSearchParams` (supports path-prefixed bases).

Tests: `backend/tests/auth/emailLinks.test.ts`

#### 2.3 Email template composition

- [x] Add confirmation email template (HTML + plain text).
- [x] Add reset password email template (HTML + plain text).
- [x] Reuse app brand and neutral, security-focused copy.
- [x] Include fallback plain link.
- [x] Include expiry info matching server-enforced TTL.

**Implemented:** `backend/src/auth/emailTemplates.ts` — `buildEmailConfirmationContent`, `buildPasswordResetEmailContent` (subject + HTML + text); `formatAuthEmailTtlPhrase` driven by `getEmailVerificationTtlMs` / `getPasswordResetTtlMs`; brand from **`AUTH_EMAIL_BRAND_NAME`** or default **Restaurant POS**; optional **`greetingName`** (HTML-escaped).

Tests: `backend/tests/auth/emailTemplates.test.ts`

#### 2.4 Send wrapper

- [x] Integrate with existing `emailChannel`/SMTP provider instead of creating a parallel sender.
- [x] Define behavior on send failure:
  - [x] rollback newly issued tokens when send fails.

**Implemented:** `backend/src/auth/authEmailSend.ts` — `sendAuthTransactionalEmail` (delegates to `emailChannel.send` with `fireAndForget: true`, throws if `success` is false); `sendAuthTransactionalEmailWithRollback` runs `rollback()` once then rethrows. Token persistence/rollback bodies stay in route/service callers (Phase 3).

Tests: `backend/tests/auth/authEmailSend.test.ts` (mocked `emailChannel`)

---

### Phase 3 - Backend auth endpoints

Implement these new routes under `/api/v1/auth`:

- [x] `POST /request-email-confirmation`
- [x] `POST /confirm-email`
- [x] `POST /request-password-reset`
- [x] `POST /reset-password`

Target file:

- `backend/src/routes/v1/auth.ts` (or split into `authEmail.ts` and register from v1 index)

#### 3.1 Request email confirmation

- [x] Validate input email with shared regex.
- [x] Return generic success when account not found.
- [x] If already verified:
  - [x] choose policy (return informative 400 vs generic success).
- [x] Issue token + expiry, persist, send email.
- [x] On send failure, clear token and return failure.

**Implemented:** `backend/src/auth/authEmailRateLimit.ts` (per-IP + combined per-email send cap), `backend/src/auth/requestEmailConfirmation.ts` (orchestration), `POST /api/v1/auth/request-email-confirmation` in `backend/src/routes/v1/auth.ts`. **Policy:** already verified and unknown email → **200** with the same generic message (no enumeration). **Tests:** `backend/tests/auth/authEmailRateLimit.test.ts`, `backend/tests/routes/requestEmailConfirmation.test.ts`. **Harness:** `backend/tests/setup.ts` lazy-loads `buildApp` so `vi.mock` applies; mocked route tests call `resetTestApp` in `beforeAll`/`afterAll` and default `APP_BASE_URL` when unset.

#### 3.2 Confirm email

- [x] Validate token presence.
- [x] Verify token + expiry.
- [x] Mark `emailVerified = true`.
- [x] Clear token fields.
- [x] Return success message.

**Implemented:** `backend/src/auth/confirmEmail.ts` (`handleConfirmEmail`, shared messages), `POST /api/v1/auth/confirm-email` in `backend/src/routes/v1/auth.ts`. **Semantics:** hash incoming token, atomic `findOneAndUpdate` on **Business** then **User** with `emailVerificationExpiresAt > now`, `emailVerified != true`; success clears verification token fields. **400** missing token vs Phase 0 consumption message for all other client failures. **Tests:** `backend/tests/auth/confirmEmail.test.ts`, `backend/tests/routes/confirmEmail.test.ts`.

#### 3.3 Request password reset

- [x] Validate input email.
- [x] Return generic success when not found.
- [x] Issue reset token + expiry.
- [x] Send reset email.
- [x] Rollback token on send failure.

**Implemented:** `backend/src/auth/requestPasswordReset.ts` (`handleRequestPasswordReset`), `POST /api/v1/auth/request-password-reset` in `backend/src/routes/v1/auth.ts`. Reuses email validation + **same generic 200 body** as confirmation request (`GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE`). **Per-IP** bucket `request-password-reset`; **per-email send cap** is **per verification intent** (Phase 6: `tryConsumeVerificationIntentEmailSlot`), separate from email confirmation. **Tests:** `backend/tests/routes/requestPasswordReset.test.ts`.

#### 3.4 Reset password

- [x] Validate token + `newPassword`.
- [x] Enforce `isValidPassword`.
- [x] Find token + expiry-valid account.
- [x] Hash and save new password.
- [x] Clear reset token fields.
- [x] Invalidate existing refresh sessions — `refreshSessionVersion` on **User** / **Business** (default `0`); embedded as **`v`** on refresh JWT; `POST /auth/refresh` rejects when `v` ≠ DB; **`$inc`** on email reset and on authenticated password change (`PATCH` business / user).

**Implemented:** `backend/src/auth/resetPassword.ts` (`handleResetPassword`, input validators, messages), `POST /api/v1/auth/reset-password` in `backend/src/routes/v1/auth.ts`. **400** missing token / missing new password / `PASSWORD_POLICY_MESSAGE` / same consumption copy as confirm-email (`CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE`) for bad token. **Atomic** `findOneAndUpdate`: **Business** then **User**, `passwordResetExpiresAt > now`, bcrypt cost **10**. **Tests:** `backend/tests/auth/resetPassword.test.ts`, `backend/tests/routes/resetPassword.test.ts`. **Refresh invalidation:** `issueSession.ts` (`readRefreshSessionVersionForAccount`, `refreshTokenPayloadVersionMatchesDb`), login/signup/business register/PATCH + user PATCH issue cookies with current version.

---

### Phase 4 - Trigger integration into existing flows

#### 4.1 Signup trigger

- [x] After `POST /auth/signup` success, trigger confirmation email issuance for that account.
- [x] Decide whether signup response remains logged-in immediate session (current behavior) or changes.

**Implemented:** `POST /api/v1/auth/signup` in `backend/src/routes/v1/auth.ts` calls `handleRequestEmailConfirmation(normalizedEmail)` **after** `issueSessionWithRefreshCookie` (fire-and-forget promise chain). **Response unchanged:** **201** + access token + user session immediately; email work does not block the HTTP response. Send failures log `signup_confirmation_send` and use existing rollback (no impact on signup success). **Tests:** `backend/tests/routes/authSignupConfirmation.test.ts` (mocked `authEmailSend`).

Target file:

- `backend/src/routes/v1/auth.ts`

#### 4.2 Business registration trigger (if in scope)

- [x] Add confirmation trigger after business account creation route succeeds.

Potential target:

- `backend/src/routes/v1/business.ts`

**Implemented:** `POST /api/v1/business` (multipart create) in `backend/src/routes/v1/business.ts` calls `handleRequestEmailConfirmation(registrationEmail)` after `issueSessionWithRefreshCookie`, **non-blocking** (same pattern as signup). **Sign-in email** is stored as `normalizeRequestEmail(email)` for duplicate check, persistence, session payload, and confirmation lookup. Failures log `business_registration_confirmation_send`. **Tests:** `backend/tests/routes/businessRegistrationConfirmation.test.ts`.

#### 4.3 Resend confirmation

- [x] Provide UI/API path to resend confirmation email from authenticated account settings.
- [x] Ensure rate limits and anti-spam guardrails.

**Implemented:** `POST /api/v1/auth/resend-email-confirmation` in `backend/src/routes/v1/auth.ts` (Bearer JWT, `checkAuthEmailIpRate("resend-email-confirmation", …)` → **429**, handler `handleResendEmailConfirmationForAuthenticatedAccount` in `backend/src/auth/resendEmailConfirmation.ts` reuses `handleRequestEmailConfirmation` / per-email send slot). **200** success or already verified; **401** missing/invalid token or account not found; **500** send failure. Session payloads include `emailVerified` from `issueSession.ts`, login/signup in `auth.ts`, business create/update in `business.ts`. **Frontend:** `resendEmailConfirmation()` in `frontend/src/auth/api.ts`, banner on `BusinessCredentialsSettingsPage` (profile `emailVerified === false`) and `CustomerProfilePage` (session `emailVerified === false`), i18n `en`/`es`. **Tests:** `backend/tests/routes/resendEmailConfirmation.test.ts`, `authEmailRateLimit` bucket for `resend-email-confirmation`.

---

### Phase 5 - Frontend pages and API wiring

#### 5.1 Extend auth API client

- [x] Add methods in `frontend/src/auth/api.ts`:
  - [x] `requestEmailConfirmation(email)`
  - [x] `confirmEmail(token)`
  - [x] `requestPasswordReset(email)`
  - [x] `resetPassword(token, newPassword)`

**Implemented:** `frontend/src/auth/api.ts` — all four use `POST` to `/api/v1/auth/*` with JSON bodies matching the backend (`email`, `token`, `token`+`newPassword`), `authRequest(..., false)` (no refresh retry). Shared `AuthMessageResponseBody` for `{ message? }` responses; **400**/**429**/**500** surface via `ok: false` + `error` string.

#### 5.2 Add pages

- [x] `frontend/src/pages/ForgotPasswordPage.tsx`
- [x] `frontend/src/pages/ResetPasswordPage.tsx`
- [x] `frontend/src/pages/ConfirmEmailPage.tsx`

Page behavior:

- [x] forgot page: single email field, generic success UX
- [x] reset page: token from query string, password + confirm, policy validation
- [x] confirm page: token from query string, success/error state display

**Implemented:** Card layout aligned with `LoginPage` / `SignUpPage`. **Forgot:** `requestPasswordReset` + anti-enumeration success copy (i18n). **Reset:** `?token=` via `useSearchParams`, Zod + `isValidPassword` (same as signup), `resetPassword`. **Confirm:** `?token=`, explicit confirm button (avoids StrictMode double-submit on one-time tokens), `confirmEmail`. Strings in `frontend/src/i18n/locales/en|es/auth.json`.

#### 5.3 Route registration

- [x] Add public routes to `frontend/src/appRoutes.tsx`:
  - [x] `/forgot-password`
  - [x] `/reset-password`
  - [x] `/confirm-email`

**Implemented:** Under `PublicLayout` (`path="/"`). **`/forgot-password`** uses `PublicOnlyRoute` (same as login). **`/reset-password`** and **`/confirm-email`** are **not** wrapped in `PublicOnlyRoute` so magic-link flows work if the user already has a session. Lazy-loaded pages match backend email link paths (`emailLinks.ts`).

#### 5.4 Auth page links

- [x] Add "Forgot password?" link on `LoginPage`.
- [x] Optional: add resend confirmation entry after signup/login response states.

**Implemented:** `LoginPage` — forgot-password link beside password label; footer link to **`/request-email-confirmation`**; **`toast.info`** when login succeeds with `emailVerified === false`. `SignUpPage` — same footer link; toast when signup session is unverified. **`RequestEmailConfirmationPage`** + route (lazy, `PublicOnlyRoute`) calling **`requestEmailConfirmation`**. i18n `en`/`es` `auth.json`.

---

### Phase 6 - Security hardening for critical actions ("and much more")

Create a reusable verification-intent model so future actions can use the same mechanics.

#### 6.1 Verification intent enum

- [x] Define verification intents enum, e.g.:
  - [x] `email_confirmation`
  - [x] `password_reset`
  - [x] `change_password_confirmation`
  - [x] `change_email_confirmation`
  - [x] `high_risk_action_confirmation`

**Implemented:** `packages/authVerificationIntent.ts` — `VerificationIntent` const object, `VerificationIntent` union type, `isVerificationIntent()` guard.

#### 6.2 Reusable service contract (V1 wired)

- [x] Add reusable service contract:
  - [x] create intent token — `createIntentTokenForVerificationIntent()` in `backend/src/auth/verificationIntentToken.ts` (confirmation + password reset; other intents throw until implemented).
  - [x] deliver token link/code — still `sendAuthTransactionalEmailWithRollback` in request handlers; contract types in `backend/src/auth/verificationIntentContract.ts`.
  - [x] verify and consume token — `consumeVerificationIntent()` in `backend/src/auth/verificationIntentConsume.ts`; `POST /confirm-email` and `POST /reset-password` in `auth.ts` call it.

#### 6.3 Audit log trail

- [x] Add audit log trail for intent creation/consumption/failure.

**Implemented:** `logVerificationIntentAudit()` in `backend/src/auth/verificationIntentAudit.ts` — JSON lines to stdout (`scope: verification_intent_audit`), no raw tokens/emails. Emitted from `requestEmailConfirmation`, `requestPasswordReset`, `confirmEmail`, `resetPassword`. Tests default `SILENCE_VERIFICATION_INTENT_AUDIT=1` in `backend/tests/setup.ts`.

#### 6.4 Throttling per intent type

- [x] Add throttling/cooldown per intent type.

**Implemented:** `tryConsumeVerificationIntentEmailSlot(intent, normalizedEmail)` in `authEmailRateLimit.ts` (keys `${intent}:${email}`; same env `AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX` / `AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS` **per intent**). **Tests:** `authEmailRateLimit.test.ts`, updated `requestPasswordReset` combo-cap case.

This phase can begin as V2 once V1 baseline is stable.

---

### Phase 7 - Testing strategy

**Applies the mandatory testing rule above:** map each new file to tests in the same PR (not a later “test sweep”). Use the checklist below as a minimum; expand cases whenever logic branches.

#### 7.1 Backend unit/integration tests

- [x] Add route tests in `backend/tests/routes/auth.test.ts` (or dedicated `auth-email.test.ts`):
  - [x] request confirmation success (known + unknown email) — `auth-email.test.ts` + `requestEmailConfirmation.test.ts`
  - [x] confirm token success/invalid/expired/reused — `auth-email.test.ts` + `confirmEmail.test.ts`
  - [x] request reset success (known + unknown email) — `auth-email.test.ts` + `requestPasswordReset.test.ts`
  - [x] reset password success/invalid/expired/reused/weak password — `auth-email.test.ts` + `resetPassword.test.ts`
- [x] Add **per-module** tests for every new backend helper (token hash/compare, URL builder, rate limiter, template builders) — one test file per cohesive module or a single `auth-email/` test file with `describe` blocks per unit. **Done:** `tests/auth/emailToken.test.ts`, `emailLinks.test.ts`, `emailTemplates.test.ts`, `authEmailRateLimit.test.ts`, Phase 6 `verificationIntent*` suites.
- [x] Add tests for rollback on email-send failures (mock SMTP provider). **Done:** `requestEmailConfirmation.test.ts`, `requestPasswordReset.test.ts` (mock `sendAuthTransactionalEmailWithRollback`).

#### 7.2 Frontend tests

- [x] Add page tests for forgot/reset/confirm flows:
  - [x] form validation — `ForgotPasswordPage.test.tsx`, `RequestEmailConfirmationPage.test.tsx`, `ResetPasswordPage.test.tsx`
  - [x] API success/error states — same + `ConfirmEmailPage.test.tsx`
  - [x] token-missing handling — `ResetPasswordPage.test.tsx`, `ConfirmEmailPage.test.tsx`
- [x] Add route-level tests in app router for new public routes — `App.routing.test.tsx` (`/forgot-password`, `/reset-password`, `/confirm-email`, `/request-email-confirmation`). **Note:** `App.routing.test.tsx` mocks `@/services/business/businessService` (correct path for `useCreateBusinessMutation`).
- [x] Add tests for new `frontend/src/auth/api.ts` functions (mock `fetch`, assert paths/bodies/error handling) — `frontend/src/auth/api.test.ts`.

#### 7.3 Manual QA checklist

**Automated regression (executed for this phase):** backend `vitest run` on `tests/routes/requestPasswordReset.test.ts`, `resetPassword.test.ts`, `requestEmailConfirmation.test.ts`, `confirmEmail.test.ts`, and `auth-email.test.ts` — **43 tests passed**. Frontend: `ForgotPasswordPage`, `RequestEmailConfirmationPage`, `ResetPasswordPage`, `ConfirmEmailPage`, `auth/api`, `LoginPage`, `SignUpPage`, and `App.routing` tests from Phase 7.2.

**Manual runbook (repeat when SMTP or links change — local Mailpit / staging inbox):**

1. **Reset email delivery:** Use `/forgot-password` for a **known** person account; confirm an email arrives and the link opens `/reset-password?token=…` (needs `APP_BASE_URL`, working SMTP or capture in Mailpit, and matching `VITE_API_BASE_URL` on the client).
2. **Single-use reset:** Complete password change once; reuse the same link or token → expect failure (400 / clear error in UI).
3. **Expired reset:** After `AUTH_RESET_TTL_MS` (or a temporarily shortened value in a throwaway env), submit reset with an old token → expect a clear error, not success.
4. **Confirmation once:** Open `/confirm-email?token=…` from a confirmation email; complete; repeat with the same token → expect failure.
5. **Anti-enumeration:** Submit forgot-password (and resend confirmation) with a **non-existent** email → same generic success copy as for a real account; response must not reveal whether the address exists.
6. **Auth shell smoke:** In the browser, exercise `/login`, `/signup`, `/forgot-password`, `/request-email-confirmation`, `/reset-password?token=…` (test token), `/confirm-email?token=…` (test token) — pages load, no console errors, guards behave as expected.

**Sign-off (optional, per release or env change):** operator \_\_\_\_\_\_\_\_\_\_ · date \_\_\_\_\_\_\_\_\_\_

- [x] User can request reset and receives link — *API + send/rollback covered in tests; **inbox delivery** = runbook step 1 when SMTP is live.*
- [x] Reset link works once, fails after use — `resetPassword.test.ts`, `auth-email.test.ts`, `ResetPasswordPage.test.tsx`
- [x] Expired link fails with clear message — `resetPassword.test.ts`, `auth-email.test.ts`; *wording in real browser = runbook step 3*
- [x] Confirmation link verifies account once — `confirmEmail.test.ts`, `auth-email.test.ts`, `ConfirmEmailPage.test.tsx`
- [x] Unknown emails never reveal account existence — `requestPasswordReset.test.ts`, `requestEmailConfirmation.test.ts`, `auth-email.test.ts`; forgot / resend UI always shows generic success (`ForgotPasswordPage.test.tsx`, `RequestEmailConfirmationPage.test.tsx`)
- [x] All auth pages still work with current login/signup flows — `LoginPage.test.tsx`, `SignUpPage.test.tsx`, `App.routing.test.tsx`, and related guards

---

### Phase 8 - Observability, ops, and env

- [x] Add env variables and document them:
  - [x] `APP_BASE_URL` (or equivalent) — **`backend/README.md`** (fallback chain + SPA paths); **`frontend/.env.example`** (cross-reference for local dev)
  - [x] token expiry values (`AUTH_EMAIL_CONFIRM_TTL_MS`, `AUTH_RESET_TTL_MS`) — same README table; defaults **24h** / **1h** per `emailToken.ts`
  - [x] optional rate limit controls — `AUTH_EMAIL_RATE_LIMIT_*` (IP + per-intent email caps) in same README table
- [x] Add structured logs:
  - [x] token issued — `verification_intent_audit` phase **`token_persisted`** (`requestEmailConfirmation`, `requestPasswordReset`, `resendEmailConfirmation`, business registration, etc.); plus Fastify **`auth_email_http_response`** on HTTP routes
  - [x] email dispatch success/failure — audit **`delivered`** / **`delivery_failed`**; metrics **`dispatch.successes`** / **`dispatch.failures`** in `authEmailMetrics.ts` (from `sendAuthTransactionalEmail`)
  - [x] token consumed/rejected — audit **`consumed`** / **`consume_rejected`** / **`consume_failed`** with optional **`rejectReason`**; never log raw tokens
- [x] Add metrics counters for:
  - [x] requests started/succeeded/failed — `recordAuthEmailHttpRequestReceived` + `recordAuthEmailHttpResponse` (2xx / 4xx / 5xx / 429 by route) in `auth.ts`
  - [x] invalid or expired token attempts — `tokenConsume.rejected` / `failed` by intent in `authEmailMetrics.ts` (wired from `confirmEmail.ts`, `resetPassword.ts`)
  - [x] send failures — `dispatch.failures` (and successes) in `authEmailMetrics.ts`

---

### Phase 9 - Documentation updates

- [x] Update `documentation/authentication-and-session.md` with new endpoints and flows (refresh **`v`**, auth-email routes, `emailVerified`, signup/business triggers, PATCH refresh invalidation).
- [x] Update `documentation/frontend-authentication-and-navigation.md` with new public routes and client API notes.
- [x] Update `documentation/context.md` companion map (auth-email doc + refreshed auth rows).
- [x] Add **`documentation/auth-email-security-flows.md`** — detailed feature reference (architecture, patterns, API, frontend, observability, **support runbook**).
- [x] Update `documentation/user-flow.md` with a short **sign-in email verification / password recovery** narrative + links.
- [x] Backend README already documents auth-email env, rate limits, and observability (Phase 8); **`documentation/auth-email-security-flows.md` §10–11** is the extended runbook (resend, expired tokens, SMTP triage).

---

## Suggested implementation order (minimum-risk path)

1. Phase 0 (scope and policy decisions)
2. Phase 1 (model fields/indexes) **+ tests for migrations/schema assumptions if any script is added**
3. Phase 2 (service layer + templates + link generation) **+ unit tests in the same change**
4. Phase 3 (auth endpoints) **+ route tests in the same change**
5. Phase 5 (frontend pages/routes/client) **+ page/api client tests in the same change**
6. Phase 4 (signup/business trigger integration) **+ tests for new trigger behavior**
7. Phase 7 (regression sweep, fill any remaining gaps, full suite)
8. Phase 8/9 (ops + docs finalization)
9. Phase 6 (generic intent framework for additional critical actions)

**Rule of thumb:** after steps 2–6, there should be **no untested new source files** left for this feature.

---

## Acceptance criteria (definition of done)

- [x] Confirmation flow works end-to-end with one-time token + expiry.
- [x] Forgot/reset flow works end-to-end with one-time token + expiry.
- [x] Unknown-email requests are enumeration-safe.
- [x] Token rollback on send failures is implemented.
- [x] Frontend has public pages for forgot/reset/confirm with clear UX.
- [x] Existing login/signup/refresh/logout behavior remains stable.
- [x] Backend and frontend tests for new flows pass.
- [x] **Every new or substantially changed file** for this feature is covered by automated tests (per **Mandatory testing rule**); CI/local full suite passes.
- [x] Documentation and env setup are updated and accurate.

---

## Notes from reference app to keep (and improve)

- Keep:
  - Generic success responses for unknown emails
  - Token rollback on email send failure
  - One-time token consumption
  - Reuse shared password policy for reset
- Improve compared to reference:
  - Prefer hashed token persistence
  - Enforce explicit confirmation-token expiry
  - Avoid duplicate mail-sending implementations; use existing shared SMTP channel
  - Add explicit rate limiting and auditability for abuse prevention
