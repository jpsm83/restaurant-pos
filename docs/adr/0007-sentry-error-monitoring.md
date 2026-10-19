# ADR-0007: Sentry for unexpected-error monitoring

- **Status:** Accepted
- **Date:** 2026-10-19

## Context

The Customer and Business apps (this monorepo) already centralize API errors as RFC 9457 problem details (ADR-0001) and catch React render failures in `ErrorBoundary`, but unexpected failures are only visible in local logs/`console`. There is no shared place for the engineering team to group, triage, and later fix production (or opted-in) crashes.

A grill on 2026-10-19 settled how to adopt **Sentry** as that review inbox without turning every expected client mistake into noise, without storing error telemetry in the product database, and without building Superadmin ops UI in this pass.

## Decision

1. **Vendor.** Use **Sentry** (hosted) for application error monitoring. Start on the free **Developer** plan (one reviewer login); upgrade to Team when a second person needs the Issues inbox.
2. **Surfaces (v1).** Instrument **both** the Fastify backend and the React frontend in this monorepo.
3. **What to capture.** Send only **unexpected** failures:
   - Backend: status **≥ 500** and unhandled exceptions that reach the global problem-details handler (ADR-0001). Do **not** send ordinary `AppError` / validation **4xx**.
   - Frontend: existing **`ErrorBoundary`** (`componentDidCatch`) plus the browser SDK defaults for unhandled errors and promise rejections. Do **not** auto-report every failed React Query / API **4xx** as a Sentry event.
4. **Single sinks — no scatter.** Backend reporting lives in **`registerProblemDetailsHandler`**. Frontend reporting lives in the shared **`ErrorBoundary`** (and SDK global handlers). Routes and feature code must not call Sentry ad hoc for expected business errors.
5. **When it is on.** Initialize the SDK only when a DSN is set and the process is **not** under test (`test` / Vitest). Local **development** stays off unless a DSN is explicitly provided. Missing DSN means no init and no network calls.
6. **Environment variables** (root `.env`, same pattern as the rest of the monorepo):
   - `SENTRY_DSN` — backend (server-only).
   - `VITE_SENTRY_DSN` — frontend (public browser DSN is expected).
   - `SENTRY_ENVIRONMENT` / `VITE_SENTRY_ENVIRONMENT` — optional; fall back to `NODE_ENV` / Vite mode.
7. **Privacy.** Before send, scrub secrets and sensitive fields (passwords, tokens, cookies, `Authorization`, refresh tokens, payment-like fields). Do **not** attach full request bodies by default. Prefer route, method, status, environment, release, and safe identifiers already known after auth (e.g. user id / business id).
8. **Review inbox.** Engineers triage in **Sentry Issues** (group, resolve, ignore). **No** custom MongoDB (or other product-DB) error collection and **no** in-app “dev error inbox” in v1.
9. **v1 Sentry product surface.** **Error monitoring only.** Session Replay and performance/tracing are deferred so free quota goes to real bugs.
10. **Releases.** Set a simple **`release`** string when available (git sha or package version). Full CI **source-map upload** waits until a real deploy pipeline exists.
11. **Alerts.** Use Sentry’s default **email** on new/regressed issues for the Developer account. No Slack/PagerDuty in v1.
12. **Client responses unchanged.** API clients still receive safe problem-details (no internal leak on 5xx). Sentry holds the detail for engineers.
13. **Future — Superadmin (out of v1).** The Superadmin console (separate Imperium-staff app and auth realm; superadmin product subject) may later offer operators a way to **open or deep-link** into relevant Sentry Issues (or a read-only ops view) for support. That UI and any Superadmin SDK wiring are **explicitly out of this ADR’s implementation scope**; this point only reserves the intent so v1 choices (Issues as source of truth, scrubbing, unexpected-only) stay compatible.

## Consequences

**Positive**

- One reviewable queue for unexpected backend and frontend failures without inventing an in-house telemetry store.
- Stays aligned with ADR-0001: one global API error formatter; Sentry is an observer of that sink, not a second error-response path.
- Free Developer plan is enough for solo review during early development; local noise does not burn quota by default.
- Privacy and unexpected-only rules keep the inbox usable and reduce PII risk.

**Negative / follow-on**

- Free plan is **one user** until Team is purchased.
- Without source-map upload, minified production stacks may be harder to read until deploy/CI exists.
- Superadmin deep-link remains unimplemented until that app is built; engineers use the Sentry UI directly in the meantime.
- Implementation must add `@sentry/node` (or the current Node/Fastify-recommended package) and `@sentry/react`, wire init behind DSN checks, and extend scrubbing/tests — tracked as build work after this ADR.

## Alternatives considered

- **Custom error table in MongoDB** — rejected for v1: mixes ops telemetry with product data, weak grouping/alerting, retention and PII burden on the app.
- **Datadog / CloudWatch as the primary error inbox** — rejected for v1: free tiers and UX are weaker for application exception triage; heavier ops surface than needed.
- **Self-hosted Loki/ELK only** — rejected for v1: operable but poor “issue” workflow compared with Sentry Issues.
- **Report all 4xx / every API failure** — rejected: drowns real bugs and burns quota.
- **In-app Superadmin error inbox in v1** — rejected: Superadmin is out of this monorepo’s current build; document the future link only.

## Related

- ADR-0001 (global problem-details handler — backend capture point).
- `docs/conventions/debugging.md` (how engineers use Sentry when fixing bugs).
- Superadmin product subject (future operator deep-link; separate app).
