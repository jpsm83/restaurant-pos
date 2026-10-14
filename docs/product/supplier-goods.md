# Supplier goods

> **About this document.** This is the **target-state source of truth** for the supplier goods a venue buys and stocks in POS. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes supplier goods as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **purchasable item and the unit of stock**: the goods a business buys from a supplier, and how each is measured, priced, classified, and used. It owns:

- the supplier good's **identity** — name, keyword, category and subcategory, description, and images;
- the **unit of stock**, the **purchase unit**, and the **price math** between them;
- the good's **budget impact**;
- the good's **allergens**;
- the good's **par level** and **minimum required**;
- the good's **in-use state**; and
- the good's **deletion**.

It deliberately does **not** cover:

- the **supplier** — the vendor's profile, address, contacts, tax number, in-use lifecycle and deletion, the supplier-to-goods relationship, purchase history, and goods requests belong to the suppliers subject. This subject owns the goods themselves; every good belongs to exactly one supplier.
- the **purchase record** — its lines and their requested-versus-delivered quantities, receipt photos, the inventory increment, one-time purchases, delivery acceptance, and the reason-and-audit rule for line edits belong to the purchases subject. This subject defines the good those lines point at.
- **stock counting and waste** — the system count, physical counts, deviation, variance, waste computation, and the monthly close belong to the inventories subject, which also owns the **cadence of counting** and when each good was **last counted**. This subject carries **no count schedule**.
- **business goods** (sellable items and their recipes) and the **cost and allergens derived** from a recipe's ingredients — the business-goods subject owns them. This subject owns the good's own allergens and its price.
- the **waste thresholds** a good's budget impact selects — the business-metrics subject owns them; this subject owns the budget impact the good carries.
- the **measurement conversions** used when a recipe or a count expresses a good in a different but compatible unit — the consuming subject owns that capability; this subject states only the good's own unit of stock.
- the **Business** and its tenancy — the business subject owns that.

---

## 2. Domain model and vocabulary

### Entities

- **Supplier good** — the purchasable item and the **unit of stock**. A supplier good belongs to **exactly one Business** and **exactly one Supplier**; it is **never shared across venues or suppliers** and is never visible to customers. It carries its own identity, units, price, budget impact, allergens, par level and minimum required, images, and **in-use state**, and it is the ingredient behind business goods.

### Terms this subject introduces

- **Unit of stock** — the good's single **measurement unit**: what stock is held in, counted in, and consumed in. Every quantity the platform keeps for the good is expressed in this unit.
- **Purchase unit** — the packaging the vendor sells the good in, together with **how many units of stock one purchase unit holds** and the total price of one purchase unit.
- **Price per unit of stock** — the derived, read-only price of one unit of stock.
- **Budget impact** — the good's cost-impact classification: **Very Low**, **Low**, **Medium**, **High**, or **Very High**.
- **Par level** — the stock the venue **aims to hold** for the good.
- **Minimum required** — the **floor below which the good must be reordered**.
- **In use** — the good is used on **at least one** business good. It is **derived**, never set by hand.
- **Not in use** — a good that exists, is priced and stocked, but is used on no business good. It is **not deleted** and may be used later.
- **Keyword** — a short search term for finding the good.

The **Business**, the **Supplier**, the **Purchase**, and the **Business good** are established terms; this subject does not redefine them. "Vendor" is prose for a **Supplier**.

---

## 3. Capabilities

### 3.1 The good's identity

A business keeps its own list of supplier goods.

- Every good carries a **name** (required), a **keyword** (required — a short search term for finding it), a **main category** (required, from the platform's category list), an optional **subcategory** (free text), an optional **description**, and up to **three optional images**.
- Within its supplier, a good's **name is unique among active goods**; the same name may repeat across different suppliers.
- A good is **created complete**: its name, keyword, category, supplier, unit of stock, price, budget impact, par level, and minimum required are all present at creation. There is **no draft** — a stock item must be countable and costable from the moment it exists.
- Goods are **internal to the business** — invisible to other venues and never shown to customers.

### 3.2 The unit of stock and the purchase unit

- Every good has **exactly one unit of stock**, chosen from the platform's measurement units and **required at creation**.
- A good **may** additionally define a **purchase unit** — the packaging the vendor sells it in — with **how many units of stock** one purchase unit holds.
- The unit of stock is what the good **is**: stock is always held, counted, and consumed in it. The purchase unit is the vendor's packaging only and never changes what the good is.
- A good with **no purchase unit** is priced directly per unit of stock.
- There is **no yield or usable fraction** on the good: its price is the price of the unit of stock as bought.

### 3.3 Price math

- When a good has a purchase unit, the venue enters the **total price of one purchase unit** and **how many units of stock** it holds; POS derives the **price per unit of stock** as that total price divided by that quantity, rounded to the **business currency**.
- When a good has **no purchase unit**, the venue enters the **price per unit of stock** directly.
- The derived price per unit of stock is **read-only** — a client never sets it — and is **recomputed** whenever the total price or the quantity changes.
- The good prices in the **single currency of its business**; the venue never chooses a currency on the good.
- The good carries **one current price** and **no price history**; historical prices live on the purchase records made with them.

### 3.4 Budget impact

- Every good carries a **budget impact**, **required at creation**, one of the five canonical levels: **Very Low, Low, Medium, High, Very High**.
- Budget impact grades **how much the good's cost moves the business budget**. It selects which **waste threshold** applies to the good, so the platform can measure the real cost of the good that is lost.
- The levels are **ordered**: a **higher budget impact means a lower tolerance**, because waste on an expensive good costs more.
- Changing a good's budget impact **re-points it at the matching threshold** from then on.

### 3.5 Allergens

- A good carries an **optional list of allergens** drawn from the platform's **canonical allergen set**: Gluten, Crustaceans, Eggs, Fish, Peanuts, Soybeans, Milk, Nuts, Celery, Mustard, Sesame, Sulphur dioxide, Lupin, and Molluscs.
- This subject owns the good's **own** declaration. The allergens a menu item presents are **derived** by the business-goods subject from its ingredients.

### 3.6 Par level, minimum required, and low stock

- Every good carries a **par level** and a **minimum required**, both **required at creation** and both expressed in the **unit of stock**.
- **Par level** is the stock the venue **aims to hold**; **minimum required** is the **floor below which the good must be reordered**.
- A good whose stock falls **below its minimum required** raises a **low-stock alert** to the managers on duty; the par level is the level to replenish to.
- The alert fires for **every existing good**, whether or not it is in use — nothing in the business's goods list is ignored.
- Both values are **editable** later by managers and above.

### 3.7 In use and not in use

- A good is **in use** when at least one **business good** uses it, and **not in use** otherwise. The state is **derived**, never set by hand.
- A newly created good is **not in use**. It becomes **in use automatically** when it is first applied to a business good, and returns to **not in use** if it is removed from every business good.
- **Not in use is not deletion**: the good remains in the business's goods list, keeps its price, budget impact, par level and minimum, and may be used later.
- **Every good — in use or not — is offered for purchase.** The goods list is the source of truth for what the business buys, and the venue decides what to buy; being not in use never hides a good from purchase.
- **Every existing good alerts** on low stock whether or not it is in use (see §3.6).
- A good that is **in use is protected from deletion** (see §3.8).

### 3.8 Deletion

- A good is **soft-deleted**: the record is retained and marked deleted, never hard-removed.
- A good may be **deleted only while it is not in use** — that is, while no business good uses it. If the good is **in use**, deletion is **blocked**, and the venue is told to remove it from those business goods first.
- **Deleting a good the venue will never use is a deliberate act**, distinct from a good that is merely **not in use** and may be used later. Removing an unneeded good is how the venue keeps its goods list to what it actually buys.
- Deleting a good removes it from current stock and selection; its **past purchases remain as history**.

### 3.9 The supplier relationship

- A good belongs to **exactly one supplier** and is **never moved between suppliers** — a different supplier means a new good. Two suppliers selling the same item hold **two independent goods**, each priced and configured on its own.
- A good's **in-use state is independent of its supplier's state**: a good is in use only because a business good uses it.
- Because a **supplier cannot be taken out of use or deleted while any of its goods is in use**, the venue must first remove those goods from the business goods that use them — or point those recipes at another supplier's good — before retiring the supplier. When a supplier is deleted, its goods are deleted with it; the suppliers subject owns that action.
- **One-time purchases do not create supplier goods**; they are the purchases subject's.

---

## 4. Roles and entitlements

Supplier goods are an internal, operational surface: never visible to customers.

### Base access layers

| Layer | Supplier-good powers |
| --- | --- |
| **Customer** | None. Supplier goods are never visible to customers. |
| **Employee** | None by default; a per-user capability may grant viewing. |
| **Manager** | Creates and edits goods — identity, unit of stock, purchase unit and price, budget impact, allergens, par level, and minimum required — and deletes goods that are not in use. |
| **Admin/owner** | Everything a manager can do, plus full venue control. |

### Who can do what

| Activity | Who |
| --- | --- |
| Create a supplier good | Managers and above |
| Edit a good's name, keyword, category, subcategory, description, and images | Managers and above |
| Edit a good's unit of stock, purchase unit, and price | Managers and above |
| Edit a good's budget impact, allergens, par level, and minimum required | Managers and above |
| Delete a good (only while it is not in use) | Managers and above |
| View supplier goods | Employees with the granted capability, and managers and above |

Supplier-good management sits with the managers who run purchasing and inventory, consistent with the supplier and stock surfaces.
