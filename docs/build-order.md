# Build order — Project Imperium

> **About this document.** This is the **recommended implementation sequence** for Project Imperium. It is not a product subject: it does not redefine behaviour. Behaviour lives in `docs/product/`. Use this file to decide *what to specify and ticket next*. Specs, tickets, and implementation of a row pass the **Spec gate**.

---

## How to use this

1. Work the single phase row that was requested.
2. Open only that row's **Docs to open**, plus [`overview.md`](product/overview.md) for vocabulary and [`docs/coding-standards.md`](coding-standards.md) for the conventions index.
3. Pass the **Spec gate** before writing a spec, splitting tickets, or implementing the row.
4. Mark the row done only when the Spec gate's implement step is true. Where the row has a **Done when** line, that line is true as well. The exit criterion under a phase is the milestone for the whole phase. It does not finish a single row.

## Spec gate

This is the coverage rule for every phase row in this repo. Follow it when a row becomes a spec, a set of tickets, or code, including while a shared skill is running. The spec's **Call-site inventory** names the files. Each ticket names the in-scope files it finishes. A ticket stays open while an acceptance criterion is open. Acceptance lists every in-scope item.

A row is a cut through the linked docs. Those docs are the target state of the whole subject. Finish the slice on every existing place it already applies, and build the new behaviour the row requires end to end for this slice. Behaviour a later row owns stays on that later row.

1. **Inventory.** Search the repo for every model, route, service, job, and screen that already implements the slice or does the opposite of it. Record the file names in the spec under **Call-site inventory**. When the search finds nothing, write that the inventory is empty.

   The inventory is done when every related file is on that list, or the spec states the search found none.

2. **Sort.** Place each inventoried item in the slice, or under **Out of scope** with one reason: the later phase row that owns it, an exception the linked ADR already allows, or code the slice does not touch. Words already in the row (`defer`, `stub`, `can stay`, `no … yet`) start that out-of-scope list.

   Sorting is done when no related file is missing from both lists.

3. **Specify the slice.** For each in-scope item, state the end state, including reads and writes that are not the obvious create or delete route. New behaviour the row requires is specified end to end for this slice: schema, API, tests, and UI when the row includes UI. A stub is specified at the seam the row names.

   The spec is done when each in-scope item has an end state and each deferral names its phase row or ADR exception.

4. **Ticket the inventory.** Each ticket names the in-scope items it finishes, by the file names from the inventory. The last ticket is blocked by the others. Its acceptance fails while any in-scope item still has the old behaviour.

   Tickets are ready when each in-scope item appears on exactly one ticket.

5. **Implement to the criteria.** Close a ticket only when every acceptance criterion is met. The row is finished when every in-scope item matches the slice and the row's **Done when** line is true. A row with no **Done when** line is finished when the slice is true for every in-scope item.

Phase 0 rows carry a **Done when** line because a rail is easy to sample on one route. Later rows use the same test through this gate.

---

**Coverage.** Every written product subject under `docs/product/` (except `_template.md`) appears in the tables below — sometimes more than once, when a later phase deepens an earlier slice. [`overview.md`](product/overview.md) is orientation only, not a build step.

**Not separate build steps** (on purpose — do not wait for extra docs):

| Topic | Why it is not its own row |
| --- | --- |
| Allergens | No standalone product file. Stage 1 rules live inside [business-goods](product/business-goods.md), [orders](product/orders.md), and [order-flow](product/order-flow.md) (Phases 2–5). |
| Cash drawers | Explicitly **out of product scope** (see [employee-cash-out](product/employee-cash-out.md)). Not something to build. |
| Payment facilitator | **No product doc yet** — future / not stage 1. Stripe Connect is already covered via [payments-and-tax](product/payments-and-tax.md) + ADR-0005. |
| Alcohol / age-assurance packs | **Deferred** by the product docs (ID-at-table, etc.). Stage 1 only has age floors in [privacy](product/privacy.md) / [order-flow](product/order-flow.md). |
| Menu localisation | **Deferred**. Stage 1 is single authored language per field; UI languages are English/Spanish only. |

---

## Phase 0 — Platform substrate

Engineering and cross-cutting rails every later subject assumes. Prefer ADRs and shared packages over feature UI.

| done | Order | Focus | Slice | Done when | Docs to open |
| --- | --- | --- | --- | --- | --- |
| [ ] | 0.1 | Request validation, problem details, shared schemas | Zod validation + problem details rail | Every route that accepts a body, query, or params validates it on the shared Zod rail and returns problem details on failure. | [ADR-0001](adr/0001-zod-request-validation-and-problem-details.md) |
| [ ] | 0.2 | Soft-delete conventions | Soft-delete behaviour and reactivation rules | Every current domain model and every ordinary read and write follows ADR-0003; the only physical deletes are the two ADR exceptions; reusing a soft-deleted sign-in identity reactivates that same record after confirmation. Pending-deletion UX and retention purge stay on their later rows. | [ADR-0003](adr/0003-soft-delete.md), [overview](product/overview.md) (soft-delete vocabulary only) |
| [ ] | 0.3 | Auth session plumbing stub | Issue/revoke access + refresh sessions | Existing sign-in paths can issue and revoke an access session and a refresh session. Profile, verification, and reset stay in phase 1. | [users](product/users.md), [staff-sessions](product/staff-sessions.md) |
| [ ] | 0.4 | Transactional email delivery rail | Send + retry plumbing (no full catalogue UI) | A message can be sent and a failed send retried, and every existing outbound mail uses that rail. Catalogue UI and messages owned by later rows stay on those rows. | [emails](product/emails.md) |
| [ ] | 0.5 | Notification persistence + push rail | Inbox store + live push when online | A notification is stored and pushed to an online client, and every existing notification write uses that rail. Inbox UI stays in 1.9. | [notifications](product/notifications.md), [ADR-0006](adr/0006-realtime-transport-and-concurrency.md) |
| [ ] | 0.6 | Live transport + blocked writes offline | WebSocket; no offline write queue | Live updates use this WebSocket rail, a disconnected client cannot commit a write, and the client keeps no offline write queue. Surfaces that do not exist yet are added by their own rows. | [realtime-and-concurrency](product/realtime-and-concurrency.md), [ADR-0006](adr/0006-realtime-transport-and-concurrency.md) |
| [ ] | 0.7 | Append-only audit entry rail | Who/what/when write API | One append-only API records who, what, and when, and every audited act already in the code writes through it. Acts a later row introduces are audited on that row. | [audit-trail](product/audit-trail.md) |
| [ ] | 0.8 | Operational-reason catalogues as data | Closed lists for void, discount, refund, … | The closed catalogues exist as data, and every current void, discount, refund, or reopen path reads them. Flows that do not exist yet are built on their own rows. | [operational-reasons](product/operational-reasons.md) |
| [ ] | 0.9 | Feature-flag resolution stub | Default-on kill-switch resolution | Resolution returns default-on, and every existing feature check calls it. The console and flag-then-plan composition stay in phase 9. | [feature-flags](product/feature-flags.md) |
| [ ] | 0.10 | Error monitoring | Unexpected-error reporting | Unexpected server and client errors are reported. Problem-details responses stay ordinary results. | [ADR-0007](adr/0007-sentry-error-monitoring.md) |

**Exit criteria:** a signed-in request can hit an authenticated API, soft-delete a record, send a test email, write a notification, push a live event, and record an audit entry — without any venue POS yet. A row is done when its **Done when** cell and the Spec gate are both true.

---

## Phase 1 — Identity, tenancy, and chrome

Stand up who people are, what a venue is, and how they move between Customer and Business.

| done | Order | Slice | Docs to open |
| --- | --- | --- | --- |
| [ ] | 1.1 | Sign-up / sign-in, email verify, password reset, User profile, Owner + Company creation hooks, sessions | [users](product/users.md) |
| [ ] | 1.2 | Privacy notice acceptance at account create; birth date; marketing consent off-by-default | [privacy](product/privacy.md), [users](product/users.md) (accept-to-create / birth-date hooks only) |
| [ ] | 1.3 | One User per browser session; peer multi-session; no shared login / PIN / quick-switch | [staff-sessions](product/staff-sessions.md) |
| [ ] | 1.4 | Register venue, draft profile, currency, address → timezone, Company tax number / legal name, go-live checklist fields (go-live can stay blocked until Phase 2) | [business](product/business.md), [users](product/users.md) (Owner / Company only) |
| [ ] | 1.5 | Five layers, job-role → layer map, Owner access = admin-equivalent; thin capability catalogue | [access-and-permissions](product/access-and-permissions.md) |
| [ ] | 1.6 | Membership record; Free = Owner-only Business is enough; hire flow can stay minimal | [employees](product/employees.md), [access-and-permissions](product/access-and-permissions.md) (layers on membership) |
| [ ] | 1.7 | Customer chrome, Customer \| Business toggle, Service / Manage / Me shells, Owner venue tabs | [user-navigation](product/user-navigation.md) |
| [ ] | 1.8 | Wire verify / reset / business-contact verify to the Phase 0 email rail | [emails](product/emails.md), [users](product/users.md) (which messages), [business](product/business.md) (contact email verify) |
| [ ] | 1.9 | Inbox UI against the Phase 0 notification rail | [notifications](product/notifications.md) |

**Exit criteria:** a user can register, create a draft Business under a Company, sign in, toggle into Business mode as Owner, and see empty Manage / Service / Me shells.

---

## Phase 2 — First closed money loop (dine-in)

One venue can sell a served night: menu → open table → send orders → take payment → receipt → close the day. **This is the first “app that earns.”**

| done | Order | Slice | Docs to open |
| --- | --- | --- | --- |
| [ ] | 2.1 | Simple on-menu items: selling price, tax category, categories, add-ons; day-of 86 / sold out. **Defer** full recipe costing and supplier-derived allergens until Phase 5 | [business-goods](product/business-goods.md) |
| [ ] | 2.2 | Served points (table/bar/…); open staff tab; one-open rule; QR can exist unused | [sales-points-and-instances](product/sales-points-and-instances.md) |
| [ ] | 2.3 | Void, invitation, manual discount catalogues live | [operational-reasons](product/operational-reasons.md) |
| [ ] | 2.4 | Draft → send batch, identification code, pricing, void / invitation / cancel, fulfilment slice statuses | [orders](product/orders.md), [operational-reasons](product/operational-reasons.md) |
| [ ] | 2.5 | Business tax rates; **record** cash and card on staff tabs; tips on digital recorded methods; **no** Stripe Connect yet | [payments-and-tax](product/payments-and-tax.md) |
| [ ] | 2.6 | **Dine-in staff POS path only** (open → order → bill → pay → close) | [order-flow](product/order-flow.md), [orders](product/orders.md), [sales-points-and-instances](product/sales-points-and-instances.md), [payments-and-tax](product/payments-and-tax.md) |
| [ ] | 2.7 | Bill and receipt content + numbering; reprint / replacement rules | [receipts-and-bills](product/receipts-and-bills.md) |
| [ ] | 2.8 | Auto-open daily on first send; close day; export can wait | [sales-reports](product/sales-reports.md) |
| [ ] | 2.9 | Audit the controlled acts this phase introduces | [audit-trail](product/audit-trail.md), [operational-reasons](product/operational-reasons.md) |
| [ ] | 2.10 | Live POS / fulfilment / stale-action rejects for this loop | [realtime-and-concurrency](product/realtime-and-concurrency.md), [ADR-0006](adr/0006-realtime-transport-and-concurrency.md) |
| [ ] | 2.11 | Complete go-live for dine-in (on-menu good + served sales point); public discovery can wait | [business](product/business.md) |

**Exit criteria:** Owner/admin can go live for dine-in, run a full table sitting with cash (and recorded card), issue a receipt, and close the daily sales report.

---

## Phase 3 — Floor map and kitchen output

Make the same loop operable for floor staff and prep.

| done | Order | Slice | Docs to open |
| --- | --- | --- | --- |
| [ ] | 3.1 | Manage editor + Service POS map (list/grid fallback) | [floor-plans](product/floor-plans.md), [user-navigation](product/user-navigation.md) (Floor plans / POS destinations) |
| [ ] | 3.2 | Logical printers; prep-area screens; fulfilment gestures; print connector when paper is needed | [printers-and-screens](product/printers-and-screens.md), [ADR-0008](adr/0008-print-connector-path.md) |
| [ ] | 3.3 | Held batches, don’t-make, allergen flags on prep — only what prep surfaces need | [orders](product/orders.md), [order-flow](product/order-flow.md), [printers-and-screens](product/printers-and-screens.md) |

**Exit criteria:** staff can run service from a floor map; kitchen/bar can advance fulfilment without standing at the POS.

---

## Phase 4 — Self-service channels

Same platform, guest-initiated paths and Imperium-processed pay.

| done | Order | Slice | Docs to open |
| --- | --- | --- | --- |
| [ ] | 4.1 | Stripe Connect (venue merchant of record); self-channel capture | [payments-and-tax](product/payments-and-tax.md), [ADR-0005](adr/0005-stripe-connect-direction.md) |
| [ ] | 4.2 | Self-ordering enable; delivery enable + radius / minimum / windows; kiosk payment mode | [business](product/business.md) |
| [ ] | 4.3 | Channel acceptance; reserved hold; virtual Delivery point; self-service instances; handover | [sales-points-and-instances](product/sales-points-and-instances.md) |
| [ ] | 4.4 | QR self-ordering, kiosk, delivery; guest basket; still-there / idle expiry; allergen pre-pay; to-go packaging | [order-flow](product/order-flow.md), [orders](product/orders.md), [payments-and-tax](product/payments-and-tax.md) |
| [ ] | 4.5 | Self-channel age floors on the journey | [privacy](product/privacy.md), [order-flow](product/order-flow.md) |
| [ ] | 4.6 | Guest allergen display + menu filter (if not done in Phase 2) | [business-goods](product/business-goods.md), [order-flow](product/order-flow.md) |
| [ ] | 4.7 | Channel buckets (self-ordering, kiosk, delivery) | [sales-reports](product/sales-reports.md) |
| [ ] | 4.8 | Ordering-session isolation for baskets | [realtime-and-concurrency](product/realtime-and-concurrency.md), [order-flow](product/order-flow.md) |

**Exit criteria:** a guest can complete at least one of QR / kiosk / delivery pay-to-commit; daily report shows channel buckets; staff can fulfil and hand over.

---

## Phase 5 — Supply, stock, and true menu cost

Close the loop from purchase → stock → recipe cost → variance.

| done | Order | Slice | Docs to open |
| --- | --- | --- | --- |
| [ ] | 5.1 | Vendor profile, in-use, contacts | [suppliers](product/suppliers.md) |
| [ ] | 5.2 | Units, price math, budget impact, allergens, par / minimum | [supplier-goods](product/supplier-goods.md) |
| [ ] | 5.3 | Request → receive; inventory increment; one-time purchases; edit-with-reason | [purchases](product/purchases.md), [inventories](product/inventories.md) (increment on receipt only) |
| [ ] | 5.4 | System count, physical counts, monthly resume/close, low/negative stock, variance/waste, Company transfers | [inventories](product/inventories.md), [operational-reasons](product/operational-reasons.md) (count re-edit) |
| [ ] | 5.5 | Recipe / combo components; **derived cost and allergens**; replace any Phase 2 stubs | [business-goods](product/business-goods.md), [supplier-goods](product/supplier-goods.md) |
| [ ] | 5.6 | Low-stock / negative-stock alerts to managers on duty | [notifications](product/notifications.md), [inventories](product/inventories.md) |

**Exit criteria:** receiving a purchase moves stock; selling deducts stock; a physical count closes a period; menu cost/allergens derive from supplier goods.

---

## Phase 6 — People, attendance, and cash responsibility

Workforce planning and the cash the person holds while on duty.

| done | Order | Slice | Docs to open |
| --- | --- | --- | --- |
| [ ] | 6.1 | Full membership: roles, status, contract, pay, vacation, HR docs, terminate / rehire | [employees](product/employees.md) |
| [ ] | 6.2 | Full capability catalogue + assignment UI; supervisor layer day-to-day | [access-and-permissions](product/access-and-permissions.md), [employees](product/employees.md) |
| [ ] | 6.3 | Daily schedule, overlap rules, copy/bulk, time-off, planned labour aggregates | [schedules](product/schedules.md) |
| [ ] | 6.4 | Attendance QR, late lock, breaks, sign-out rules, worked hours, overtime alerts | [time-control](product/time-control.md), [schedules](product/schedules.md), [staff-sessions](product/staff-sessions.md) |
| [ ] | 6.5 | Wallet, peer cash-in, house paid-in/out, cash-out approval, uncashed vs sign-out | [employee-cash-out](product/employee-cash-out.md), [time-control](product/time-control.md) (sign-out blocker) |
| [ ] | 6.6 | Pay periods, earnings from closed attendance, tip pool, CSV release email | [payroll](product/payroll.md), [emails](product/emails.md), [time-control](product/time-control.md) |
| [ ] | 6.7 | Schedule-gated Business entry for employee and supervisor layers | [user-navigation](product/user-navigation.md), [access-and-permissions](product/access-and-permissions.md), [schedules](product/schedules.md), [time-control](product/time-control.md) |
| [ ] | 6.8 | Staff cash collected / cash-out status hooks on the daily | [sales-reports](product/sales-reports.md), [employee-cash-out](product/employee-cash-out.md) |

**Exit criteria:** scheduled staff can enter Business only in the entry window; scan in/out; cash-out before sign-out when required; accountant CSV can be released.

---

## Phase 7 — Revenue extras

| done | Order | Slice | Docs to open |
| --- | --- | --- | --- |
| [ ] | 7.1 | Six types, subcategory scope, overlap rule, real-time apply on tab and basket | [promotions](product/promotions.md), [orders](product/orders.md), [order-flow](product/order-flow.md) |
| [ ] | 7.2 | Issue, redeem, ledger, expiry/forfeit, reporting buckets | [gift-cards](product/gift-cards.md), [ADR-0004](adr/0004-gift-card-liability-and-tax-at-redemption.md), [payments-and-tax](product/payments-and-tax.md), [receipts-and-bills](product/receipts-and-bills.md) |
| [ ] | 7.3 | Booking lifecycle, deposit, multi-table assign, seat → sales instance | [reservations](product/reservations.md), [sales-points-and-instances](product/sales-points-and-instances.md) |
| [ ] | 7.4 | Post-close reviews, receipt/delivery invites, public aggregates, abuse queue hook | [ratings-and-comments](product/ratings-and-comments.md), [receipts-and-bills](product/receipts-and-bills.md), [emails](product/emails.md) |
| [ ] | 7.5 | Gift-card and forfeiture buckets; reservation forfeit if applicable | [sales-reports](product/sales-reports.md), [gift-cards](product/gift-cards.md), [reservations](product/reservations.md) |

**Exit criteria:** each of promotions, gift cards, and reservations can complete one happy path in a live venue; reviews can be left after a closed sitting.

---

## Phase 8 — Management reporting

| done | Order | Slice | Docs to open |
| --- | --- | --- | --- |
| [ ] | 8.1 | Cost targets, waste thresholds, reporting-week start, KPI catalogue | [business-metrics](product/business-metrics.md) |
| [ ] | 8.2 | Weekly and monthly roll-ups, close rules, commission finalisation signal, export | [business-reports](product/business-reports.md), [business-metrics](product/business-metrics.md), [sales-reports](product/sales-reports.md) |
| [ ] | 8.3 | Report-ready events | [notifications](product/notifications.md), [business-reports](product/business-reports.md) |

**Exit criteria:** managers can close a week and a month with figures that match the formulas in business-metrics; weekly close raises commission owed.

---

## Phase 9 — Platform commercial and console

| done | Order | Slice | Docs to open |
| --- | --- | --- | --- |
| [ ] | 9.1 | Plans, entitlements, Free rules, commission definition, freeze rules | [monetization](product/monetization.md) |
| [ ] | 9.2 | Subscription collection, weekly commission collection, dunning, invoices | [platform-billing](product/platform-billing.md), [monetization](product/monetization.md), [business-reports](product/business-reports.md) |
| [ ] | 9.3 | Plan quotas, retention classes, purge vs integrity | [data-retention](product/data-retention.md), [monetization](product/monetization.md) |
| [ ] | 9.4 | Full catalogue + Superadmin toggle semantics | [feature-flags](product/feature-flags.md), [superadmin](product/superadmin.md) |
| [ ] | 9.5 | Separate app/realm: Owners, plans, flags, impersonation, abuse queue, portfolio analytics | [superadmin](product/superadmin.md), [monetization](product/monetization.md), [feature-flags](product/feature-flags.md), [ratings-and-comments](product/ratings-and-comments.md) (abuse queue) |
| [ ] | 9.6 | Compose flag → plan → layer → capability everywhere entitlements matter | [access-and-permissions](product/access-and-permissions.md), [feature-flags](product/feature-flags.md), [monetization](product/monetization.md) |

**Exit criteria:** an Owner is on a plan; weekly commission can be collected or dunned; Superadmin can manage Owners without using venue Business mode.

---

## Phase 10 — Staff collaboration and engagement polish

| done | Order | Slice | Docs to open |
| --- | --- | --- | --- |
| [ ] | 10.1 | Staff 1:1 and group threads; inbox surfacing | [conversations](product/conversations.md), [notifications](product/notifications.md) |
| [ ] | 10.2 | Engagement broadcasts (Promotion / Birthday / Event) gated by marketing consent + mute | [notifications](product/notifications.md), [privacy](product/privacy.md) |
| [ ] | 10.3 | Engagement and manager-to-customer one-shot; catalogue completeness | [emails](product/emails.md), [conversations](product/conversations.md), [privacy](product/privacy.md) |
| [ ] | 10.4 | Favorites and remaining customer-account edges | [users](product/users.md), [user-navigation](product/user-navigation.md) |
| [ ] | 10.5 | DSAR export / erasure flows to the committed floor | [privacy](product/privacy.md), [data-retention](product/data-retention.md), [ADR-0003](adr/0003-soft-delete.md) |

**Exit criteria:** staff can message in-venue; venues can broadcast only with consent; a customer can download or erase per privacy rules.

---

## Dependency sketch (why this order)

```text
Phase 0 rails
    → users / privacy / staff-sessions / business / access / employees / navigation
        → business-goods → sales points → orders → payments (record) → order-flow (dine-in)
            → receipts → daily sales report
                → floor plans / printers
                    → Stripe + self channels
                        → suppliers → supplier-goods → purchases → inventories → recipe goods
                            → schedules → time-control → cash-out → payroll
                                → promotions / gift-cards / reservations / ratings
                                    → metrics → weekly/monthly reports
                                        → monetization → platform-billing → superadmin
                                            → conversations / engagement / DSAR polish
```

Hard rule: **do not** implement monetization freezes, inventory variance, or Superadmin before the Phase 2 money loop works. Those subjects assume sales and tenancy already exist.

---
