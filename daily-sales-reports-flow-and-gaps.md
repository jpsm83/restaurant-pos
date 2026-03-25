# Daily sales reports — current behavior, gaps, and recommendations

This document describes how **daily sales reports** work in the product **today**, at **flow and behavior level only** (no implementation code). It is meant for discussion before any code changes.

---

## 1. Purpose in the restaurant product

The daily sales report represents an **operational “business day”** for one restaurant (one `businessId`), not necessarily a calendar midnight-to-midnight day. Shifts can cross midnight; the report stays **open** until management **closes** it after reconciling activity.

It serves as:

- The **anchor** for correlating sales instances, orders, and rollups for that period (via a shared reference number).
- A container for **per-employee** performance slices, **delivery** aggregation, and **self-order** customer slices.
- The source of **business-level totals** (revenue, COGS, tips, void/invite, payment mix, POS commission) after a **calculate** step.
- An input into **monthly** business reporting (triggered after calculate).

---

## 2. Core concept: `dailyReferenceNumber`

- When no **open** daily report exists for a business, the system can **create** a new report. The new report gets a numeric **`dailyReferenceNumber`** (created from current time at creation).
- That same number is stored on **sales instances** and **orders** created during that open period so all activity for the “day” can be queried together.
- **Closing** the report sets it to not open; the next period gets a **new** report and a **new** reference number when something triggers creation again.

**Intent:** avoid tying the “day” only to calendar dates when real operations span two calendar days.

---

## 3. What the report document contains (conceptual)

At a high level, one daily report holds:

| Area | Role |
|------|------|
| **Identity & lifecycle** | Reference number, open/closed flag, business link, optional “countdown” timestamp used as a conceptual deadline (see gaps). |
| **`employeesDailySalesReport`** | One row per staff user who has been tracked for that day (opened tables as employee, etc.): payments, gross/net, tips, COGS, customers served, sold/void/invited goods, flags for open instances. Attribution is tied to **who is responsible** for the table/instance, not only who punched the first order. |
| **`deliveryDailySalesReport`** | A **single** aggregated bucket for all delivery activity for that reference period (same “shape” as an employee row for UI compatibility; see gaps). |
| **`selfOrderingSalesReport`** | Entries for **customer** self-order checkouts (payment-oriented snapshot: customer, payment methods, totals, sold goods). |
| **Top-level rollups** | After **calculate**: merged payment methods, daily totals (sales, net, tips, COGS, profit, customers, averages), combined sold/void/invited goods, void/invite value totals, POS commission derived from business subscription tier. |

---

## 4. How a new open report appears (creation flow)

- There is **no** separate public “start my business day” step in the described API surface; creation is **implicit** when other flows need a day key.
- When transactional flows (e.g. opening a table from POS, QR open-table, reservation seating that creates an instance, delivery/self-order paths that need a day) run, they:
  - Look for a report with **open** status for that business.
  - If none exists, they **create** one (inside the same database transaction where applicable) and use its **`dailyReferenceNumber`** on new instances and orders.

**User impact:** The “day” starts when the first qualifying operation runs, not necessarily when a manager clicks a button.

---

## 5. Employee slice: how rows get there and how they refresh

- When an **employee** opens a sales instance (POS / staff flow), the system ensures that user appears on the daily report’s **employee** list with a “has open activity” style flag where applicable.
- **Calculate** (management) rebuilds **employee** metrics by scanning **sales instances** for that `dailyReferenceNumber` where the **responsible** user matches each employee row, walking **order groups** and **orders** to accumulate payments, money totals, tips, COGS, and goods classified by billing outcome (paid vs void vs invitation where the logic applies).

**User impact:** Shift handoffs and “who closes the bill” matter for **whose** row accumulates table-level totals; comments in the domain suggest preferring closed tables at shift change for cleaner per-person analytics.

---

## 6. Delivery slice

- If the business has a **delivery** sales point, **calculate** runs a **delivery-specific** aggregation: all instances on that point for the reference period are rolled into **one** `deliveryDailySalesReport` bucket.
- That bucket is then merged into the **business-level** totals on the same run as employee rows.

**User impact:** Delivery appears as one line in the UI model, not one row per driver/customer in that bucket.

---

## 7. Self-order slice

- Customer **self-order** completion (pay at QR) appends structured data to **`selfOrderingSalesReport`** on the daily document (customer, payment, totals, goods).
- This path is **separate** from the employee aggregation, which keys off **responsible employee** on instances.

**User impact:** Self-order history is visible on the document for that array; how it feeds **top-level daily totals** is a known consistency topic (see gaps).

---

## 8. Management: “calculate business report” flow

1. Authenticated user must be **management** (by current shift role).
2. Load the target daily report and business context (including subscription for commission).
3. **Refresh employee reports** from live sales/order data for that `dailyReferenceNumber`; persist updated employee array on the report.
4. If a delivery point exists, **refresh delivery bucket** the same way; merge into in-memory business rollup.
5. **Aggregate** employee rows (and delivery bucket) into **daily totals**: payment mix, sales, net, tips, COGS, profit, customers, averages, combined goods, void/invite values, **POS commission** from subscription tier.
6. **Persist** those top-level fields (and delivery bucket) on the daily report document.
7. **Trigger monthly aggregation** asynchronously (errors logged; day close does not wait on completion).

**User impact:** Numbers on the report are “as of last successful calculate.” Partial errors can return a **multi-status** style response indicating some slices failed.

---

## 9. Management: “close daily report” flow

1. Authenticated **management** user.
2. Verify there are **no orders** still in **open billing** state for that business **and** that `dailyReferenceNumber`.
3. Set the report to **closed** (no longer open).

**User impact:** After close, the period is fixed for “open day” semantics; new activity should bind to a **new** reference when the next creation happens.

---

## 10. Other API behaviors (read / maintenance)

- **List all reports** and **get by id** (populated names for users in nested arrays).
- **List by business** with optional **date range** on report **creation** timestamps (not the same as “business day” boundaries—see gaps).
- **Delete report by id** exists as an endpoint (product/security implications).
- **Calculate users report** endpoint can refresh a subset of users for a report (authorization posture should be reviewed for production).

---

## 11. Downstream: monthly report

- After a successful **calculate business report**, the system kicks off **monthly** aggregation for that business in the background so the open monthly picture can incorporate the updated daily figures without a second user action.

---

## 12. Documented gaps (current state)

These are **behavioral or product** gaps to resolve through discussion, not implementation detail.

1. **Self-order vs executive totals**  
   Top-level daily totals on calculate are built from **employee** + **delivery** slices. **`selfOrderingSalesReport`** entries are stored on the document but are **not** clearly folded into those executive totals in the same step. Risk: **under-reported** revenue/COGS for days with material QR self-order volume unless double-counted elsewhere.

2. **Order billing status vs money totals on employee refresh**  
   Employee aggregation adds money lines from orders in groups; **goods** buckets respect paid/void/invitation, but **money totals** may include lines that are not in a “final” billing state depending on implementation. **Close** already blocks while **any** open billing orders exist for the reference, which limits the window but the **exact definition** of “what counts in net/gross for a line” should be explicit for owners and accountants.

3. **`dailyReferenceNumber` uniqueness**  
   Uniqueness is **global** across all businesses. Theoretical collision if two tenants create a report in the same millisecond; also mixes tenant namespaces in one constraint.

4. **`timeCountdownToClose`**  
   Stored as a future timestamp (e.g. 24h after creation). No described **automatic** close or user-facing enforcement tied to it in the current flow description—may be **unused** or **future** behavior; if the UI mentions it, alignment is needed.

5. **Delivery bucket shape**  
   Delivery aggregation reuses the **employee** row shape and overloads **`userId`** to carry a **sales point** identifier for compatibility. Clients and future maintainers can misread that field as a person.

6. **Date filters on “by business” list**  
   Filtering uses report **document creation** time, which may **not** align with operational “business day” if creation is early morning or delayed. Owners may expect filter by **reference period** or **close time**.

7. **Authorization on sensitive routes**  
   Some read/delete/recalculate-by-user paths may not match the same **management-only** bar as calculate/close. For a real deployment, **who can see or delete** a day’s financial summary must be intentional.

8. **Idempotency and partial failure**  
   Calculate can leave the document in an **intermediate** state if a step fails mid-way; retry is the recovery path. For audit-minded users, you may want a clearer **“last successful calculate at”** or **version** story.

9. **Schema comments vs reality**  
   Minor: embedded “goods” subdocuments are described in places as tied to the wrong conceptual model (e.g. order vs menu item), which confuses onboarding.

---

## 13. Recommendations (for discussion before coding)

| # | Recommendation | Rationale |
|---|----------------|-----------|
| R1 | **Decide and document** whether **self-order** revenue must appear in **daily totals**, and implement one consistent rule (include in rollup, or show as separate “channel” totals that sum to “true day”). | Avoids silent under-reporting or double counting. |
| R2 | **Define accounting rules** for employee (and delivery) totals: e.g. only **Paid** (and optionally other closed states) count toward net/gross/COGS; **Open** never counts until paid—aligned with close rules. | Makes numbers match manager intuition and audit. |
| R3 | **Replace or supplement** global unique `dailyReferenceNumber` with a **per-business** unique constraint or opaque id, if you keep a numeric display key at all. | Safer multi-tenant behavior. |
| R4 | **Either enforce** `timeCountdownToClose` (notifications, auto-close policy, or hard block) **or remove** it from UX/docs until used. | Reduces confusion. |
| R5 | **Evolve API shape** for delivery: explicit `deliverySalesPointId` or `channel: "delivery"` instead of overloading `userId`. | Clearer integrations and reporting. |
| R6 | **Clarify list filters**: document whether filters are by **createdAt**, **closedAt**, or add filters by **`dailyReferenceNumber` / period**. | Correct operational reporting. |
| R7 | **Harden authz**: align all mutating and sensitive read endpoints with **roles** (and tenant scoping); remove or protect **delete** and **global list** if not needed. | Production security and compliance. |
| R8 | **Optional**: expose **last calculate timestamp** and/or **calculation job status** for support and trust. | Transparency when async monthly work fails silently in logs. |
| R9 | **Clean up schema/documentation** comments for embedded goods (what ID means, what “quantity” means per order line model). | Faster onboarding and fewer bugs. |

---

## 14. How to use this doc

- Use **sections 1–11** as the **agreed “as-is” story** for workshops with product and ops.
- Use **section 12** to track **decisions** (“accepted risk” vs “must fix”).
- Use **section 13** as a **backlog of product/technical decisions**; reorder by your risk tolerance (financial accuracy and auth usually first).

When this matches your intent, you can adapt the file and then implement changes in code in a separate pass.
