# Plan quotas and retention purge

**Date:** 2026-10-18  
**Status:** Accepted — product behaviour captured in `docs/product/data-retention.md`  
**Approach:** Split ownership — creation quotas on the plan catalogue (monetization); platform-wide soft-delete → timed hard-purge with Superadmin-editable delays (overview + superadmin); inactive users and dormant businesses as lifecycle jobs (users + business).

---

## 1. Problem

Keeping every soft-deleted and abandoned document forever grows MongoDB and related storage cost. Plans already gate features and venue caps but not **how much active data** a Business may create, and the platform has almost no path from soft-delete to physical removal.

Hard-deleting live history by plan year is too harsh for tax and trust. The safer levers are:

1. **Creation quotas** on active documents (per plan).
2. **Timed hard-delete of soft-deleted documents** after platform delays, with an absolute integrity gate.
3. **Lifecycle soft-delete** for abandoned non-owner users and dormant businesses, then the same purge pipeline.

---

## 2. Goals and non-goals

### Goals

- Limit active food menu items, drink menu items, and employees per Business by plan.
- Keep the hot database free of eligible dead data via soft-delete → delayed hard-delete.
- Never hard-delete anything that would break queries, joins, or remaining references (**Rule #1 — data integrity**).
- Never auto soft-delete a User who still owns a Business (absentee owner is valid).
- Soft-delete dormant businesses after inactivity + Owner notice; purge their data only under normal class delays + Rule #1.
- Make delays and quota numbers Superadmin-editable (platform-wide delays, per-plan quotas).
- Allow Owner/Admin export while data still exists.

### Non-goals

- Media / Cloudinary MB quotas.
- Per-plan purge delay windows (delays are global).
- Hard-delete that nulls foreign keys to force eligibility.
- Auto soft-delete of Owner-users while they own a Business.
- Country-specific legal retention matrices in v1 (5-year financial class is the product floor; refine later).

---

## 3. Rule #1 — Data integrity (supreme)

**Nothing is hard-deleted if removing it would break the application or any remaining document that still requires that id.**

Before every hard-delete attempt:

1. Evaluate the integrity gate first.
2. If **any** remaining document — **active** or **soft-deleted but not yet purged** — still stores that id as a required reference → **skip**; log `blocked_by_integrity`.
3. Only if **zero** such references remain may class delay and hard-delete apply.

Example: a User past inactivity and soft-delete age must **not** be hard-deleted while a payment, order, rating, or employee history line still references that user id. Dependents purge first under their own rules, or the User tombstone remains indefinitely.

v1 does **not** null out FKs to force eligibility. Soft-delete, quotas, dormant business, and emails are all secondary to this gate.

---

## 4. Creation quotas

Owned by **monetization**; stored on the plan catalogue; enforced at create/reactivate for that Business.

Counts mean **active** documents only (not soft-deleted). Soft-delete frees a quota slot.

### Seed limits (Superadmin-editable)

| Quota (per Business) | Free | Basic | Premium | Enterprise |
| --- | ---: | ---: | ---: | ---: |
| Food menu items (active) | 30 | 100 | 300 | Unlimited (`null`) |
| Drink menu items (active) | 50 | 300 | 500 | Unlimited (`null`) |
| Employees (active memberships) | 0 | 40 | 100 | Unlimited (`null`) |

Free `employeeLimit: 0` matches HR/schedules already off on Free; the field exists so paid plans and downgrade checks stay uniform.

### Enforcement

- At cap → reject with a stable error (limit name, current count, max, plan).
- Downgrade blocked until the portfolio/venue already fits lower caps (same pattern as venue and feature caps today).
- Manage UI shows usage vs cap where creation happens.

### Catalogue fields (per plan)

- `foodMenuItemLimit`
- `drinkMenuItemLimit`
- `employeeLimit`  
  (`null` = unlimited)

---

## 5. Soft-delete → hard purge

### Product rule

- Applications and console operators **soft-delete only** (unchanged user-facing rule).
- Platform retention jobs may **hard-delete** eligible soft-deleted documents after policy delay **and** Rule #1.

### Document classes (platform-wide delays, Superadmin-editable)

| Class | Seed delay after soft-delete | Examples |
| --- | --- | --- |
| **Operational** | 90 days (~3 months) | Soft-deleted floors, printers/screens, promotions, unreferenced goods/suppliers, soft-deleted memberships/HR after termination, notifications, private user assets, etc. |
| **Legal / financial** | 1825 days (~5 years) | Payments, refunds, bill settlement history, gift-card ledger, closed report artifacts, platform-billing documents, commission lines, payroll-export / closed attendance inputs — anything needed to reconstruct money or tax position |

Active (non-deleted) documents are **never** purged by this job.

Each product subject names its models as operational or legal/financial in one line when retention matters; default is **operational** unless stated financial.

### Identities

- Users, Businesses, and related identity rows **may** eventually be hard-deleted after soft-delete + class age, **only** when Rule #1 passes.
- Owner-users are never **auto soft-deleted** while they own a Business; hard-delete remains integrity-gated like everything else.
- Recommended ordering: financial children purge (or remain) under 5-year class; Business/User stubs remain until no required references exist.

### Catalogue root fields

- `softDeletePurge.operationalDays` — seed `90`
- `softDeletePurge.legalFinancialDays` — seed `1825`

---

## 6. Inactive users

Owned by **users**; constants editable in **superadmin**.

### Trigger

- **User** with **no successful sign-in** for **730 days** (~24 months).
- **Skip** if the user currently **owns** any Business (absentee owner is valid; someone else may run the venue).

### Notice

- Email at **30 days** and **7 days** before action.
- Successful sign-in resets the clock.
- Recommended: “Keep my account” link in the email also counts as activity.

### Action

- Enter existing **pending deletion → soft-delete** flow (15-day grace; sign-in can cancel).
- Cascade **only user-private** data: sessions, favorites, personal notification inbox, and similar private-only assets.
- **Do not** erase venue-owned history: orders, payments, reports, reservations, ratings, sales attribution, etc.
- Employee memberships: **terminate** (or leave already-terminated); do not wipe labour/sales history. UI may show a frozen / “former user” display name.
- Hard-delete of the User later only via retention job + Rule #1.

### Catalogue fields

- `inactiveUser.noSignInDays` — seed `730`
- `inactiveUser.warnDaysBefore` — seed `[30, 7]`

---

## 7. Dormant businesses

Owned by **business**; constants editable in **superadmin**.

### Activity that resets the 12-month clock (definition B)

Either of:

- a **closed sale / payment** at the venue, or  
- any **Business-mode sign-in** by an eligible employee/admin at that venue.

### Trigger and notice

- **365 days** with neither activity → treat as dormant candidate.
- Email the Owner to confirm the venue should stay live.
- **30 days** with no confirming action → **soft-delete the Business**.

### Soft-delete behaviour

- Follow business close rules: no open sales instances (close or resolve opens first as the business subject already requires).
- Terminate employee memberships; retain historical records.
- Children soft-deleted per existing close/cascade conventions, then hard-deleted only under §5 + Rule #1.
- Business identity stub remains until Rule #1 allows removal (typically after legal/financial dependents are gone or purge-eligible and removed).

### Catalogue fields

- `dormantBusiness.noActivityDays` — seed `365`
- `dormantBusiness.confirmDays` — seed `30`

---

## 8. Employees (clarification)

- **Inactive** (no sign-in) is **not** the same as deleted.
- No special auto hard-delete of living memberships for inactivity alone.
- Soft-deleted / terminated employee data hard-deletes only on the normal operational or financial timeline + Rule #1.
- When a Business is soft-deleted, memberships terminate (or soft-delete per employees subject); history retained until retention purge.

---

## 9. Jobs

| Job | Cadence (seed) | Behaviour |
| --- | --- | --- |
| Inactive users | Daily | §6 |
| Dormant businesses | Daily | §7 |
| Retention purge | Daily | Soft-deleted past class delay; Rule #1; audit log of purged ids/types (metadata only) |

---

## 10. Export and Superadmin policy changes

- Owner/Admin may **export** venue (and portfolio-scoped) data while it still exists (active or soft-deleted).
- Superadmin edits per-plan quotas and all global constants in §4–§7.
- **Lengthening** delays may apply immediately (more retention).
- **Shortening** delays or tightening quotas that bind existing Owners uses the existing **term-change accept/decline** path where commercial/policy binds paying Owners.
- Users already inside an inactivity or dormant warning window should be re-notified if Superadmin shortens those windows.

---

## 11. Document ownership

| Concern | Product doc |
| --- | --- |
| Quota numbers, enforce-at-create, downgrade fit | monetization (+ `subscriptionCatalogue`) |
| Soft-delete convention, Rule #1, purge exception, class delays | overview (+ one line per subject for class) |
| Inactive user lifecycle | users |
| Dormant business lifecycle | business |
| Edit quotas and global constants | superadmin |
| Warning / confirm emails | emails |

---

## 12. Implementation sketch (not a build plan)

- Extend `packages/subscriptionCatalogue.json` (and types/utils) with quota fields and global retention/lifecycle constants.
- Enforce quotas in create/reactivate routes for business goods (food/drink split) and employees.
- Add scheduled jobs for inactive users, dormant businesses, and retention purge with integrity checks and audit logging.
- Update product docs listed in §11 after this design is accepted.
- Wire Superadmin catalogue UI for the new fields.

Detailed ticket breakdown and sequencing belong in a separate implementation plan after this spec is approved.

---

## 13. Open points explicitly deferred

- Exact allowlist of models per class (each subject adds a one-liner when docs are updated).
- Country-specific retention floors beyond the 5-year financial default.
- Optional “approaching operational purge” reminder emails.
- Whether “Keep my account” is a signed link distinct from sign-in (recommended yes).
