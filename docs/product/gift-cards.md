# Gift cards

> **About this document.** This is the **target-state source of truth** for gift cards in Project Imperium — the budget cards a business issues and the way they are bought, granted, and redeemed. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes gift cards as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject owns the **gift card**: a bearer budget instrument a business issues and a holder spends. It covers:

- the **gift card** itself — its bearer nature, value, card number, QR code, note, and expiry;
- the **virtual card** and its delivery by email;
- **buying** a paid card and **granting** a business-gift card;
- the **value**, the business-configured **minimum card value** and **validity period**, and currency;
- **redeeming** a card as a payment method at the issuing venue, including a card smaller or larger than the bill and the record it leaves on the bill and its orders;
- the card **lifecycle** — active, redeemed, expired, voided — and its **voiding**;
- the **gift-card configuration** a business sets; and
- how a card appears in the **daily report**.

It deliberately does **not** cover:

- the **payment catalogue and settlement** — the payments-and-tax subject owns how a bill is settled and the fixed catalogue of payment methods a bill may use. This subject introduces the **Gift card** method and how it settles a bill; that subject owns the catalogue it joins.
- the **tax configuration** — the payments-and-tax subject owns the per-category rates. This subject introduces the **Gift card** tax category a card's purchase is taxed under.
- the **order and bill** — the orders subject owns the billable lines, voids, invitations, and cancellations, and the payments-and-tax subject owns the bill's composition and settlement. This subject reads the bill and marks the lines a card covers as invitations.
- the **emails and notifications** — the emails subject owns delivering the virtual card and the notifications subject owns any in-app alert; this subject names the delivery.
- the **business configuration and currency** — the business subject owns the venue's currency. This subject owns the venue's gift-card configuration.
- the **service surfaces** (dine-in, QR self-ordering, kiosk, delivery) — the order-flow and sales-points-and-instances subjects own them. A card is offered on the payment step of every one.
- the **refund mechanics** of a paid card — the payments-and-tax subject owns refunds; this subject owns voiding a card.
- the **platform's deletion model** — the platform's soft delete rule applies; this subject states that a card is retained.

---

## 2. Domain model and vocabulary

### Entities

- **Gift card** — a **bearer budget instrument** issued by exactly one **Business** (its issuing venue). It carries a **value** in the business currency, an optional **note**, an **issue date**, an **expiry date**, a **status**, and the **funding** by which it came to exist (bought or granted). It is identified by a **QR code** and a **card number**.

### Terms this subject introduces

- **Bearer card** — a card whose value may be spent by **whoever holds it**; redemption needs no account, only the card.
- **Virtual card** — the card as delivered: an **email** carrying the card, its note, its QR code, its card number, its expiry, and the data that identifies it. There is no physical card.
- **Card number** — the human-readable code that identifies a card when its QR code cannot be scanned.
- **Value** — the money amount a card carries, in the **business currency**.
- **Minimum card value** — the smallest value a business allows a card to be issued with; a **gift-card configuration** setting.
- **Validity period** — the span from issue to expiry a business gives its cards; a **gift-card configuration** setting.
- **Expiry date** — the moment a card stops working and its unspent value is forfeited.
- **Paid card** — a card bought and paid for by a buyer.
- **Granted card** — a card a business gives away, issued with no payment.
- **Gift card payment** — the payment method a card is redeemed through.
- **Redeeming a card** — spending a card's value against a bill at its issuing venue.
- **Gift card tax rate** — the rate a card's purchase is taxed at, one of the business's tax categories.
- **Card status** — the card's standing: **Active**, **Redeemed**, **Expired**, or **Voided**.

Terms reused rather than redefined here: **Business**, **Order**, **Bill**, **Payment**, **Payment method**, **Payment-method breakdown**, **Invitation**, **Customer**, **Employee**, **managers and above**, **business currency**, **tax category**, **daily report**, and **soft delete**.

---

## 3. Capabilities

### 3.1 The gift card

- A gift card is a **bearer budget instrument**: it belongs to exactly one business — its **issuing venue** — carries a money **value** in the business currency, and is identified by a **QR code** and a **card number**. **Whoever holds the card may spend it**; no account is needed to redeem.
- A card is **non-reloadable** and **spent whole**: its value is consumed by a single redemption. It is valid only at its **issuing venue** and never changes currency.
- A card exists only as a **virtual card**, delivered by **email** to the person the buyer or the business names. There is no physical card.
- A card carries the buyer's optional **note** and the data that identifies it, and shows its issuing venue, value, and expiry.

### 3.2 Buying and granting a card

- A **paid card** is bought like any other purchase: on an ordering surface — the POS, a kiosk, or the Customer app — the buyer chooses the **Gift card** option, sets the **value** (at or above the business's **minimum card value**), may add a **note**, and **pays**. On settlement Project Imperium generates the card and emails it to the recipient the buyer names.
- **Employees and customers** may both buy a card. A paid card's purchase is a sale in the business currency and is taxed at the **Gift card tax rate**.
- A **granted card** is a business gift: **managers and above** add it as an **invitation** line carrying a value and no payment, and finalise it; Project Imperium then generates the card and emails it to the named recipient. A granted card is not a taxed sale.
- **No card exists before its line is settled or finalised**, and a card is never handed over in person — it is always emailed.

### 3.3 Value, currency, and expiry

- A card's **value** is set when it is issued, in the **business currency**, at any amount at or above the business's **minimum card value**.
- Every card has an **expiry date**, set by applying the business's **validity period** to its issue date; a **granted** card's date may be overridden by managers and above.
- A card is **non-reloadable** — its value never grows after issue.
- When a card reaches its **expiry date** it stops working, and any unspent value is **forfeited to the business**.

### 3.4 Redeeming a card

- A gift card is a **payment method**, offered at payment beside the other methods a bill may be settled by. To redeem one, the card's **QR code is scanned or its card number entered** — a card may be scanned or typed.
- A card is redeemed only at its **issuing venue**, at the moment a bill is paid.
- A card is applied against the bill up to its value:
  - if the card **covers the bill**, the surplus is **not returned** — no change is given — and is **forfeited to the business**; and
  - if the card is **smaller than the bill**, it pays what it can and the **remainder is settled by another method** — on a staff tab the bill stays open for it, while a self-service bill is completed by another method in the same payment.
- A bill may use **one gift card**, and a card may be **combined with another method** on the same bill.
- When a card pays a bill, the **order lines it covers are recorded as Invitation**, with a **reason** naming the gift card and its card number, so those goods keep their **stock deducted** and inventory flows correctly; a **Gift card payment** records the value applied.
- Gift-card money is counted **once**, at the card's purchase; a redemption **adds no new revenue**. A card is **consumed whole** by its first redemption.

### 3.5 Lifecycle

- A card's **status** is:
  - **Active** — issued and not yet spent, until it expires;
  - **Redeemed** — spent;
  - **Expired** — lapsed, its unspent value forfeited to the business; or
  - **Voided** — stopped by the business.
- **Managers and above may void** a card with a required, audited **reason**. Voiding stops the card and is not a money movement.
- **Refunding a paid card** is the ordinary refund flow of the payments-and-tax subject and voids the card; a **redeemed** card is not refundable.
- A card is **retained** under the platform's soft delete rule and is never hard-removed, so its redemptions and voids always reconcile.
- A venue can see its cards by lifecycle — paid, granted, redeemed, expired, voided — with their outstanding value.

### 3.6 Configuration and reporting

- A business sets its **gift-card configuration**: the **minimum card value** and the **validity period**.
- The **Gift card tax rate** is a category in the business's tax configuration, which the payments-and-tax subject owns; a paid card's purchase is taxed at it.
- In the **daily report**, a **Gift card** payment appears in its own **payment-method breakdown** column; a paid card's purchase appears as a sale and a granted card as an invitation; and a redemption adds no new revenue.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Gift-card powers |
| --- | --- |
| **Customer** | Buys a paid card for themselves or as a gift, holds it, and redeems it at the issuing venue; never grants, voids, or configures. |
| **Employee** | Everything a customer can do, plus selling paid cards on the POS and redeeming cards at payment. |
| **Manager** | Everything an employee can do, plus granting business-gift cards, overriding a granted card's expiry, voiding cards with a reason, viewing card balances, and setting the gift-card configuration. |
| **Admin/owner** | Everything a manager can do, plus the **Gift card** tax rate. |

### Who can do what

| Activity | Who |
| --- | --- |
| Buy a paid card | Any customer or employee, on the POS, a kiosk, or the Customer app |
| Grant a business-gift card (an invitation, no payment) | Managers and above |
| Set the minimum card value and the validity period | Managers and above |
| Override a granted card's expiry date | Managers and above |
| Redeem a card at payment (scan the QR or enter the number) | Anyone taking the payment — a staff member at the POS, or the customer at a self-service payment |
| Void a card, with a reason | Managers and above |
| View cards and their outstanding value | Managers and above |
| Set the Gift card tax rate | Admin/owner |
| Refund a paid card | Follows the payments-and-tax refund flow (the manager on duty decides) |
