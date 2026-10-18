# Business goods

> **About this document.** This is the **target-state source of truth** for the business goods a venue sells in Project Imperium. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes business goods as they are *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the **sellable menu item**: what a venue offers for sale, how each item is composed, priced, categorised, described, and made available, and how its cost and allergens are derived. It owns:

- the good's **identity** — name, keyword, main category and subcategory, description, and images;
- the **kinds of business good** — simple items, recipe-based items, and combos / set menus;
- the **components** a good is built from — its ingredients and, for a combo, its members;
- the good's **derived cost** and **derived allergens**;
- the good's **selling price**;
- the good's **on-menu state** and **availability state**;
- the good's **preparation time**;
- the **add-on list**; and
- the good's **deletion**.

It deliberately does **not** cover:

- the **supplier good** — the purchasable item, its unit of stock, purchase unit, price math, budget impact, its own allergens, par level and minimum required, in-use state and deletion belong to the supplier-goods subject. A business good is built from supplier goods, but owns neither those goods nor their prices.
- **stock on hand and counting** — the system count, physical counts, deviation, variance and monthly close belong to the inventories subject. This subject only *reads* the stock a component needs before a good can be sold; it never counts stock.
- **buying and receiving** — the purchase record, its lines, and the inventory increment on receipt belong to the purchases subject.
- **ordering, billing and fulfilment** — the order lifecycle, how an add-on is attached to an order at the till, and the service surfaces belong to the orders and order-flow subjects; billing and settlement belong to the payments-and-tax subject. This subject defines the sellable item those orders point at.
- **promotions** — the discount rules and their scoping belong to the promotions subject. This subject owns the **menu subcategories** a promotion may target and the rule that a discount lands on the **main good**, never on an add-on.
- the **business**, its **currency**, and its **tax rates** — the business and payments-and-tax subjects own them. A good prices in the single currency of its business and carries a **tax category**; the **rates** behind that category, and how tax is computed on a sale, belong to the payments-and-tax subject.
- **targets, margins, and reports** — the business-metrics and business-reports subjects own them. This subject carries no margin, markup, or cost target.
- **printers and kitchen routing** — the printers-and-screens subject owns routing a good's ticket by category.
- **notifications** — the notifications subject owns alert delivery.

---

## 2. Domain model and vocabulary

### Entities

- **Business good** — a **sellable menu item**. A business good belongs to **exactly one Business** and is **never shared across venues**; another venue's menu is invisible to it. Every business good is built from **components**, from which its **cost** and **allergens** are derived. It carries its own name, keyword, category and subcategory, description, images, selling price, availability, preparation time, and **tax category**.

### The kinds of business good

- **Simple item** — a business good with **one supplier-good component**: an item the venue buys and resells as it is ("a coke"). Its cost and allergens are the supplier good's.
- **Recipe-based item** — a business good with **one or more supplier-good components**: an item the venue makes from ingredients. Its cost is the sum of its ingredients' costs and its allergens are their union.
- **Combo / set menu** — a business good whose components are **member business goods**: a predefined group sold together ("a cheeseburger, fries, and a coke"). It has its **own selling price**; its cost and allergens are derived from its members.

A good is exactly **one** of these kinds, determined by its components — never declared by hand and never more than one.

### Terms this subject introduces

- **Component** — a part a business good is built from, together with the quantity needed. A component is a **supplier good** for a simple or recipe-based item, or a **member business good** for a combo.
- **Ingredient** — a supplier good used as a component of a simple or recipe-based item, with the quantity the item needs and the measurement unit it is expressed in.
- **Member** — a business good used as a component of a combo, with the quantity the combo includes. A combo's members are **business goods only**; a member may never itself be a combo.
- **Derived cost** — the good's cost to the business, computed **live** from its components' current prices and summed up the chain. It is **read-only** and never entered by hand.
- **Selling price** — what the venue charges for the good, set freely by the venue in the **business currency**. It is **tax-inclusive**: it already contains the good's tax, which the payments-and-tax subject draws out.
- **Tax category** — the category a good is taxed under, chosen from the **goods tax categories** the payments-and-tax subject owns (Food, Non-alcoholic drinks, Alcoholic drinks, Merchandise, Tobacco — never **Tip**, which rates tips alone). Every good maps to exactly one. Gift-card funding is not a business good.
- **On menu** — the good is part of the venue's sellable menu.
- **Availability state** — whether the good can be ordered right now: **Available**, **Sold out**, or **Manually unavailable**.
- **Preparation time** — the minutes the kitchen or bar needs to prepare the good.
- **Main category** — the good's place on the menu, chosen from the platform's sellable categories: **Food**, **Beverage**, **Set Menu**, **Merchandise**, and **Other**.
- **Subcategory** — a node in the venue's **subcategory tree** beneath a main category. The platform seeds a **default tree** for each main category and the venue may add its own nodes at any depth; a good belongs to exactly one subcategory, and a subcategory covers everything at or beneath it.
- **Add-on** — a business good **flagged as an add-on**: sold alongside a main good, but never on its own.
- **Keyword** — a short search term for finding the good.

The **Business**, the **Supplier good**, and the **Unit of stock** are established terms; this subject does not redefine them. Throughout this document, "item" means a business good.

---

## 3. Capabilities

### 3.1 The good's identity

A business keeps its own menu of business goods.

- Every good carries a **name** (required), a **keyword** (required — a short search term for finding it), a **main category** (required, from the platform's sellable categories), a **subcategory** (required, a node in that category's subcategory tree), a **tax category** (required, from the goods tax categories the payments-and-tax subject owns), an optional **description**, and up to **three optional images**.
- Within its business, a good's **name is unique among active goods**; the same name may repeat across different venues.
- A good is **created complete**: its name, keyword, category and subcategory, components, selling price, and preparation time are all present at creation. There is **no draft**.
- A business good is part of the venue's **internal menu configuration**; what a customer sees of it is limited to its public details (§4).

### 3.2 Kinds and components

- A good's kind is carried by its components: a **simple item** is a single supplier good **resold as bought**; a **recipe-based item** is **prepared** by the venue from **one or more** ingredients; a **combo** is a group of **one or more** member business goods. A good is exactly one kind, and it cannot mix ingredients and members.
- Every good has **at least one component** — it is always built from supplier goods, either directly or through members.
- A **component carries a quantity**. An **ingredient** also carries the measurement unit the recipe expresses it in; that unit may differ from the supplier good's own unit of stock where the units are compatible, and Project Imperium converts between them.
- A **combo's members are business goods**, each simple or recipe-based. A member may **never** be a combo, so combos are **one level deep** — there are no combos of combos.
- A supplier good sold on its own inside a group is represented by its own **simple item**; a combo never points straight at a supplier good.
- **Variants are separate goods.** Project Imperium carries no size or portion variant: a different size is its own business good with its own components and selling price (a small fries and a large fries are two goods).

### 3.3 Derived cost

- A good's **cost** is the sum of its components' costs:
  - a **simple item's** cost is its supplier good's current price, for the quantity it uses;
  - a **recipe-based item's** cost is the sum of its ingredients' costs, at each supplier good's current price and the quantity the recipe uses;
  - a **combo's** cost is the sum of its members' **derived costs**, at the quantity the combo includes.
- Cost is **derived and read-only** — the venue never enters it, and a client never sets it.
- Cost is **live**: when a supplier good's price changes, the cost of every good made from it updates; when a member's cost changes, every combo containing it updates. A good always reflects **today's** prices and never a stale snapshot.
- The good carries **one current cost** and **no cost history**; historical prices live on the purchase records made with the supplier goods.

### 3.4 Selling price

- The venue sets each good's **selling price** freely, in the **business currency**. The price is **tax-inclusive**: it already contains the good's tax, which the payments-and-tax subject draws out. A price may sit above, at, or below cost — the venue decides.
- There is **no suggested price, no desired margin or markup, and no cost target** anywhere in this subject. Project Imperium shows the venue the **derived cost** and the venue chooses what to charge.
- The good carries **one current selling price** and **no price history**.

### 3.5 Allergens

- A good's **allergens are derived** from its components, drawn from the platform's **canonical allergen set** (Gluten, Crustaceans, Eggs, Fish, Peanuts, Soybeans, Milk, Nuts, Celery, Mustard, Sesame, Sulphur dioxide, Lupin, and Molluscs):
  - a **simple item** presents its supplier good's allergens;
  - a **recipe-based item** presents the union of its ingredients' allergens;
  - a **combo** presents the union of its members' allergens, rolled up through them.
- The venue **never enters or edits** allergens on the business good; they are **live**, following the supplier goods they originate from. Each supplier good owns its own declaration; this subject only presents the union.

### 3.6 On menu

- **On menu** is the venue's decision that a good is part of its sellable menu at all.
- An **off-menu** good is hidden from customers and cannot be ordered, but it is kept, priced, and composed — the venue can bring it back later.
- On-menu is independent of availability: a good may be on the menu but not orderable right now.

### 3.7 Availability

Every good carries an availability state of **Available**, **Sold out**, or **Manually unavailable**.

- **Available** — the good can be ordered.
- **Sold out** — set **automatically by Project Imperium** when any component is not satisfied: an ingredient's supplier good is deleted or has **insufficient stock on hand** for the quantity needed, or a member exists but is itself sold out or manually unavailable. This state is **live**: it clears the moment stock or the member recovers.
- **Manually unavailable** — set by a manager or an employee holding the capability, to take a dish off sale by hand ("86 the burger") even when Project Imperium would consider it available. It sticks until a human clears it **or** until the **start of the next work day**, when it is cleared automatically.
- A manager — or an employee holding the capability — may bring a manually unavailable good back **only when its components allow it**; if stock or a member still blocks the good, it stays **Sold out** rather than becoming available.
- A simple or recipe-based item with all ingredients stocked, and a combo with all members available, is **Available**.
- Availability governs **ordering**, not visibility alone: a sold-out or manually unavailable good that is on the menu is shown but cannot be ordered.

### 3.8 Add-ons

- **Add-ons are a single list for the venue** — not configured per main good. A manager flags an ordinary business good as an add-on, and it is then offered **alongside every sellable good**, combos included.
- An add-on is a **normal business good**: it has its own name, category, components, **derived cost**, **selling price**, preparation time, and **availability**, and it is **never sold on its own**.
- An add-on can be sold out or 86'd like any other good; its state follows the same rules and is **live**.
- A **promotion applies to the main good only** and never to an add-on line.
- Because the list is global, removing a main good from the menu never leaves a dangling add-on configuration.

### 3.9 Categories and menu groups

- Every good carries a **main category** from the platform's sellable categories — **Food, Beverage, Set Menu, Merchandise, Other** — and belongs to exactly one **subcategory** node in that category's subcategory tree.
- The venue's menu is organized as a **subcategory tree** beneath each main category. The platform seeds a **default tree** per main category and the venue may add its own subcategories at any depth; a subcategory covers everything at or beneath it, which is the scope a promotion targets.
- Combos normally carry the **Set Menu** category, since a combo is its own menu group option; the category is otherwise the venue's choice and independent of the good's kind.
- Category is used to place a good on the menu and to route its ticket for printing; the printers-and-screens subject owns that routing.

### 3.10 Preparation time

- Every good carries a **preparation time**, **required at creation**, in minutes — the time the kitchen or bar needs to prepare it.
- It is editable later by managers and above, and feeds the venue's fulfilment and delivery timing.

### 3.11 Deletion

- A good is **soft-deleted**: the record is retained and marked deleted, never hard-removed, and may be reactivated; uniqueness is enforced among active goods.
- A good may be **deleted only when nothing live points at it**:
  - no **open order** uses it (as a main good or as an add-on);
  - it is not a **member of a combo**.
  If either holds, deletion is **blocked** and the venue is told what to clear first.
- A **promotion never blocks deletion**: a promotion targets a subcategory, not a good, so a good may be deleted while a promotion covers it, and the promotion simply stops covering what is gone.
- Being on the **global add-on list does not block deletion**: deleting such a good simply removes it from the list.
- Deleting a good removes it from the menu and from selection; its **past orders and reports remain as history**.
- Deleting a good the venue will never sell again is a **deliberate act**, distinct from merely taking it off the menu.

### 3.12 Everything derived is live

Cost, allergens, and availability are **never stored snapshots**. A change anywhere in the chain — a supplier good's price or stock, a member's availability, a component added or removed — is reflected in every affected business good at once, so a venue's menu always tells the truth about what a dish costs, what it contains, and whether it can be sold. This is a founding principle: the data is connected and accurate in real time across the whole product.

---

## 4. Roles and entitlements

Business goods are menu configuration. Customers see only what is published and orderable; the venue's staff see the menu; only managers and above see the internal economics.

### Base access layers

| Layer | Business-good powers |
| --- | --- |
| **Customer** | Sees only goods that are **on the menu and available**, with public details only (name, images, description, category, selling price, allergens, preparation time). Never sees off-menu or unavailable goods, and never cost. |
| **Employee** | Sees the **available** part of the menu; may mark a good **manually unavailable** and clear the mark if granted the capability, subject to the component rule. Never sees cost. |
| **Manager** | Creates, edits, prices, and deletes goods; composes recipes and combos; sets categories, images, keyword, description, and preparation time; flags add-ons; marks goods on or off menu; and manages availability. Sees cost. |
| **Admin/owner** | Everything a manager can do, plus full venue control. |
| **Superadmin** | None. The platform operator never manages a venue's menu. |

### Who can do what

| Activity | Who |
| --- | --- |
| Create, edit, and delete a business good | Managers and above |
| Compose a recipe or a combo | Managers and above |
| Set the selling price, category, subcategory, tax category, keyword, description, images, and preparation time | Managers and above |
| Put a good on or off the menu | Managers and above |
| Flag a good as an add-on | Managers and above |
| Mark a good manually unavailable, and clear the mark | Managers and above; employees holding the capability |
| View cost and derived values | Managers and above |
| View the available menu | Employees, and customers for on-menu available goods |
| View another venue's menu | No one — menus are private to their business |

Menu authoring sits with the managers who run the kitchen and the menu; the frontline 86 switch sits with the staff on the floor, bounded by what the components actually allow.
