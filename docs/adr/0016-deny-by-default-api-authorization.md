# ADR-0016: Deny-by-default authorization for `/api/v1`

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

The Fastify app registers every route plugin under `/api/v1` and relies on each
route (or its author) to add an authentication hook. Routes added before a
build-order row owned their product authorization rule therefore shipped with
no hook or with the optional-auth hook: anonymous notification CRUD, anonymous
account deletion, business deletion, inventory creation, and several other
legacy mutations were reachable without a User session.

Authentication is a platform rail, not a feature decision. Each new route
should be safe by construction; a reviewer should see a small, explicit list of
public exceptions rather than audit every route for a missing hook.

## Decision

Every `/api/v1` route requires a live User session unless it is listed in the
single exported public allowlist. The default is closed; public is opt-in and
reviewed.

- One shared `preValidation` hook is registered once at the v1 route root. It
  rejects a request without a live access session using the same check the
  existing `createAuthHook` uses, and attaches `request.authSession`.
- One exported data structure (`PUBLIC_ROUTE_ALLOWLIST`) carries one reason per
  public route. It covers auth entry and recovery, health, public discovery and
  public business-profile reads, and the WebSocket live-upgrade boundary, which
  authenticates by one-time ticket rather than the ordinary route hook.
- `HEAD` follows the allowlisted `GET` decision. CORS preflight `OPTIONS`
  requests carry no credentials and pass through.
- Business-layer and capability guards remain the second check on tenant
  routes. The gate establishes identity; it does not replace those rules.
- `createOptionalAuthHook` is reserved for documented public reads that
  genuinely need optional identity. It must never protect a mutating route.
- A route whose product authorization rule is not specified by a completed
  build-order row is retired from registration until that row lands, rather
  than given an invented rule.
- A route-inventory test enumerates the registered Fastify route table and
  compares it with the allowlist and the default gate, so a new route cannot be
  added without a public reason or an authenticated-by-default decision.

## Consequences

**Positive**

- A forgotten hook is no longer an authorization hole; the route is closed by
  default.
- The set of unauthenticated surfaces is one reviewable file with reasons.
- Legacy optional/no-hook mutations can be secured or retired without inventing
  product behaviour.

**Negative / costs**

- Every request pays the live-session check, including routes that also call
  `createAuthHook`. The duplicate is a defense-in-depth choice while the older
  per-route hooks remain; it can be removed when those hooks are swept.
- Adding a genuinely public route now requires editing the allowlist and
  explaining why, which is deliberate friction.
- The route-inventory test must be updated when a route is intentionally
  retired or renamed.
