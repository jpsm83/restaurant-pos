# ADR-0003: Soft delete across all domain models

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

The API deletes domain documents outright. `DELETE` routes call Mongoose
`deleteOne`/`deleteMany` (users, employees, orders, and so on), and some of them
unlink related records by mutation. There is no recovery path: once a document
is removed it is gone, and there is no durable record that it ever existed.

Several forces push against hard deletion:

- **Data integrity.** A delete can silently destroy records other documents and
  other people depend on (a user with order history, a business with staff and
  stock). Referential integrity is not enforced by the database.
- **Recoverability.** Accidental deletions and users who leave and return are
  both real; an account that can be restored is worth more than one that cannot.
- **Auditability.** Reports and support need to know that a document was
  removed, when, and by whom, without the document vanishing.
- **Cross-cutting consistency.** Every feature subject needs the same answer to
  "what happens when this is deleted?", and an ad-hoc per-subject answer drifts.

## Decision

Adopt **soft delete as the single deletion model for all domain models**, with
the one narrow exception for transient, order-less sales instances defined
below.

Concretely:

- Every domain model carries a **server-owned deleted marker** — a `deleted`
  boolean — plus a **`deletedAt` timestamp**. Neither is ever set by a client;
  both are excluded from request DTOs like every other server-owned field.
- **No route hard-deletes a domain document.** "Delete" operations set the
  marker and the timestamp. Queries default to active-only, with an explicit
  opt-in to include deleted documents where a feature needs them.
- **Uniqueness is enforced among active documents** through partial unique
  indexes, so a value freed by a deleted document can be reused; reusing a
  soft-deleted identity's email means **reactivating** that document, not
  creating a duplicate.
- **Reactivation** clears the marker and the timestamp. For identities where
  access must be re-proven, reactivation additionally requires a confirmation
  delivered out of band (email), so possession of a value alone cannot restore
  a deleted account.
- **Account deletion is two-phase.** A user's deletion request first enters a
  **pending-deletion** window (during which sign-in still works so the request
  can be cancelled); after the window the soft-delete marker is applied. A user
  whose businesses would be orphaned must transfer or close them first; deletion
  does not cascade into other people's records.
- **Transient, order-less sales instances are discarded, not soft-deleted.** A
  sales instance that recorded no orders — a tab opened and closed empty — is
  removed outright. It captured nothing and nothing references it, and keeping
  it would leave phantom sittings in availability, reports, and audits. This is
  the one deliberate exception to "no route hard-deletes a domain document": a
  transient session that holds no lasting record may be dropped.

## Consequences

**Positive**

- No delete can destroy data other records depend on; integrity is preserved.
- Accidental deletions and returning users are recoverable.
- Deletions are auditable (who, when) without losing the document.
- One consistent rule every feature subject can apply.

**Negative / costs**

- Storage grows without bound unless a retention/purge policy is defined; a
  genuine "right to erasure" request needs an explicit hard-erasure path that
  respects referential integrity.
- Every query, index, and uniqueness constraint must account for the deleted
  flag; partial indexes and default filters become load-bearing.
- Reactivation has security implications, so identity reactivation is gated on
  out-of-band confirmation rather than an in-app action alone.
- **"No route hard-deletes a domain document" no longer holds literally.** A
  transient, order-less sales instance is discarded rather than marked, and any
  future exception of the same shape has to be argued deliberately rather than
  assumed.

## Alternatives considered

- **Hard delete with backups.** Rejected: recovery is coarse and slow, and the
  database cannot guarantee referential integrity.
- **Per-subject deletion rules.** Rejected: they drift and re-litigate the same
  question in every subject document.
- **A `deletedAt` timestamp alone.** Rejected: an explicit boolean keeps queries
  and partial indexes cheap and unambiguous alongside the timestamp.
- **Cascade deletes.** Rejected: deleting one document must never silently
  remove records that belong to or are depended on by others.
