# Payments and tax

> **About this document.** This is the **target-state source of truth** for payments and tax in Project Imperium — how a bill is settled, the methods and providers behind it, the refunds a venue returns, and the taxes a venue applies. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes payments and tax as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns **settlement**: turning an open bill into paid money, and the taxes a venue must apply to what it sells. It covers:

- the **payment** — a recorded settlement entry on a bill, and its method, amount, tip, provider reference, and status;
- the **payment-method catalogue** — the fixed types and branches a payment may use;
- **taking payment** — settling a bill, whole or in parts, across every service channel;
- **splits and partial payments** — arranging a bill into parts and paying it down until it closes;
- **tips** — taking and attributing a gratuity at settlement, including surplus from over-tender taken as tip;
- **over-tender** — when cash (or similar) tender surpasses outstanding balance, returning change or recording the difference as tip;
- **third-party processing** — Stripe Connect as the integrated processor for Imperium-processed self-channels, connecting each venue's payment account, and recording external tenders;
- **payouts** — how captured money reaches the venue;
- **refunds and card disputes** — the request-and-decision flow, reversal of a settled payment, and how provider disputes feed reporting and commission;
- the **tax configuration** — the per-category rates a business sets; and
- **tax on a sale** — the tax a sale records and how it is drawn out of a tax-inclusive price.

It deliberately does **not** cover:

- the **service journey** — the surface flows (dine-in, QR self-ordering, kiosk, delivery), requesting the bill, and closing the instance belong to the **order-flow** subject. This subject owns the settlement that closes it.
- the **bill's composition** — the orders a bill aggregates, their pricing and cost, voids, invitations, cancellations, transfers, and manual discounts belong to the **orders** subject. This subject settles the billable lines that subject supplies.
- the **sales point and sales instance** — opening, the one-open rule, self-service instances, and the pay-in-full-before-close behaviour of a self-service instance belong to the **sales-points-and-instances** subject.
- the **business good beyond its tax category** — the menu, its categories, selling price, derived cost, and allergens belong to the **business-goods** subject; this subject assigns each good a **tax category** and reads the price it carries.
- the **business profile** — the currency, the address, and the tax number held on the venue's Company belong to the **business** subject; this subject stores the venue's **tax configuration**.
- the **subscription and commission** — the plan catalogue, base commission rates, and commercial rules belong to the **monetization** subject (catalogue maintenance in **superadmin**); the amount a **reporting week** owes is finalised by the **business-reports** subject at weekly close; **charging mechanics** (Owner payment method, invoice, retries, billing documents, dunning) belong to **platform-billing**. This subject names the money flows only.
- **Stripe Terminal / in-premises card hardware** — dine-in customers pay on the venue's own reader; Imperium does not process that card rail in stage 1.
- the **gift-card instrument** — issuance as deposit/liability, balance, ledger, lifecycle, and redemption rules belong to the **gift-cards** subject; this subject owns the **Gift card** payment method and records a redemption as ordinary settlement (tax stays on the goods).
- **customer bill and receipt documents** — required content, numbering, reprint, and replacement identity belong to the **receipts-and-bills** subject. Delivering a receipt or a refund decision belongs to the **notifications** and **emails** subjects; those payloads must satisfy receipts-and-bills.
- **supplier invoices and their tax** — amounts payable to a supplier and supplier invoicing are not part of Project Imperium.
- **tip pooling and payroll export** — redistributing tips across roles and packaging them into a pay run belong to the **payroll** subject. This subject records and attributes tips at settlement.

---

## 2. Domain model and vocabulary

### Entities

- **Payment** — a recorded settlement entry against a bill. It belongs to exactly one **Business** and exactly one **sales instance**. It records **who took it and in what capacity**, the **moment** it was taken, its **method**, its **amount**, an optional **tip**, an optional **provider reference** where a provider captured it, its **status**, and the **refunds** returned against it.
- **Refund** — a recorded reversal of a settled payment. It records **who decided it and when**, the **amount** returned, the **reason**, and the **method** it was returned to. A refund belongs to the payment it reverses.
- **Tax configuration** — the single per-business set of tax rates: one rate for each **tax category**. It belongs to exactly one **Business**.

### Terms this subject introduces

- **Payment method** — how a bill is paid, described by a **type** and a **branch**.
- **Payment-method type** — **Cash**, **Card**, **Crypto**, **Gift card**, or **Other**. Groups the branches for reporting.
- **Method branch** — the named variant under a type: the **card networks** (Visa, Mastercard, American Express, Discover, Diners Club, Maestro), the **cryptocurrencies** (Bitcoin, Ethereum, Litecoin, Ripple, Cardano, Polkadot, Dogecoin), and the **other methods** (Voucher, PayPal, Venmo, Apple Pay, Google Pay, Samsung Pay); and **Cash** and **Gift card**, which have no separate branch.
- **Payment provider** — the third-party processor through which Imperium captures card (and supported wallet) payments on self-channels. Stage 1 uses **Stripe** only, via a **connected payment account** per Business.
- **Connected payment account** — the venue's Stripe Express account under Imperium's Connect platform. The **Business is merchant of record**; diner money settles to the venue. One account per Business; its country follows the Business address country.
- **Provider reference** — the identifier a provider returns for a captured or refunded payment, recorded so the venue can reconcile it in the provider's own reporting.
- **Card dispute** — a chargeback or similar challenge raised through the card provider against a settled Imperium-processed payment. Evidence is handled in the provider's Express dashboard; Imperium records the outcome.
- **Settlement** — paying a bill in full, clearing what is owed.
- **Split** — dividing a bill into parts that are paid separately.
- **Partial payment** — a payment for less than what the bill still owes.
- **Outstanding balance** — the part of a bill not yet paid. A bill closes when outstanding is covered or surpassed (§3.6).
- **Tip** — an optional gratuity added at settlement, taken on a payment and attributed to the employee who took it.
- **Payout** — the transfer a provider makes of captured money to the venue's account.
- **Refund request** — a request to reverse settled money, raised by a customer or a staff member and decided by the manager on duty.
- **Tax category** — one of the fixed set a business rates: **Food**, **Non-alcoholic drinks**, **Alcoholic drinks**, **Merchandise**, **Tobacco**, and **Tip**.
- **Tax-inclusive price** — a price a venue sets that already contains its tax; the customer always pays the figure shown, and the tax is the part of it that is owed.
- **Commission** — the platform's fee on a reporting week's **commissionable sales**, owed by the venue and collected automatically at weekly report close, separately from what its customers pay.

Terms reused rather than redefined here: **Business**, **Owner**, **Company**, **Employee**, **Customer**, **Bill**, **Order**, **Sales instance**, **Business good**, **Staff tab**, **self-service instance**, **business currency**, **on duty**, **Subscription**, **Gift card**, **superadmin**, and **soft delete**.

---

## 3. Capabilities

### 3.1 Settlement and the bill

- A **bill** is settled when what it owes is paid; on full settlement the sales instance closes. Which surface closes the instance and when the bill is requested belong to the order-flow subject; this subject supplies the settlement that closes it.
- Every chargeable order on the bill contributes its **final price** — a price that already contains the business's tax. A **void** or **invitation** line stays listed and uncharged.
- A **staff tab** is settled by the staff on duty on it; a **self-service** instance is paid in full before it closes. On customer self-service channels, the payer must be a **signed-in User** at the moment payment is taken (order-flow may let a guest build the basket first; identity is required at payment).
- A bill may be settled by **one payment or several**. Each payment is recorded in its own right, and the bill keeps its payments as history.
- A payment belongs to the **work day** of the instance it settles, in the business timezone, and its amount and tip feed that day's sales report.
- A payment (and its bill) that changes after that work day's sales report has already been **closed** at least once carries an **edited** flag, matching the flag on the daily sales report — the sales-reports subject owns when the day must be reopened first.

### 3.2 The payment-method catalogue

- The ways a bill may be paid are a **closed, platform-defined catalogue**: a business neither adds, renames, nor removes a method. A method is a **type** with a **branch**:
  - **Cash** — recorded as cash, with no separate branch.
  - **Card** — Visa, Mastercard, American Express, Discover, Diners Club, Maestro.
  - **Crypto** — Bitcoin, Ethereum, Litecoin, Ripple, Cardano, Polkadot, Dogecoin.
  - **Gift card** — a gift card redeemed at its issuing venue, with no separate branch.
  - **Other** — Voucher, PayPal, Venmo, Apple Pay, Google Pay, Samsung Pay.
- The **type** groups the branches for reporting; the **branch** names exactly how the money moved. A payment is reported at both levels.
- Every payment carries exactly one method, and the method chosen places the payment, and its tip, in the payment-method breakdown.
- A **gift card** redeemed at its issuing venue is recorded as a **Gift card** payment, so it appears in its own place in the breakdown. Tax on the bill is the ordinary tax on each **paid** order line (and tip); gift-card tender does **not** change line tax categories and does **not** turn lines into invitations. Funding a card is a **deposit**, not a product sale — the gift-cards subject owns issue, balance, ledger, and lifecycle.

### 3.3 Taking a payment

- A **payment** records **who took it and in what capacity** — an on-duty employee working the tab, or the **customer** for a self-service channel — the **moment** it was taken, its **method**, its **amount**, an optional **tip**, an optional **provider reference** where a provider captured it, and its **status**.
- A payment taken in **cash** or on an **external terminal** is simply **recorded**; it needs no provider and reads as settled from the moment it is taken.
- A payment **captured through a connected provider** begins **pending** and reads as **settled** once the provider confirms it. A provider that **declines** it leaves it **failed**, and the bill still owes that amount.
- A payment that has been **reversed** shows the refund against it; a payment reversed in full reads as **refunded**.
- A failed or reversed payment never leaves a bill paid: the **outstanding balance** it failed to cover stays owed.

### 3.4 Splits and partial payments

- A bill may be **split** the ways a venue serves: into **equal shares**, by **amount**, or by **selected lines or guest**. A split is an arrangement for paying; it moves no money by itself.
- Each part of a split is settled by its **own payment or payments**, so one bill may be paid partly in cash, partly by card, and partly by another method.
- Guests sharing a tab may pay with **different methods at different times**. A **partial payment** reduces the **outstanding balance** and leaves the bill open; the bill closes only once outstanding is **fully covered** or **surpassed** (§3.6).
- A **self-service** instance is paid in full before it closes, so it never carries a partial balance.
- Customer **receipt** issue at full close — and mid-settlement **bill** content showing payments so far — belong to the receipts-and-bills subject; this subject only records the payments.

### 3.5 Tips

- A **tip** is optional and is taken **on a payment** — a **percentage** of the payment or a **fixed amount** in the business currency — at the moment the bill is settled.
- A staff tip is **attributed to the employee** who took it; a self-service tip is the customer's own.
- A tip is recorded with its payment and feeds the day's sales report; the platform taxes the tips it records (§3.10).
- On an **Imperium-processed** card payment, the tip is collected on the **same** diner charge as the bill, settles to the venue with the bill, and is **recorded separately** so it never enters **commissionable sales**.
- A **cash tip** handed to staff away from the platform is not the business's concern: the platform neither records nor taxes it.

### 3.6 Over-tender and change

- When a payment's tender **surpasses** the outstanding balance (typical for cash), the guest chooses either **change returned** in the business currency or that the **difference is taken as tip** on that payment.
- The instance may close when outstanding is **covered or surpassed**; surplus never stays as unexplained cash on the tab — it is either change or tip.
- The customer **receipt** shows owed, tendered, and change or tip as the receipts-and-bills subject requires.

### 3.7 Third-party processing and connected accounts

- Project Imperium offers **direct payment processing** through **Stripe** only in stage 1 (ADR-0005). There is no venue choice among competing integrated processors.
- Imperium operates as a **Connect platform**. Each **Business** holds **one connected payment account** (Stripe Express). The **venue is merchant of record**: the diner pays the restaurant; checkout, bank statement descriptor, and receipt **seller name** use the venue's **trade name**. Imperium may appear only as software chrome, never as the merchant of the meal.
- **Admin/owner only** starts and completes connected-account onboarding (and reconnect). The account country follows the Business address country.
- Imperium processes card payments only on **online, delivery, and QR / self-order** channels. **Dine-in** card payment uses the venue's **own reader** and is **recorded** in Imperium without Stripe capture. Staff may always **record** cash, external-terminal card, gift card, and other catalogue methods.
- A Business must have a connected account **able to accept charges and receive payouts** before it may go live (business go-live checklist). Taking a venue **offline** keeps the connection. **Closing** a Business stops Imperium from using that connected account for further captures.
- An Imperium-processed payment is a **direct charge** on the venue's connected account. The customer is charged the **face price** (no Imperium or Stripe fee added on top). Provider processing, refund, and dispute fees land on the **venue's** connected account; Imperium does not reimburse them and does not skim Imperium commission from the diner payment.
- A provider-processed payment carries the provider's **reference** and its status. The business's **currency** governs.
- While a Business is under **venue freeze** or its Owner under **portfolio freeze**, Imperium **stops new** Imperium-processed captures for that Business (monetization / platform-billing own freeze rules).

### 3.8 Payouts

- Money captured through Stripe is settled **to the venue** by the provider's own **payout**. The platform does **not** hold or move a venue's diner money and keeps **no payout ledger**: payout timing, batching, and provider fees are the provider's, visible in the Express dashboard and provider reporting.
- Project Imperium records the payments a venue takes and the refunds against them; the money itself flows **directly to the venue's account**.

### 3.9 Refunds and card disputes

- There are **no automatic refunds**. A refund is a **request** decided by the **manager on duty**; no payment is ever reversed without that decision — including a customer's delivery or self-service order.
- A **refund request** may be raised by the **customer** from the app or by **any staff member**, naming the payment and, optionally, the amount sought. The manager on duty **approves or declines** it and may approve a **full or partial** refund.
- An approved refund requires a **reason** and is **audited**: it records who decided it, when, how much, its reason, and the method it was returned to.
- An **electronic or provider-processed** payment is refunded to its **original method**; a **cash** payment is returned in **cash**. A refund reverses the payment's **tax** and its place in the **payment-method breakdown** in proportion to the amount returned.
- The **original sale stays in reporting**; the refund is shown **beside it**, never by erasing the sale.
- A refund returns **money only** — it does **not restore inventory**. Restoring stock is a **cancellation**, which belongs to the orders subject.
- Refunds against one payment may not exceed the amount settled; several partial refunds may be made until the payment is fully returned.
- **Card disputes** (chargebacks) are evidenced in the provider's **Express dashboard**. Imperium records the dispute outcome on the payment. Approved refunds and dispute outcomes that reverse **commissionable** product sales feed the same reporting and, after a closed week, the **re-finalise and commission adjustment** path owned by business-reports and platform-billing.

### 3.10 Tax configuration and tax on a sale

- A business has **one tax configuration**: a **rate for each tax category**, set by an admin/owner. The categories are a **fixed platform set** — **Food**, **Non-alcoholic drinks**, **Alcoholic drinks**, **Merchandise**, **Tobacco**, and **Tip** — and each carries the rate that business must apply, which may be zero.
- Every **business good maps to exactly one tax category** — never to **Tip**, which rates tips alone — and an **add-on** maps to its own category. A good's category tells a sale which rate taxes it. Gift-card **deposit intake** is not a business good and is not taxed as a product sale; tax is taken when gift-card tender pays for goods (and tips) at redemption (gift-cards subject; ADR-0004).
- **Prices are tax-inclusive.** The price a venue sets for a good already contains its tax: the customer always sees and pays the **final** figure, and the tax is the part of it that is owed. There is no separate inclusive-or-exclusive choice.
- Tax on a sale is computed on the amount **actually paid** after every **discount, promotion, or price edit** — a good discounted from 8 to 6 is taxed on 6 — and **never** on the undiscounted price. A **void** or **invitation** line is uncharged and so untaxed.
- A **tip** is taxed at the **Tip** rate.
- The tax each sale carries is **recorded** on it and feeds the day's reporting. The platform **computes and records** the tax but **never remits** it — remittance is the venue's own legal duty.
- Tax is expressed to the **currency's minor unit**: a derived tax amount is **rounded to two decimals**, and the customer's final price is **never changed** by the calculation.
- A change to the tax configuration takes effect for **open tabs and future sales only**; a settled sale keeps the tax it recorded.

### 3.11 The two money flows

- **Customer to venue.** What a customer pays for what they consume settles, through Stripe on Imperium-processed channels, **directly to the venue**. It is the venue's money, in the venue's account: the platform records it and takes **no** Imperium commission from that payment at source.
- **Venue to Project Imperium.** The platform's own fees are the **monthly subscription** on the Owner and a **weekly commission** of **base commission** on all **commissionable sales** (paid product sales after voids and refunds across tenders, including sales paid with gift card; invitations, gift-card deposit intake, forfeitures, and **tips** excluded). The commission for a week is **finalised and owed** when that week's **business report closes**, then **collected** by platform-billing on the Owner's platform payment method — never netted out of what the venue's customers paid. Until that close, daily and open weekly reports may show a **commission estimate** only.
- Which subscription a venue's Owner holds, and the rates its plan fixes, are the monetization and superadmin subjects' concern; how a week's commission is worked out at weekly close is the business-reports subject's; how Imperium charges and the business pays is the platform-billing subject's. This subject owns only the shape of the two flows.

### 3.12 Retention

- Payments live as **history**: operators never physically remove one. A payment reversed in full is **retained** and reads as refunded, so a bill's settlement always reconciles.
- A **refund** is retained and audited with its reason and its decision.
- These are business records under the platform's **soft-delete** rule and the **legal and financial** retention class. Any later physical removal after that class delay belongs to the plan quotas and data retention subject and only when the **data-integrity rule** allows.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Payments-and-tax powers |
| --- | --- |
| **Customer** | Self-pays a self-service bill in-app by any method; may raise a refund request; never takes another's payment, configures tax, or decides a refund. |
| **Employee** | Takes payments and tips on the tab they are on duty for, records cash and external-terminal payments, and may raise a refund request; cannot refund or configure. |
| **Supervisor** | Same payment-taking powers as employee; cannot decide refunds or configure tax / Stripe. |
| **Manager** | Everything an employee can do, plus deciding refund requests and issuing refunds. Cannot complete Stripe connected-account onboarding. |
| **Admin/owner** | Full venue control, including the **tax configuration** and **connecting or disconnecting** the venue's Stripe connected payment account. |

### Who can do what

| Activity | Who |
| --- | --- |
| Take a payment and a tip on a tab | The employee on duty on the tab |
| Pay a self-service bill in full | The customer |
| Record a cash or external-terminal payment | An employee on the tab |
| Split a bill; take partial payments | The employee settling the tab |
| Raise a refund request | The customer from the app, or any staff member |
| Approve or decline a refund request; issue a refund | The manager on duty |
| Complete Stripe connected-account onboarding or disconnect it | Admin/owner |
| Respond to card-dispute evidence in the Express dashboard | Admin/owner (or whoever the venue authorises in Stripe) |
| Set the tax configuration (a rate per tax category) | Admin/owner |
| Choose a business good's tax category | Managers and above, when creating or editing the good |
| Maintain platform commission terms | The superadmin |
