# Platform billing

> **About this document.** This is the **target-state source of truth** for platform billing in Project Imperium — how Project Imperium charges a business and how that business pays. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes platform billing as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **how Project Imperium takes money for its own fees**, and **how an Owner reconciles what is owed**. It covers:

- the **platform payment method** held on the Owner and used for portfolio charges;
- **automatic collection** of the monthly subscription and of each venue's weekly commission;
- the **invoice fallback** when no usable method exists or an automatic charge fails;
- **retries**, **arrears dunning**, and the named **cut-off date** that leads to freeze;
- **post-freeze** reminders until payment resumes service;
- **detailed billing documents**, in-app **billing history**, and export;
- **platform-fee tax** on Imperium's own charges under the Owner's country rules;
- **adjustments** when a week's commission is re-finalised after an edited daily, an approved refund, or a card dispute that changes commissionable sales.

It deliberately does **not** cover:

- the **plan catalogue, entitlement matrix, base commission rates, grace-day default, and freeze outcomes** — the monetization subject owns those commercial rules; this subject executes charges against them;
- **finalising** a reporting week's commission amount — the business-reports subject owns weekly close, the owed mark on the Business, and the re-finalise event; this subject collects and adjusts the money;
- **customer-to-venue settlement** and **business tax on sales** — the payments-and-tax subject owns those;
- **payment-facilitator / connected-account auto-take** from customer card flows — that future direction belongs to its own decision track; this subject never nets platform fees out of what customers paid the venue;
- **Superadmin** deadline override, manual freeze/resume, and catalogue maintenance — the superadmin subject owns those console powers;
- **go-live checklist** fields beyond consuming **paid-in-full** — the business subject owns the checklist; monetization defines the paid-in-full gate;
- **how in-app and email delivery are implemented** — the notifications and emails subjects own inbox, channels, and mail delivery; this subject raises the billing signals and states who must be reached and what each message carries.

---

## 2. Domain model and vocabulary

### Entities

- **Platform payment method** — the single payment instrument the **Owner** keeps on file for Project Imperium fees. It covers the Owner's subscription and every venue's weekly commission under that Owner. A Business never holds its own platform payment method.
- **Platform charge** — one amount Project Imperium collects: a **subscription charge**, a **weekly commission charge**, a **subscription true-up**, or a **commission adjustment**.
- **Payable invoice** — the fallback demand for a platform charge when automatic collection cannot complete. It carries the same commercial detail as a successful charge's billing document and a **payment deadline**.
- **Billing document** — the detailed record of a platform charge (or invoice): what was charged, which Business (for commission), the period, the rates applied, platform-fee tax, and totals. It is emailed and stored in billing history.
- **Billing history** — the Owner-facing (and Admin/owner-readable) ledger of platform charges, invoices, receipts, credits, and adjustments for the portfolio.

### Terms this subject introduces

- **Calendar subscription month** — the calendar month for which a paid-plan subscription is prepaid on the **first day** of that month (Owner portfolio timezone / country calendar as fixed by the one-country Owner rule in monetization).
- **Prorated prepaid** — a subscription charge for only the **remaining days** of the current calendar month, taken immediately when a paid plan starts or go-live requires paid-in-full mid-month.
- **Next-bill true-up** — the prorated subscription price difference from a mid-month plan change, applied as a debit or credit on the **next first-of-month** subscription invoice — not as an immediate mid-month charge or refund.
- **Automatic collection** — charging the Owner's platform payment method for an owed platform charge without netting against customer settlement.
- **Invoice fallback** — issuing a payable invoice when there is no usable platform payment method or automatic collection fails past retries.
- **Retry window** — up to **three** automatic re-attempts spread over about **forty-eight hours** after a failed auto-charge, before the charge is treated as overdue (hard declines may end the window sooner).
- **Arrears dunning** — the daily in-app notification and email cadence that names the unpaid amount, what it is for, and the **exact cut-off date** when service will freeze if still unpaid.
- **Post-freeze reminder window** — **fourteen days** of continued daily notify-and-email after freeze, urging payment so service can restart; then the daily cadence stops while the debt and freeze remain.
- **Platform-fee tax** — tax Imperium applies on its own subscription and commission fees under the Owner's country rules (for example VAT on the fee). It is not the venue's customer-facing sales tax configuration.
- **Commission adjustment** — the immediate charge or credit that brings money in line when a closed week's commission is **re-finalised**.

Terms reused rather than redefined here: **Owner**, **Business**, **subscription**, **paid-in-full**, **weekly commission**, **commissionable sales**, **reporting week**, **portfolio freeze**, **venue freeze**, **payment deadline**, **Superadmin**, and **plan**.

---

## 3. Capabilities

### 3.1 Who is charged

- **Subscription** is owed by the **Owner** and covers every Business in that portfolio.
- **Weekly commission** is owed by the **Business** that earned the sales. Sibling venues are separate debts.
- Collection always runs through the **Owner's platform payment method** when one is usable; otherwise through a **payable invoice**. The debt party does not change: subscription remains Owner debt; commission remains Business debt.
- Platform fees are **never** taken from what customers paid the venue and are **never** routed as a silent deduction through a merchant settlement of customer payments.

### 3.2 Platform payment method

- The Owner may keep **one** platform payment method on file for the portfolio.
- On **paid** plans (Basic and above), a usable method **or** an agreed invoice arrangement is required so the Owner can be **paid-in-full** and go live.
- On **Free**, a method is **not** required to go live. Free still owes **weekly commission** on every plan's terms; when a method exists it is auto-charged; when it does not, commission uses the **invoice fallback**.
- Replacing or removing the method is an Owner (Admin/owner) action. Removing the only usable method on a paid plan does not erase open debts; further collection uses invoice fallback until a method is restored.

### 3.3 Subscription charges (calendar prepaid)

- Paid-plan subscription is billed on the **first day of each calendar month**, **in advance**, for that **calendar subscription month**, in the Owner's portfolio currency.
- **Free** has no subscription invoice.
- When an Owner **starts a paid plan** or must become **paid-in-full** for go-live **mid-month**, Project Imperium takes a **prorated prepaid** charge for the **remaining days** of that calendar month immediately. The next first-of-month bill is then a full month in advance.
- **Mid-month plan changes** (Owner-driven or Superadmin force-assign): **entitlements apply immediately** (monetization). The subscription **price difference** for the remaining days of the month becomes a **next-bill true-up** on the following first-of-month invoice (debit for upgrade uplift, credit for downgrade). There is no immediate mid-month subscription charge or refund for that delta.
- **Commission rates** on sales still follow monetization's cutover rule inside a reporting week; this subject only collects the amounts business-reports finalises.

### 3.4 Weekly commission collection

- When a weekly business report **closes**, business-reports finalises the week's commission and marks it owed on the Business. This subject then **collects** that amount as a **weekly commission charge** (automatic collection or invoice fallback).
- Until that close, daily and open-weekly **estimates** are not charged.
- **Every plan**, including Free, is subject to weekly commission collection.
- After a closed week is **re-finalised** (edited daily, approved refund, or card dispute that changes commissionable sales), this subject applies a **commission adjustment** immediately — charge the uplift or credit the reduction — and issues a billing document for that adjustment. The Owner's billing history always shows the adjustment.

### 3.5 Automatic collection and invoice fallback

- Preferred path: **automatic collection** on the Owner's platform payment method when the charge becomes due (subscription on the first / prorated prepaid; commission at weekly close; adjustments when re-finalised; true-ups on the next first).
- If there is **no usable method**, or automatic collection **fails past the retry window**, Project Imperium issues a **payable invoice** with the same commercial detail and the monetization **payment deadline** (default seven days from notice; Superadmin may override).
- Paying the invoice (or a successful late auto-charge) **clears the debt**. Clearing the debt that caused a freeze **resumes** service for that portfolio or venue; Superadmin may also resume.
- The Owner pays a **payable invoice in-product** from **Billing** in Owner chrome (user-navigation): using the saved **platform payment method**, or after updating that method. Email still carries the billing document; in-product pay is the primary clear-debt path. Superadmin override and resume remain available.

### 3.6 Retries and arrears

- After a failed auto-charge, Project Imperium retries within the **retry window**: up to **three** automatic attempts over about **forty-eight hours**. Soft declines may retry across that window; hard failures move to invoice fallback sooner (without waiting for all three attempts).
- When the charge is still unpaid after retries (or was invoiced from the start), Project Imperium **notifies** and starts the **payment deadline**.
- From that notice through the deadline, **arrears dunning** runs **daily**: in-app notification and email naming the unpaid amount, whether it is subscription or which venue's commission, and the **exact calendar cut-off date** when service will freeze.
- On the cut-off date, if still unpaid: **subscription** arrears → **portfolio freeze**; **weekly commission** arrears → **venue freeze** for that Business only (monetization). There is **no** silent downgrade to Free.
- For **fourteen days after freeze**, **post-freeze reminders** continue daily (in-app and email), stating the unpaid bill and that paying it **restarts** service. After those fourteen days the daily cadence **stops**; the debt and freeze remain until paid or Superadmin clears or resumes.

### 3.7 Who is warned

- The **Owner** always receives every platform-billing notice and every billing document for the portfolio.
- **Subscription / portfolio** arrears: also **Manager and above** at **every** Business under that Owner.
- **Venue commission** arrears: also **Manager and above** at **that** Business only.
- How those messages are delivered (inbox, live push, email) belongs to the notifications and emails subjects; this subject defines the recipients and the commercial content.

### 3.8 Billing documents, history, and tax

- Every successful platform charge, every payable invoice, and every commission or subscription adjustment produces a **billing document** emailed to the Owner and stored in **billing history**.
- Each document states: charge kind (subscription, weekly commission, true-up, adjustment), Business when commission-related, **period** covered, **base commission rate** applied, fee subtotal, **platform-fee tax**, and totals in portfolio currency.
- Admin/owner users may view and **export** billing history for the portfolio (and commission lines for venues they administer). Managers may see commission-related billing detail for venues they already manage when it appears in arrears notices; they do not change payment methods or plans.
- **Platform-fee tax** follows the Owner's country rules on Imperium's fees. It is independent of the venue's sales-tax configuration on customer prices.

### 3.9 Currency

- All platform charges use the Owner's **portfolio currency** (same as every venue under the one-country rule). There is no separate platform billing currency and no FX execution inside this subject while that rule holds.

---

## 4. Roles and entitlements

### Base access layers (venue)

| Layer | Platform-billing powers |
| --- | --- |
| **Customer** | None — customers never pay platform fees. |
| **Employee** | None. |
| **Supervisor** | None. |
| **Manager** | Receives arrears dunning for portfolio subscription (every venue) or for that venue's commission; may see commission billing detail tied to venues they manage; cannot change the platform payment method or pay plans. |
| **Admin/owner** | Manages the Owner's platform payment method; changes plan under monetization rules; views and exports billing history; receives all Owner billing documents and notices. |

### Who can do what

| Activity | Who |
| --- | --- |
| Hold the platform payment method | The Owner |
| Add, replace, or remove the platform payment method | Admin/owner on that Owner account |
| Be charged subscription | The Owner |
| Owe weekly commission | The Business (collected via Owner method or invoice) |
| Receive billing documents | The Owner (always); Admin/owner may view history |
| Receive arrears / post-freeze dunning | Owner always; Manager and above scoped per §3.7 |
| Override deadline or resume when frozen | Superadmin console Manager or console Owner |
| Pay an invoice / clear debt in-product from Billing | The **Owner**, from **Billing** in Owner chrome (subscription and venue commission debts settle through the Owner's platform method) |

Job roles and per-user capabilities follow the global model; this subject does not add a separate capability flag beyond who may manage the platform payment method, view billing history, and receive arrears notices.
