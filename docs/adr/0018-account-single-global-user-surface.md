# ADR-0018: Account is the single global User surface

- **Status:** Accepted
- **Date:** 2026-11-06
- **Ticket:** GitHub issue #363

## Context

The account area began as a Customer-mode surface. Entering it in Business mode
reconciled the stored mode to Customer, and Preferences was carved out as the only
user-scoped exception. Business mode also carried a **Me** left-menu group whose
entries duplicated account destinations: Notifications linked to a venue URL and
Preferences linked to the shared account URL.

Every User is always a customer, and the self-service destinations are owned by the
User, not by a mode or a venue. A mode reconciliation on an account URL changes a
server-stored fact the person did not ask to change, and it makes a single global
surface behave differently depending on how it was opened. The Business **Me** group
adds a second door to the same pages, with a venue-scoped notification URL that the
inbox does not actually filter by venue.

The future order-history surface also needs a stable account URL now, even though
the surface itself is not built yet.

## Decision

### 1. Account is the single global User surface

- The account area is session-derived and mode-agnostic. Every account destination
  opens from either Customer or Business mode and **never changes the stored mode**.
- `/account` redirects to `/account/profile`.
- The account sidebar owns the global destinations: **Profile**, **Address**,
  **Notifications**, **Preferences**, and **Orders**.
- Account destinations are protected by the session but are not wrapped by the
  Customer-mode guard.

### 2. Business has no Me group

- The Business left menu has **Service** and **Manage** only. There is no self-only
  group in Business.
- Preferences stays reachable from the avatar menu and from the account sidebar.
- The avatar menu remains navigation-only: **Account**, **Preferences**, and
  **Log out**.

### 3. User-owned destinations keep User-owned URLs

- The retired `/business/:businessId/notifications` URL redirects to
  `/account/notifications`; the inbox is User-scoped and shared across modes.
- `/account/orders` is the stable URL for future order history. Until that surface
  ships, the destination renders a localized not-built-yet state and reads no
  orders.

### 4. Mode scoping

- `isModeScopedPath` no longer treats `/account/*` as mode-scoped. The account area
  is not a Customer destination and does not reconcile the stored mode.

## Consequences

**Positive**

- One global surface for User settings and history, reachable the same way from both
  modes.
- Opening account settings no longer mutates the stored Customer | Business mode.
- Business navigation stops duplicating User destinations, and old venue inbox links
  keep working.
- Order history has a stable URL before its implementation.

**Negative / costs**

- Business staff no longer have an in-shell shortcut to Notifications or
  Preferences; they use the avatar menu or the account area.
- Old venue inbox bookmarks take one redirect.
- The account layout and sidebar are no longer Customer-mode-scoped, so future code
  must not assume a mode when rendering account destinations.

## Related

- ADR-0013 establishes session-derived self-service URLs.
- ADR-0017 places language and appearance on the User's Preferences page.
