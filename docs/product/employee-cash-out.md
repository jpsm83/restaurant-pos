# Employee cash-out

> **About this document.** This is the **target-state source of truth** for employee cash-out in Project Imperium — the personal money wallet a floor worker holds while on duty, the resume of their settled work, and the manager-approved cash-out that clears their financial obligation to the venue. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes employee cash-out as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **how staff-held money and payment proofs become the venue's money** at the end of a slice of work. Floor staff do **not** share a house till. Each on-duty person who takes payments on staff tabs **holds cash and electronic payment proofs themselves** until a **supervisor or above** approves a **cash-out**. It covers:

- the **employee cash session** — the open financial obligation that accumulates while the person is on duty between cash-outs;
- **personal float** as a physical workplace convention (not tracked in the product);
- the **live and draft resume** of unsettled activity (sales, voids, invitations, payment-method totals, expected business cash);
- **cash-out request and approval** — exact match of cash and electronic proofs, blockers, and who may approve;
- the durable numbered **cash-out resume** issued on approval;
- **uncashed activity** as a financial obligation that blocks duty sign-out;
- **post-cash-out corrections** that reopen obligation without rewriting history;
- how cash-out figures **surface on daily sales reporting** (visibility and staff cash collected — not a P&L over/short).

It deliberately does **not** cover:

- **settlement on the bill** — payment methods, splits, partial payments, recorded digital tips, change returned, refunds, and tax belong to the **payments-and-tax** subject. That subject also owns that **Cash** is offered only on staff tabs and that **no tip line** is recorded on a cash payment. This subject consumes those recorded payments to build expected business cash and the resume.
- **sales instances and responsible-employee attribution** — opening, handover, and the one-open rule belong to the **sales-points-and-instances** subject. This subject uses the **responsible employee** at settle time as the wallet owner of that bill's tenders.
- **duty attendance** — scan-in, shift session, breaks, and sign-out mechanics belong to the **time-control** subject. This subject defines **uncashed activity** and the open-instance rule for cash-out; time-control enforces that sign-out is rejected while open instances or uncashed activity remain.
- **customer bills and receipts** — required content and numbering belong to the **receipts-and-bills** subject. A cash-out resume is **not** a customer receipt or bill; this subject owns its identity and numbering.
- **self-ordering, kiosk, and delivery** settlement — those channels are **entirely digital** (no cash). Their money never enters an employee cash session; channel buckets on the daily sales report remain the audit home.
- a **shared house till**, venue-owned **float**, **paid-in / paid-out**, or **no-sale** drawer open — out of scope. With **no financial obligation**, no cash-out is required.
- **tip pooling and payroll packaging** — the **payroll** subject. Only **platform-recorded** (digital) tips enter payroll; off-record cash the employee keeps never appears there.
- **printing and routing** of paper — the **printers-and-screens** subject may print a cash-out resume; this subject owns the document's content and number.
- **operational reason catalogues** — not used for ordinary cash-out approval or rejection.

---

## 2. Domain model and vocabulary

### Entities

- **Employee cash session** — the open financial wallet for one on-duty **Employee** at one **Business**: all **settled, not-yet-cashed** staff-taken activity attributed to them since their last approved cash-out (or since sign-in if they have never cashed out in this duty engagement). It is not the same object as a **shift session**; one shift session may contain **zero or more** cash-outs.
- **Cash-out** — the supervised act that clears an employee cash session: the employee presents cash and electronic proofs; a **supervisor or above** (not the same person) verifies exact match and approves; Project Imperium issues a durable **cash-out resume** and clears the obligation for that window.
- **Cash-out resume** — the durable, numbered document for one approved cash-out. It is the venue's record that the employee has discharged that slice of financial obligation.

### Terms this subject introduces

- **Personal float** — cash the employee brings for making change. It is a **physical convention only**: Project Imperium never asks for, stores, or counts float. Float is never part of **expected business cash** and never becomes venue revenue.
- **Uncashed activity** — settled payments (and related resume figures) that belong to the employee's cash session and have not yet been included in an approved cash-out. Having uncashed activity means the employee still has a **financial obligation** to the business.
- **Financial obligation** — the duty to cash out uncashed activity (and to close or transfer any open sales instances before cash-out or sign-out). Personal float alone is **not** a financial obligation.
- **Expected business cash** — the cash amount the house must receive at cash-out for the uncashed window: the sum of **cash payment amounts applied to bills** (never tip lines — cash payments have none) **minus cash refunds** returned in that window. Personal float is excluded. Off-record cash the guest left above what the house is owed is excluded.
- **Electronic proof** — the physical or device evidence (for example a card-terminal slip) that matches a **non-cash** staff-taken payment in the uncashed window. Self-service Imperium-captured payments never require an employee proof at cash-out.
- **Draft resume** — a live, unnumbered view of the current employee cash session (and optionally a requested cash-out preview). Viewing or requesting a draft does **not** create a cash-out resume number and does **not** clear obligation.
- **Cash-out resume number** — the platform-issued identity of an approved cash-out resume for one Business. Unique within that Business's cash-out resume sequence; never chosen by staff when requesting or approving.
- **Staff cash collected** — the **expected business cash** actually received and recorded on approved cash-outs for a work day or employee; an operational reporting figure, not a P&L variance line.

Terms reused rather than redefined here: **Business**, **Employee**, **Sales instance**, **Responsible employee**, **Staff tab**, **Payment**, **Payment method**, **Cash**, **Tip**, **Refund**, **Void**, **Invitation**, **Shift session**, **On duty**, **Work day**, **Daily sales report**, **business currency**, **soft delete**, **supervisor**, **managers and above**, and **commissionable sales**.

---

## 3. Capabilities

### 3.1 Personal wallet model

- While on duty, an employee who is the **responsible employee** on staff tabs **keeps** the cash and electronic payment proofs for those tabs' settlements with themselves — not in a shared house drawer.
- The employee works normally: open and close tables, take orders, settle bills. Cash and proofs accumulate in their **employee cash session** until cash-out.
- **Self-ordering, kiosk, and delivery** never put cash or proofs into an employee cash session. Those paths are digital end-to-end; payments-and-tax refuses **Cash** on them.
- **Attribution.** The employee who must cash out a bill's tenders is always the **responsible employee on the sales instance** at the moment each payment is taken — not necessarily who opened the tab, unless they are the same person. There is **no split** of one bill's cash-out across two wallets.
- **Handover.** When responsibility for an **open** staff tab moves to another on-duty employee (sales-points-and-instances), later settlements on that tab belong to the **receiver's** cash session. Activity already included in a prior approved cash-out never moves.
- **Personal float.** Each employee brings their own float for change. The product does not configure or count it. At cash-out the house takes only **expected business cash**; the employee keeps float and any off-record cash tips.

### 3.2 What enters the cash session

- A payment enters the taker's employee cash session when:
  - it is **settled** on a **staff tab**;
  - the taker is the **responsible employee** on that sales instance at take time (or, for a staff-taken **gift-card deposit checkout**, the on-duty employee who recorded the tender); and
  - it has not yet been included in an approved cash-out.
- The session accumulates, for the uncashed window at least:
  - **sales** and payment-method totals (cash, card, crypto, gift card, other);
  - **voids** and **invitations** (and related operational figures) on those instances;
  - **tips recorded on digital payments** (for resume clarity and payroll elsewhere — not demanded as cash at cash-out);
  - **expected business cash**;
  - **cash refunds** that reduce expected business cash.
- **Recorded digital tips** stay attributed to the employee under payments-and-tax; they are taxable platform tips. They are **not** part of expected business cash.
- **Cash tips** (guest leaves more cash than the house is owed, or keeps change as tip without recording) are **off-record**: Project Imperium neither records nor taxes them. They do not appear on the cash-out resume as tip lines, do not enter payroll, and do not change expected business cash.

### 3.3 Expected business cash

- **Expected business cash** = sum of **cash** payment **amounts** applied to bills in the uncashed window − **cash refunds** in that window.
- Change returned at settle (payments-and-tax) reduces what the guest left in the employee's hands relative to tender; the **payment amount** on the bill is what the house is owed for that tender. Over-tender on cash is never recorded as a tip line — surplus cash stays with the employee off-record.
- Personal float is never added to or subtracted from expected business cash by the product.

### 3.4 Live resume and draft view

- At any time while on duty, the employee may open a **live resume** of their current employee cash session: sales, voids, invitations, payment-method totals, expected business cash, and whether cash-out is currently blocked.
- **Supervisors and above** may view the same live resume for any on-duty employee at the venue (floor control).
- The employee may **request cash-out**, which presents a **draft resume** for that window. A draft is **not** numbered and does **not** clear obligation.
- Viewing a resume is always allowed even when approval is blocked (for example while tables are still open).

### 3.5 Preconditions for approval

Cash-out **approval** is allowed only when **all** of the following hold:

1. The employee has **uncashed activity** (otherwise there is nothing to cash out — §3.9).
2. The employee holds **no open sales instances** as responsible employee. They must **close** or **transfer** every open tab first. Supervisors and above are **blocked** from approving while any such open instance remains; the product lists the blocking points.
3. **Expected business cash** is matched by the physical cash handed to the approver (exact amount).
4. **Every non-cash** staff-taken payment in the window has a matching **electronic proof** (totals by method match the resume).
5. The **approver** is a different person from the employee cashing out, with effective layer **supervisor**, **manager**, or **admin** at that Business, acting in business mode.

If cash is **short** or electronic proofs **do not match**, approval is **rejected**. There is **no** approved short, **no** business over/short variance line, and **no** silent write-off. Resolution is operational: find the missing cash or proof, correct the upstream bill or payment (reopen the work day first when sales-reports requires it), complete a handover, then retry.

If cash handed is **above** expected business cash, the excess stays with the employee as an **off-record cash tip**. Approval still records only expected business cash as received by the house; the resume may note that surplus was not taken as venue money without creating a tip line.

### 3.6 Approving a cash-out

- The employee presents cash and electronic proofs against the draft resume.
- On approval, Project Imperium:
  - records **staff cash collected** equal to expected business cash for that window;
  - records that electronic method totals were matched;
  - issues a durable **cash-out resume** with a new **cash-out resume number**;
  - clears **uncashed activity** for that window so the employee has **no financial obligation** from it;
  - audits who requested (if applicable), who approved, and when.
- After a successful cash-out the employee may **continue working** on the same shift session: open new tables, take new payments. New settled activity starts a **new** uncashed window and will require another cash-out before sign-out.
- An employee cannot approve their own cash-out.

### 3.7 Cash-out resume content and numbering

- An approved **cash-out resume** carries at least:
  - venue identity (trade name and enough to know which Business);
  - employee identity;
  - work day and time window covered;
  - sales, voids, invitations, and other resume operational totals for that window;
  - payment-method totals (cash, card, crypto, gift card, other) for that window;
  - **expected business cash** and **staff cash collected** (equal on approval);
  - confirmation that electronic proofs matched (by method);
  - recorded **digital tip** totals in the window (informational; already on payments);
  - explicit statement that **off-record cash tips** are not included;
  - **cash-out resume number**;
  - approver and approval time.
- **Cash-out resume numbers** are issued by the platform, unique per Business sequence, never reused, and never equal to a customer bill or receipt number.
- A **reprint** of an unchanged cash-out resume keeps the same number and is marked as a reprint. There is no “replacement” path that mutates an approved resume when upstream payments later change — corrections follow §3.8.
- Draft / live resumes have **no** number.

### 3.8 Post-cash-out corrections

- An approved cash-out resume is **durable** and is never silently rewritten.
- If a payment that was included in a cash-out is later **refunded or amended** (including after a work-day reopen), Project Imperium creates a **new financial obligation** on the same employee for the correcting amount (cash to return to the house, proof adjustment, or a further cash-out / supervised settlement). The original resume remains on file; the correction is a new audited event and appears on a later resume or correction record.
- Upstream bill and payment rules (payments-and-tax, sales-reports) still apply; this subject only states that cash-out history stays append-only from the wallet's point of view.

### 3.9 When cash-out is not required

- If the employee has **no uncashed activity**, they have **no financial obligation** from this subject. They do **not** need a cash-out.
- Personal float never creates an obligation by itself.
- Duty **sign-out** still requires **no open sales instances** (time-control). With no open instances and no uncashed activity, a manager-layer user may sign them out without any cash-out step.

### 3.10 Sign-out interaction

- Duty sign-out is **rejected** while either:
  - the employee is responsible for any **open sales instance**, or
  - the employee has **uncashed activity**.
- There is **no** force-sign-out that bypasses financial obligation.
- Time-control owns the sign-out action and the rejection UX; this subject owns what counts as uncashed activity.

### 3.11 Reporting hooks

- **Daily sales report** (and roll-ups that consume it) continues to derive sales, payment-method, void, invitation, and recorded tip figures from bills and payments — not from cash-out resumes.
- In addition, the day surfaces **staff cash collected** from approved cash-outs and **cash-out / uncashed** status per employee for supervisors and above (floor control). Employees see their own status.
- Closing the daily sales report still does **not** require a cash-out or cash attestation (sales-reports). Cash-out and day close are **independent**.
- There is **no** business **over/short** variance line from cash-out. Shortfalls never approve; surplus cash is not venue revenue.
- Off-record cash tips never appear in sales, commissionable sales, or payroll.

### 3.12 Retention

- Cash-out resumes and approval audits are **business records** under the platform's soft-delete and legal/financial retention class. Operators do not physically remove them in ordinary use.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Employee cash-out powers |
| --- | --- |
| **Customer** | None. |
| **Employee** | Holds their own wallet while on duty; views own live/draft resume; requests cash-out; presents cash and proofs. Cannot approve any cash-out. |
| **Supervisor** | Everything an employee can do for their own wallet, plus view any on-duty employee's resume, and **approve** another person's cash-out when preconditions hold. Schedule-gated like other supervisor Service powers. |
| **Manager** | Same approval and visibility powers as supervisor; not schedule-gated for Business entry. |
| **Admin/owner** | Everything a manager can do. |

Approve cash-out is a **supervisor-and-above layer default** (access-and-permissions). No separate per-user catalogue capability is required.

### Who can do what

| Activity | Who |
| --- | --- |
| View own live or draft resume | The on-duty employee (and supervisors+ viewing them) |
| Request cash-out | The employee whose session it is |
| Approve cash-out | A **different** person with effective layer supervisor, manager, or admin |
| Reject cash-out (mismatch / open tables) | Automatic when preconditions fail; approver may decline after inspection |
| Sign out while uncashed or with open instances | Nobody — blocked (time-control enforces) |
| Configure personal float in the product | Nobody — float is physical-only |
| Record a tip on a cash payment | Nobody — payments-and-tax forbids it |
| Take cash on self-service channels | Nobody — payments-and-tax forbids Cash there |
