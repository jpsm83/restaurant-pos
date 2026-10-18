# Gift cards

> **About this document.** This is the **target-state source of truth** for gift cards in Project Imperium — the stored-value cards a business issues and the way they are funded, granted, redeemed, and broken. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes gift cards as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **gift card**: a bearer **stored-value (deposit) instrument** a business issues and a holder spends. It covers:

- the **gift card** itself — its bearer nature, issued value, **remaining balance**, card number, QR code, note, expiry, and status;
- the **virtual card** and its delivery by email;
- **buying** a paid card as a **standalone deposit checkout** and **granting** a business-gift card;
- the **gift-card ledger** of audited balance events;
- **redeeming** a card as a payment method at the issuing venue (including partial redeem, mixed baskets, tips, and combination with other methods);
- **refund** of a fully unspent paid card, **restore** of balance after a meal refund, **void**, and **expiry forfeiture**;
- the **gift-card configuration** a business sets; and
- how gift-card money appears in **daily reporting** (intake, tender, forfeiture, outstanding liability).

It deliberately does **not** cover:

- the **payment catalogue and settlement** — the payments-and-tax subject owns how a bill is settled and the fixed catalogue of payment methods. This subject introduces the **Gift card** method and how a card’s balance is applied; that subject owns the catalogue and tax on goods.
- the **tax configuration** — the payments-and-tax subject owns per-category rates on **goods and tips**. Gift-card **issue is not a product sale** and is not taxed as goods; tax is taken on the **orders** a card pays for at redemption.
- the **order and bill** — the orders subject owns billable lines, voids, invitations (comps), and cancellations. Redeeming a gift card does **not** turn lines into invitations; lines stay paid sales.
- the **emails and notifications** — those subjects own delivery of the virtual card and any in-app alert; this subject names that the card is emailed.
- the **business configuration and currency** — the business subject owns the venue’s currency. This subject owns the venue’s gift-card configuration.
- the **service surfaces** — order-flow and sales-points-and-instances own them. A card is offered on the payment step of ordinary bills; deposit purchase is its own checkout.
- the **refund mechanics** of settling money — the payments-and-tax subject owns refund request and decision; this subject owns when a **card** may be refunded or have balance restored.
- **reservation deposits** — the reservations subject owns those; a reservation deposit is not a gift card.
- the **platform’s deletion model** — soft delete applies; this subject states that a card and its ledger are retained.

The money model follows ADR-0004 (gift cards as liability; tax and revenue at redemption).

---

## 2. Domain model and vocabulary

### Entities

- **Gift card** — a **bearer stored-value instrument** issued by exactly one **Business** (its issuing venue). It carries an **issued value** and a **remaining balance** in the business currency, an optional **note**, an **issue date**, an **expiry date**, a **status**, and the **funding** by which it came to exist (bought or granted). It is identified by a **QR code** and a **card number**.
- **Gift-card ledger** — the append-only, audited history of balance events on one gift card.

### Terms this subject introduces

- **Bearer card** — a card whose value may be spent by **whoever holds it**; redemption needs no account, only the card.
- **Virtual card** — the card as delivered: an **email** carrying the card, its note, its QR code, its card number, its expiry, and the data that identifies it. There is no physical card.
- **Card number** — the human-readable code that identifies a card when its QR code cannot be scanned.
- **Issued value** — the face amount set when the card is issued, in the **business currency**.
- **Remaining balance** — the unspent liability still on the card.
- **Minimum card value** — the smallest issued value a business allows; a **gift-card configuration** setting.
- **Validity period** — the span from issue to expiry a business gives its cards; a **gift-card configuration** setting.
- **Expiry date** — the moment a card stops working; any remaining balance is forfeited.
- **Paid card** — a card funded by a buyer’s deposit checkout.
- **Granted card** — a card a business gives away, issued with no payment.
- **Deposit checkout** — the standalone settlement that funds a paid card (cash in, liability created; not a menu sale).
- **Customer liability** — the business’s obligation to honour the card’s remaining balance.
- **Gift card payment** — the payment method a card is redeemed through.
- **Redeeming a card** — applying some or all of a card’s remaining balance against a bill at its issuing venue.
- **Breakage / forfeiture** — remaining liability taken as venue income when a card **expires** or is **voided** with balance left.
- **Card status** — the card’s standing: **Active**, **Depleted**, **Expired**, **Voided**, or **Refunded**.

Terms reused rather than redefined here: **Business**, **Order**, **Bill**, **Payment**, **Payment method**, **Payment-method breakdown**, **Invitation**, **Tip**, **Customer**, **Employee**, **managers and above**, **business currency**, **tax category**, **daily report**, **commissionable sales**, and **soft delete**.

---

## 3. Capabilities

### 3.1 The gift card

- A gift card is a **bearer stored-value instrument**: it belongs to exactly one business — its **issuing venue** — carries an **issued value** and a **remaining balance** in the business currency, and is identified by a **QR code** and a **card number**. **Whoever holds the card may spend it**; no account is needed to redeem.
- A card is **non-reloadable**: its issued value never grows after issue. It supports **partial redemption** until the balance is zero, the card expires, or it is voided or refunded.
- A card is valid only at its **issuing venue** and never changes currency.
- A card exists only as a **virtual card**, delivered by **email** to the person the buyer or the business names. There is no physical card.
- A card carries the buyer’s optional **note** and the data that identifies it, and shows its issuing venue, issued value, remaining balance, and expiry.

### 3.2 Buying and granting a card (deposit / liability)

- A **paid card** is funded by a **standalone deposit checkout** — not a menu or business-good line, and **not** mixed on the same bill as food, drinks, or merchandise. On an ordering surface (POS, kiosk, or Customer app) the buyer chooses the gift-card option, sets the **issued value** (at or above the business’s **minimum card value**), may add a **note**, and **pays** by a normal tender (**not** another gift card). On settlement Project Imperium records **cash in** and **customer liability**, generates the card at full remaining balance, writes the ledger **issued** event, and emails the virtual card to the recipient the buyer names.
- **Employees and customers** may both buy a paid card. A paid card’s deposit checkout is **not** a product sale and carries **no product tax**.
- A **granted card** is a business gift: **managers and above** issue it with a value and no payment; Project Imperium creates the same spendable **liability**, generates the card, writes the ledger event, and emails the recipient. A granted card is not a taxed sale and takes in no cash.
- **No card exists before its deposit checkout is settled or its grant is finalised**, and a card is never handed over in person — it is always emailed.

### 3.3 Value, balance, currency, and expiry

- A card’s **issued value** is set when it is issued, in the **business currency**, at any amount at or above the business’s **minimum card value**. **Remaining balance** starts equal to issued value and falls as the card is applied.
- Every card has an **expiry date**, set by applying the business’s **validity period** to its issue date; a **granted** card’s date may be overridden by managers and above.
- When a card reaches its **expiry date** it stops working, and any **remaining balance is forfeited** to the business as breakage (ledger event labeled **Expired**).

### 3.4 Redeeming a card

- A gift card is a **payment method**, offered at payment beside the other methods a bill may be settled by. To redeem one, the card’s **QR code is scanned or its card number entered**.
- A card is redeemed only at its **issuing venue**, on an **ordinary meal (or retail) bill** — including bills that mix categories (for example food and alcohol) and bills that include a **tip**.
- **Tax and revenue follow the order lines**, at each line’s tax category, exactly as for any other tender. Gift-card redemption does **not** recompute tax under a special gift-card rate, and it does **not** mark lines as **Invitation**. Invitation remains comps only (orders subject).
- A bill may use **at most one gift card**, combinable with other methods for the remainder. The amount applied is at most **min(remaining balance, outstanding balance)** (outstanding may include tip being taken on that settlement). Unused card balance **stays on the card** — no change is given and no surplus is forfeited at payment.
- When a card pays (in whole or part), Project Imperium records a **Gift card payment** for the amount applied, reduces the card’s remaining balance, and appends a ledger **applied** event pointing at the bill/payment. Product sales and tax for that day include those paid lines like any other sale.
- **Stock** follows ordinary paid orders; there is no invitation workaround for inventory.

### 3.5 Lifecycle, void, refund, and restore

- A card’s **status** is:
  - **Active** — not expired, voided, or refunded, and **remaining balance greater than zero**;
  - **Depleted** — remaining balance is zero after use (may become **Active** again if a meal refund restores balance before expiry or void);
  - **Expired** — past expiry; any leftover balance was forfeited;
  - **Voided** — stopped by the business; any leftover balance was forfeited; or
  - **Refunded** — a fully unspent paid card’s deposit was returned and the card is closed.
- **Managers and above may void** a card with a required, audited **reason**. Voiding stops the card. If balance remains, that amount is **forfeited** to the business (ledger event labeled **Voided**) — void is **not** a customer refund.
- **Refunding a paid card** is allowed **only when the card is fully unspent** (no redemption has ever been applied). The refund follows the payments-and-tax refund flow, reverses the liability, returns the deposit, writes a ledger **refunded** event, and sets status **Refunded**. A card that has been partly or fully redeemed cannot be refunded as a card; remaining value is used, expires, or is voided.
- When a **meal payment** that used gift-card tender is refunded, Project Imperium **prefers restoring** the gift-card portion to that card’s remaining balance (ledger **restored** event) when the card can still hold value (**Active** or **Depleted**, not expired, voided, or refunded). Restore **does not extend** the expiry date. If restore is impossible, the manager on duty decides the exception path for that portion under the payments-and-tax refund rules.
- A card and its ledger are **retained** under the platform’s soft-delete rule and are never hard-removed, so issues, applies, forfeits, voids, refunds, and restores always reconcile.
- Managers and above can see cards by lifecycle and the venue’s **outstanding liability** (sum of Active remaining balances).

### 3.6 Gift-card ledger

- Every card has an append-only **gift-card ledger**. Events include at least: **issued** (paid or granted), **applied** (to a bill/payment), **restored** (from a meal refund), **expired** / forfeited, **voided** / forfeited, and **refunded**.
- Each event is audited (who/what/when and amounts). The bill’s payment history points at the apply event; the card lists its full history.

### 3.7 Configuration and reporting

- A business sets its **gift-card configuration**: the **minimum card value** and the **validity period**.
- There is **no** Gift-card product-sale tax category; issue is untaxed as goods (payments-and-tax subject).
- In the **daily sales report**:
  - **deposit intake** for that day’s paid issues appears in the **gift-card channel** as liability funding (not product sales);
  - **granted** issues appear there as grants (liability, no cash);
  - **Gift card** payments on meal bills appear in the **payment-method breakdown** and the gift-card channel as tender; the **product sales and tax** sit in ordinary sales totals by line category;
  - **expiry and void-with-balance forfeitures** accumulate in the **forfeiture** channel, each labeled **Expired** or **Voided**;
  - **outstanding liability** is visible to managers and above.
- **Commissionable sales** include product sales paid with gift-card tender (paid or granted cards alike). Deposit intake and forfeitures are not commissionable. Card recovery never applies to gift-card tender. The monetization and business-reports subjects own the formula.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Gift-card powers |
| --- | --- |
| **Customer** | Buys a paid card for themselves or as a gift, holds it, and redeems it at the issuing venue; never grants, voids, or configures. |
| **Employee** | Everything a customer can do, plus selling paid cards on the POS and redeeming cards at payment. |
| **Manager** | Everything an employee can do, plus granting business-gift cards, overriding a granted card’s expiry, voiding cards with a reason, viewing cards and outstanding liability, and setting the gift-card configuration. |
| **Admin/owner** | Everything a manager can do. |

### Who can do what

| Activity | Who |
| --- | --- |
| Buy a paid card (deposit checkout) | Any customer or employee, on the POS, a kiosk, or the Customer app |
| Grant a business-gift card | Managers and above |
| Set the minimum card value and the validity period | Managers and above |
| Override a granted card’s expiry date | Managers and above |
| Redeem a card at payment (scan the QR or enter the number) | Anyone taking the payment — a staff member at the POS, or the customer at a self-service payment |
| Void a card, with a reason | Managers and above |
| View cards, ledger, and outstanding liability | Managers and above |
| Refund a fully unspent paid card | Follows the payments-and-tax refund flow (the manager on duty decides) |
| Restore balance after a meal refund paid by gift card | Follows the payments-and-tax refund flow when restore is possible |
