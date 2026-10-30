# ADR-0013: Session-derived URLs for self-service routes

- **Status:** Accepted
- **Date:** 2026-10-30

## Context

The app shell addressed the signed-in person through the URL:

```
/:userId/customer/dashboard
/:userId/customer/profile
/:userId/customer/favorites
/:userId/mode
/:userId/employee/dashboard
```

The user id in those paths is redundant. The session already establishes who the
actor is, and the backend authorizes from the session, never from the path. The
path only forced a `UserIdRouteGuard` to reject mismatches — a guard that existed
to undo an implication the URL itself created.

The user id and the `customer` segment also caused concrete costs:

- Every self-service link looked like an addressable `/users/:id/...` resource,
  inviting broken-object-level-authorization mistakes and normalizing URLs that
  a person may try to edit.
- Identifiers leaked into history, logs, `Referer`, analytics, and shared links.
- Bookmarks and support links were person-specific and broke for anyone else.
- Redirect churn and duplicated path builders (`canonicalUserCustomer*`) spread
  through guards, post-login, account menu, and layouts.
- `customer` restated the default mode. Business is already disambiguated by
  `/business/:businessId`; the customer surface needs no second discriminator.

At the same time, some ids in URLs are legitimate: `/business/:businessId`
addresses a real resource (a venue the person may switch between), so it stays.

## Decision

Self-service routes are **derived from the session**. The canonical paths are:

```
/dashboard  /profile  /favorites  /mode
/employee/dashboard  /employee/profile
/business/:businessId/...
```

- A URL carries a resource id **only when it addresses that resource**. The
  signed-in person is request context, not a path segment.
- Authorization continues to come from the session and the backend; no route
  trusts a path for identity.
- `UserIdRouteGuard` and `matchesSessionUserId` are removed.
- Legacy `/:userId/customer/*`, `/:userId/mode`, and `/:userId/employee/*` URLs
  redirect to the new paths when the first segment is a Mongo ObjectId, so
  existing bookmarks and in-flight links keep working. Non-id or unknown
  legacy shapes render the 404 page instead of redirecting.
- The Customer surface is the default mode, so it needs no `customer` segment.
  The mode picker remains `/mode`; employee routes remain `/employee/*`.

Public marketing and auth URLs are unchanged. This decision is about the
private, session-authenticated app shell.

## Consequences

**Positive**

- Self-service URLs are stable, shareable, and reviewable; changing the id in a
  URL cannot imply access to another person.
- Fewer guards, fewer path builders, and no id mismatch redirect.
- Identifiers stop leaking through normal navigation and bookmarks.

**Negative / costs**

- Old `/:userId/...` URLs need redirect handling until links and any saved
  bookmarks age out.
- A future cross-user or impersonation surface must use an explicit
  `/admin/users/:id/...`-style namespace rather than reusing self routes.
- Route tests and documentation that asserted the id-based shape must change.
