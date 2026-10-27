# Employee cash-out

> **About this document.** This is the **target-state source of truth** for employee cash-out in Project Imperium — the personal money wallet a floor worker holds while on duty, cash movements that rearrange who holds house-owed cash, the resume of their settled work, and the supervisor-or-above-approved cash-out that clears their financial obligation to the venue. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes employee cash-out as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **how staff-held money and payment proofs become the venue's money** at the end of a slice of work, and **how expected business cash can move** between on-duty wallets or between a wallet and the house before that. Floor staff do **not** share a house till object in the product. Each on-duty person who takes payments on staff tabs **holds cash and electronic payment proofs themselves** until a **supervisor or above** approves a **cash-out**. A physical **cash drawer** is not a money object and never changes this: it is a hardware latch wired to a receipt printer at the station, and the **printers-and-screens** subject owns opening it. It covers:

- the **employee cash session** — the open financial obligation that accumulates while the person is on duty between cash-outs;
- **personal float** as a physical workplace convention (not tracked in the product);
- **peer cash-in** — receiver-recorded cash-only transfer of expected business cash between two on-duty employees (optional per Business);
- **house paid-in** and **house paid-out** — supervisor-recorded cash movements between an on-duty employee's wallet and the house (always available);
- **cash-movement receipts** — numbered documents, print-with-backup, in-app notifications, and reverses;
- the **live and draft resume** of unsettled activity (sales, voids, invitations, payment-method totals, cash movements, expected business cash);
- **cash-out request and approval** — exact match of remaining cash, electronic proofs, and movement receipts, blockers, and who may approve;
- the durable numbered **cash-out resume** issued on approval;
- **uncashed activity** as a financial obligation that blocks duty sign-out;
- **post-cash-out corrections** that reopen obligation without rewriting history;
- how cash-out and cash-movement figures **surface on daily sales reporting** (visibility and staff cash collected — not a P&L over/short).

It deliberately does **not** cover:

- **settlement on the bill** — payment methods, splits, partial payments, recorded digital tips, change returned, refunds, and tax belong to the **payments-and-tax** subject. That subject also owns that **Cash** is offered only on staff tabs and that **no tip line** is recorded on a cash payment. This subject consumes those recorded payments to build expected business cash and the resume.
- **sales instances and responsible-employee attribution** — opening, handover, and the one-open rule belong to the **sales-points-and-instances** subject. This subject uses the **responsible employee** at settle time as the wallet owner of that bill's tenders.
- **duty attendance** — scan-in, shift session, breaks, and sign-out mechanics belong to the **time-control** subject. This subject defines **uncashed activity** and the open-instance rule for cash-out; time-control enforces that sign-out is rejected while open instances or uncashed activity remain.
- **customer bills and receipts** — required content and numbering belong to the **receipts-and-bills** subject. A cash-out resume and a cash-movement receipt are **not** customer receipts or bills; this subject owns their identity and numbering.
- **self-ordering, kiosk, and delivery** settlement — those channels are **entirely digital** (no cash). Their money never enters an employee cash session; channel buckets on the daily sales report remain the audit home.
- a **shared house till** object or venue-owned **float** count — out of scope. A **cash drawer** is not a shared till: it is a hardware latch wired to a receipt printer, and it has **no cash session, balance, expected cash, or obligation** in this subject. Drawer hardware, the **drawer kick**, the per-staff **closing receipt printer override**, and **manual open** belong to **printers-and-screens**. House paid-in/out move cash against a **person's wallet** and the **Business** as counterparty without modelling a till balance in the product. With **no financial obligation**, no cash-out is required.
- **tip pooling and payroll packaging** — the **payroll** subject. Only **platform-recorded** (digital) tips enter payroll; off-record cash the employee keeps never appears there.
- **printing and routing** of paper — the **printers-and-screens** subject prints cash-out resumes and cash-movement receipts (primary then backup); this subject owns each document's content and number, and when a movement is complete.
- **in-app notification delivery** — the **notifications** subject delivers inbox events this subject raises for cash movements.
- storing the **peer cash transfer** Business setting — the **business** subject holds that switch; this subject owns what the switch enables.
- the five closed **operational reason catalogues** (void, invitation, manual discount, refund, count re-edit) — the **operational-reasons** subject. House paid-in/out may carry an **optional** reason owned by this subject; ordinary cash-out approval or rejection does not use a reason catalogue. Peer cash-in needs no reason.

---

## 2. Domain model and vocabulary

### Entities

- **Employee cash session** — the open financial wallet for one on-duty **Employee** at one **Business**: all **settled, not-yet-cashed** staff-taken activity attributed to them since their last approved cash-out (or since sign-in if they have never cashed out in this duty engagement), including **cash movements** in that window. It is not the same object as a **shift session**; one shift session may contain **zero or more** cash-outs and **zero or more** cash movements.
- **Cash-out** — the supervised act that clears an employee cash session: the employee presents remaining cash, electronic proofs, and cash-movement receipts; a **supervisor or above** (not the same person) verifies exact match and approves; Project Imperium issues a durable **cash-out resume** and clears the obligation for that window.
- **Cash-out resume** — the durable, numbered document for one approved cash-out. It is the venue's record that the employee has discharged that slice of financial obligation.
- **Cash movement** — a recorded rearrangement of **expected business cash** only: a **peer cash-in**, a **house paid-in**, a **house paid-out**, or a **reverse** of one of those. Digital payment totals and electronic proofs never move with a cash movement.
- **Cash-movement receipt** — the durable, numbered document issued when a cash movement completes. It is the paper and system proof staff attach for cash-out and for audit.

### Terms this subject introduces

- **Personal float** — cash the employee brings for making change. It is a **physical convention only**: Project Imperium never asks for, stores, or counts float. Float is never part of **expected business cash** and never becomes venue revenue.
- **Uncashed activity** — settled payments, related resume figures, and/or cash movements that belong to the employee's cash session and have not yet been included in an approved cash-out. Having uncashed activity means the employee still has a **financial obligation** to the business — including when the only obligation is cash received via peer cash-in or house paid-out.
- **Financial obligation** — the duty to cash out uncashed activity (and to close or transfer any open sales instances before cash-out or sign-out). Personal float alone is **not** a financial obligation.
- **Expected business cash** — the cash amount the house must receive from this employee at cash-out for the uncashed window after cash movements: cash payment amounts applied to bills (never tip lines) **minus** cash refunds, **plus** peer cash-ins received and house paid-outs, **minus** peer cash transferred out and house paid-ins. Personal float is excluded. Off-record cash the guest left above what the house is owed is excluded.
- **Electronic proof** — the physical or device evidence (for example a card-terminal slip) that matches a **non-cash** staff-taken payment in the uncashed window. Self-service Imperium-captured payments never require an employee proof at cash-out. Electronic proofs **stay with the original payment taker**; peer and house cash movements never reassign them.
- **Peer cash-in** — a cash-only transfer of expected business cash from a **paying employee** to a **receiving employee**, recorded on POS by the **receiver**. Used so venues can pool cash into one person's wallet while each original taker still cashes out their own digital proofs. The "main cash bucket" person is a **workplace convention**, not a special system role.
- **House paid-in** — cash moved from an on-duty employee's wallet to the **house** (office/safe/physical house cash), reducing that employee's expected business cash.
- **House paid-out** — cash moved from the **house** into an on-duty employee's wallet (wallet top-up / house cash held by that person), increasing that employee's expected business cash. Not for tips, wages, or supplier payments.
- **Paying employee** — on a peer cash-in, the on-duty employee whose expected business cash decreases and who receives the cash-movement receipt to attach at cash-out.
- **Receiving employee** — on a peer cash-in, the on-duty employee who records the movement, whose expected business cash increases, and who physically takes the cash.
- **Draft resume** — a live, unnumbered view of the current employee cash session (and optionally a requested cash-out preview). Viewing or requesting a draft does **not** create a cash-out resume number and does **not** clear obligation.
- **Cash-out resume number** — the platform-issued identity of an approved cash-out resume for one Business. Unique within that Business's cash-out resume sequence; never chosen by staff when requesting or approving.
- **Cash-movement receipt number** — the platform-issued identity of a completed cash movement for one Business. Unique within that Business's **cash-movement** sequence (shared by peer cash-in, house paid-in, house paid-out, and reverses); separate from cash-out resume numbers and from customer bill/receipt numbers.
- **Staff cash collected** — the **expected business cash** actually received and recorded on approved **cash-outs** for a work day or employee (cash handed to the approver at cash-out). House paid-ins are separate operational audit that cash reached the house earlier; they are not sales lines and do not create an over/short P&L variance.
- **Peer cash transfer setting** — a per-Business switch (default **on**) that enables or disables peer cash-in. House paid-in/out have **no** off switch; they are always available.

Terms reused rather than redefined here: **Business**, **Employee**, **Sales instance**, **Responsible employee**, **Staff tab**, **Payment**, **Payment method**, **Cash**, **Tip**, **Refund**, **Void**, **Invitation**, **Shift session**, **On duty**, **Work day**, **Daily sales report**, **business currency**, **soft delete**, **supervisor**, **managers and above**, and **commissionable sales**.

---

## 3. Capabilities

### 3.1 Personal wallet model

- While on duty, an employee who is the **responsible employee** on staff tabs **keeps** the cash and electronic payment proofs for those tabs' settlements with themselves. A **cash drawer** may physically hold that cash, but it is not a wallet, a till balance, or a second obligor: the employee's **employee cash session** remains the only obligation, and the drawer has no state in this subject (printers-and-screens).
- The employee works normally: open and close tables, take orders, settle bills. Cash and proofs accumulate in their **employee cash session** until cash-out, unless cash obligation is moved by a cash movement.
- **Cash follows the closer.** Whoever is the **responsible employee** when a staff tab is settled owns that settlement's cash and proofs, whether they close at the table or at a counter. A drawer wired to the receipt printer serving their closure may open as a hardware convenience; it never reassigns the money, the proofs, or the obligation. A staff member with no drawer closes into their own wallet exactly as before.
- **Self-ordering, kiosk, and delivery** never put cash or proofs into an employee cash session. Those paths are digital end-to-end; payments-and-tax refuses **Cash** on them.
- **Attribution.** The employee who must cash out a bill's tenders is always the **responsible employee on the sales instance** at the moment each payment is taken — not necessarily who opened the tab, unless they are the same person. There is **no split** of one bill's cash-out across two wallets. Cash movements move **expected business cash only**, never bill attribution or electronic proofs.
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
  - **cash movements** (peer and house) with receipt numbers;
  - **expected business cash** after those movements;
  - **cash refunds** that reduce expected business cash.
- **Recorded digital tips** stay attributed to the employee under payments-and-tax; they are taxable platform tips. They are **not** part of expected business cash.
- **Cash tips** (guest leaves more cash than the house is owed, or keeps change as tip without recording) are **off-record**: Project Imperium neither records nor taxes them. They do not appear on the cash-out resume as tip lines, do not enter payroll, and do not change expected business cash.

### 3.3 Expected business cash

- **Expected business cash** for the uncashed window =
  - sum of **cash** payment **amounts** applied to bills
  - **minus** **cash refunds**
  - **plus** peer cash-ins **received** and house **paid-outs**
  - **minus** peer cash **transferred out** and house **paid-ins**.
- Change returned at settle (payments-and-tax) reduces what the guest left in the employee's hands relative to tender; the **payment amount** on the bill is what the house is owed for that tender. Over-tender on cash is never recorded as a tip line — surplus cash stays with the employee off-record.
- Personal float is never added to or subtracted from expected business cash by the product.
- Cash movements never change payment-method sales totals or electronic-proof obligations on the original taker.

### 3.4 Peer cash-in

- **Peer cash transfer setting.** Each Business has a **peer cash transfer** switch, default **on**, edited under business configuration (business subject). When **off**, staff cannot record peer cash-in; everyone cashes out their own remaining cash and proofs. House paid-in/out stay available regardless.
- When the setting is **on**, any **on-duty Employee** at that Business may record a **peer cash-in** on POS as the **receiving employee**.
- The receiver **controls** the recording: they select the **paying employee** (or scan that person's staff identity), enter the **amount**, and complete the movement. There is **no** separate accept/decline step for the payer in the app. The payer physically hands over the cash; the product attaches the movement to the payer's **current open employee cash session**.
- **Self** peer cash-in is blocked. Payer and receiver must both be **on duty** at the **same Business** at record time. The receiver may have had **zero** expected business cash before the receive.
- Amount may be **partial or full** relative to the payer's current expected business cash, and **never more** than that amount.
- Completing the movement:
  - decreases the payer's expected business cash and increases the receiver's by the same amount;
  - issues a **cash-movement receipt number**;
  - attempts print on the configured receipt path, then the **backup printer** if the primary fails (printers-and-screens);
  - notifies **both** the payer and the receiver in-app with amount, counterparties, and receipt number (notifications subject);
  - finalizes even if physical print fails, so long as the number is issued and both notifications are sent; reprint of the same number remains available.
- The printed (or reprinted) receipt is handed to the **paying employee** to attach with their cash-out pack.
- Open sales instances do **not** block peer cash-in. They still block cash-out approval and sign-out.

### 3.5 House paid-in and paid-out

- House paid-in and paid-out are **always available** (no Business off switch). They are ordinary industry cash control against personal wallets, not a shared till balance in the product.
- Only a **supervisor, manager, or admin** may record house paid-in or paid-out, and only against **another** on-duty employee's wallet — never their own.
- The affected employee must be **on duty** at that Business at record time. They may have had **zero** expected business cash before a paid-out.
- **House paid-in** amount may be partial or full relative to the employee's current expected business cash, and **never more** than that amount.
- **House paid-out** increases expected business cash by the amount recorded. It is only for putting **business cash into that person's wallet** (change fund / house cash held by them). It is not tips, wages, payroll advances, or supplier payments.
- An **optional** reason may be recorded (small closed list owned by this subject, plus optional note when the reason is Other). A reason is **not required** to complete the movement. Peer cash-in has no reason field.
- Completing the movement uses the same receipt, print-with-backup, number-plus-notification completion, and reprint rules as peer cash-in. Notifications go to the **affected employee** and the **supervisor+ who recorded** it. The printed (or reprinted) receipt is handed to the **affected employee** for their cash-out pack.
- Open sales instances do **not** block house paid-in/out.

### 3.6 Cash-movement receipt content and numbering

- A completed cash-movement receipt carries at least:
  - venue identity;
  - movement kind (peer cash-in, house paid-in, house paid-out, or reverse of one of those);
  - amount in business currency;
  - paying and receiving employees (peer) or affected employee and recording supervisor+ (house);
  - optional house reason when present;
  - **cash-movement receipt number**;
  - date and time.
- **Cash-movement receipt numbers** are issued by the platform, unique per Business cash-movement sequence, never reused, and never equal to a cash-out resume number or a customer bill or receipt number.
- A **reprint** keeps the same number and is marked as a reprint.

### 3.7 Reversing a cash movement

- There is **no silent edit** after a movement completes.
- A wrong peer cash-in or house movement is corrected only by a **supervisor+ reverse** that issues its **own** cash-movement receipt number and notifications, leaving a full audit trail. Ordinary peer cash-in by floor staff is not the correction path for a prior mistake.
- Movements that already sit inside an **approved cash-out** window are **frozen** with that resume. They are not editable and not reversible into the closed window. A mistake found later is handled by a **new** house movement or peer cash-in on the employee's **current** open session (same append-only spirit as post-cash-out payment corrections).

### 3.8 Live resume and draft view

- At any time while on duty, the employee may open a **live resume** of their current employee cash session: sales, voids, invitations, payment-method totals, **cash in** (peer received + house paid-out), **cash out** (peer sent + house paid-in) with movement receipt numbers, **net expected business cash**, and whether cash-out is currently blocked.
- **Supervisors and above** may view the same live resume for any on-duty employee at the venue (floor control).
- The employee may **request cash-out**, which presents a **draft resume** for that window. A draft is **not** numbered and does **not** clear obligation.
- Viewing a resume is always allowed even when approval is blocked (for example while tables are still open).

### 3.9 Preconditions for approval

Cash-out **approval** is allowed only when **all** of the following hold:

1. The employee has **uncashed activity** (otherwise there is nothing to cash out — §3.13).
2. The employee holds **no open sales instances** as responsible employee. They must **close** or **transfer** every open tab first. Supervisors and above are **blocked** from approving while any such open instance remains; the product lists the blocking points.
3. **Expected business cash** (after cash movements) is matched by the physical cash handed to the approver (exact amount).
4. **Every non-cash** staff-taken payment in the window has a matching **electronic proof** (totals by method match the resume).
5. Cash-movement receipts for movements in the window are present in the pack the employee presents (so the approver can reconcile why cash is lower or higher than bill cash alone).
6. The **approver** is a different person from the employee cashing out, with effective layer **supervisor**, **manager**, or **admin** at that Business, acting in business mode.

If cash is **short** or electronic proofs **do not match**, approval is **rejected**. There is **no** approved short, **no** business over/short variance line, and **no** silent write-off. Resolution is operational: find the missing cash or proof, correct the upstream bill or payment (reopen the work day first when sales-reports requires it), complete or reverse a cash movement, complete a handover, then retry.

If cash handed is **above** expected business cash, the excess stays with the employee as an **off-record cash tip**. Approval still records only expected business cash as received by the house; the resume may note that surplus was not taken as venue money without creating a tip line.

A common pattern: the employee has transferred all expected business cash to a peer (or paid it into the house) and cashes out with **digital proofs plus cash-movement receipts** and **zero** (or residual) cash. That is allowed when preconditions hold.

### 3.10 Approving a cash-out

- The employee presents remaining cash, electronic proofs, and cash-movement receipts against the draft resume.
- On approval, Project Imperium:
  - records **staff cash collected** equal to expected business cash for that window (cash handed at cash-out);
  - records that electronic method totals were matched;
  - includes the window's cash movements on the durable resume;
  - issues a durable **cash-out resume** with a new **cash-out resume number**;
  - clears **uncashed activity** for that window so the employee has **no financial obligation** from it;
  - audits who requested (if applicable), who approved, and when.
- After a successful cash-out the employee may **continue working** on the same shift session: open new tables, take new payments, record new cash movements. New settled activity starts a **new** uncashed window and will require another cash-out before sign-out.
- An employee cannot approve their own cash-out.

### 3.11 Cash-out resume content and numbering

- An approved **cash-out resume** carries at least:
  - venue identity (trade name and enough to know which Business);
  - employee identity;
  - work day and time window covered;
  - sales, voids, invitations, and other resume operational totals for that window;
  - payment-method totals (cash, card, crypto, gift card, other) for that window;
  - **cash in** / **cash out** movement totals and cash-movement receipt numbers in the window;
  - **expected business cash** and **staff cash collected** (equal on approval);
  - confirmation that electronic proofs matched (by method);
  - recorded **digital tip** totals in the window (informational; already on payments);
  - explicit statement that **off-record cash tips** are not included;
  - **cash-out resume number**;
  - approver and approval time.
- **Cash-out resume numbers** are issued by the platform, unique per Business sequence, never reused, and never equal to a customer bill or receipt number or a cash-movement receipt number.
- A **reprint** of an unchanged cash-out resume keeps the same number and is marked as a reprint. There is no “replacement” path that mutates an approved resume when upstream payments later change — corrections follow §3.12.
- Draft / live resumes have **no** number.

### 3.12 Post-cash-out corrections

- An approved cash-out resume is **durable** and is never silently rewritten.
- If a payment that was included in a cash-out is later **refunded or amended** (including after a work-day reopen), Project Imperium creates a **new financial obligation** on the same employee for the correcting amount (cash to return to the house, proof adjustment, or a further cash-out / supervised settlement). The original resume remains on file; the correction is a new audited event and appears on a later resume or correction record.
- Upstream bill and payment rules (payments-and-tax, sales-reports) still apply; this subject only states that cash-out history stays append-only from the wallet's point of view.
- Cash movements inside a closed window stay on that resume; further fixes use new movements on the current open session (§3.7).

### 3.13 When cash-out is not required

- If the employee has **no uncashed activity**, they have **no financial obligation** from this subject. They do **not** need a cash-out.
- Personal float never creates an obligation by itself.
- Receiving peer cash-in or house paid-out **does** create uncashed activity until that window is cashed out — even with no sales — and therefore blocks sign-out until cash-out.
- Duty **sign-out** still requires **no open sales instances** (time-control). With no open instances and no uncashed activity, a manager-layer user may sign them out without any cash-out step.

### 3.14 Sign-out interaction

- Duty sign-out is **rejected** while either:
  - the employee is responsible for any **open sales instance**, or
  - the employee has **uncashed activity**.
- There is **no** force-sign-out that bypasses financial obligation.
- Time-control owns the sign-out action and how rejection is shown; this subject owns what counts as uncashed activity.

### 3.15 Reporting hooks

- **Daily sales report** (and roll-ups that consume it) continues to derive sales, payment-method, void, invitation, and recorded tip figures from bills and payments — not from cash-out resumes or cash movements.
- In addition, the day surfaces **staff cash collected** from approved cash-outs, **cash-out / uncashed** status per employee, and an **operational audit** of cash movements (who moved cash, amounts, receipt numbers, kinds) for supervisors and above. Employees see their own status and their own movements. Cash movements are **not** revenue, void, or P&L over/short lines — they rearrange who holds cash.
- Closing the daily sales report still does **not** require a cash-out or cash attestation (sales-reports). Cash-out and day close are **independent**.
- There is **no** business **over/short** variance line from cash-out or cash movements. Shortfalls never approve; surplus cash is not venue revenue.
- Off-record cash tips never appear in sales, commissionable sales, or payroll.

### 3.16 Retention

- Cash-out resumes, cash-movement receipts, and approval/movement audits are **business records** under the platform's soft-delete and legal/financial retention class. Operators do not physically remove them in ordinary use.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Employee cash-out powers |
| --- | --- |
| **Customer** | None. |
| **Employee** | Holds their own wallet while on duty; views own live/draft resume; requests cash-out; presents cash, proofs, and movement receipts; when peer cash transfer is on, **records peer cash-in** as receiver. Cannot approve any cash-out; cannot record house paid-in/out or reverses. |
| **Supervisor** | Everything an employee can do for their own wallet, plus view any on-duty employee's resume, **approve** another person's cash-out when preconditions hold, and record **house paid-in/out** and **reverses** against **another** employee's wallet. Schedule-gated like other supervisor Service powers. |
| **Manager** | Same approval, visibility, and house-movement powers as supervisor; not schedule-gated for Business entry. May edit the **peer cash transfer** Business setting (business subject). |
| **Admin/owner** | Everything a manager can do. |

Approve cash-out, house paid-in/out, and cash-movement reverses are **supervisor-and-above layer defaults** (access-and-permissions). Day-of chrome for those acts is **Service → Cash-out** (user-navigation); supervisors do not need Manage. Peer cash-in is any on-duty employee when the Business setting is on. No separate per-user catalogue capabilities are required beyond the peer cash transfer Business setting.

### Who can do what

| Activity | Who |
| --- | --- |
| View own live or draft resume | The on-duty employee (and supervisors+ viewing them) |
| Request cash-out | The employee whose session it is |
| Approve cash-out | A **different** person with effective layer supervisor, manager, or admin |
| Reject cash-out (mismatch / open tables) | Automatic when preconditions fail; approver may decline after inspection |
| Record peer cash-in | Any on-duty employee at that Business when peer cash transfer is on (as receiver); never self |
| Record house paid-in or paid-out | Supervisor, manager, or admin against **another** on-duty employee's wallet |
| Reverse a cash movement | Supervisor, manager, or admin (new receipt; not into a closed cash-out window) |
| Configure peer cash transfer setting | Managers and above (business subject) |
| Turn off house paid-in/out | Nobody — always available |
| Sign out while uncashed or with open instances | Nobody — blocked (time-control enforces) |
| Configure personal float in the product | Nobody — float is physical-only |
| Record a tip on a cash payment | Nobody — payments-and-tax forbids it |
| Take cash on self-service channels | Nobody — payments-and-tax forbids Cash there |
