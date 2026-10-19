# ADR-0004: Gift cards as liability; tax and revenue at redemption

- **Status:** Accepted
- **Date:** 2026-10-18

## Context

Gift cards were specified as a **taxed sale at issue** under a **Gift card** tax category, with redemption recorded by marking covered order lines as **invitations** so revenue was not counted twice. That model keeps cash and reporting simple, but it is wrong for a **multi-purpose** card that can pay mixed goods (food, drinks, merchandise, and so on):

- tax belongs on the **goods supplied**, at their category rates, when they are sold — not on a flat “gift card” rate at funding;
- issue is **stored value / customer liability**, not product revenue;
- using **Invitation** for redemption conflates comps with tender and distorts sales, tax, and stock semantics.

Product documents (`gift-cards`, `payments-and-tax`, `sales-reports`, `business-reports`, `monetization`, and the product overview) encoded the old model. A grill on 2026-10-18 settled the replacement behaviour.

## Decision

Adopt **deposit / liability at issue** and **sale + tax at redemption** as Project Imperium’s default worldwide gift-card model.

Concretely:

1. **Paid issue** is a **standalone deposit checkout** (not a menu/business-good line, not mixed on a meal bill). Cash in creates **customer liability**. There is **no product sale** and **no product tax** at issue. Gift card may **not** tender another gift-card purchase.
2. **Granted issue** creates the same spendable liability without cash intake.
3. **Redemption** is ordinary settlement: order lines stay **Paid** (never Invitation for this path); tax follows each line’s category; gift card is a **payment method** only. A card may pay any ordinary bill (including mixed baskets and tips). **At most one** gift card per bill, combinable with other methods. Apply up to `min(remaining balance, outstanding)`.
4. Cards keep a **remaining balance** and support **partial redemption** across visits. They stay **non-reloadable**, **bearer**, **virtual (email)**, **business currency**, and **issuing-venue only**.
5. **Over-balance on a bill** leaves the unused amount on the card (no surplus forfeiture at payment).
6. **Expiry** with remaining balance, and **void with remaining balance**, move that amount to **forfeiture income** (labeled Expired vs Voided). No product-category tax on breakage in this decision; not commissionable.
7. **Refund of a card purchase** is allowed **only if the card is fully unspent** (no redemption ever). **Meal refunds** that were paid by gift card prefer **restoring balance to that card** when the card can still hold value; restore **does not extend** expiry.
8. Every card has an append-only **gift-card ledger** of audited events.
9. **Remove** the **Gift card** product-sale **tax category** from the platform set (v1). No dual “tax at issue” mode until a later ADR for a concrete jurisdiction.
10. **Commissionable sales** are **paid product sales** after voids and refunds across tenders — **including** sales paid (in whole or part) by gift card, **including** when the card was granted. **Exclude** deposit intake at issue and **exclude** forfeitures. (Weekly commission composition is owned by monetization / ADR-0005 — base commission only; no card-recovery term.)
11. Reporting distinguishes **deposit intake**, **product sales at redemption**, **forfeiture**, and **outstanding liability**.

Target-state product documents must match this decision; the former tax-at-issue and invitation-on-redeem rules are superseded.

## Consequences

- **Positive:** Tax timing matches multi-purpose stored-value practice; Invitation stays comps-only; stock, sales, and tax stay aligned on redemption; outstanding liability is visible to accountants.
- **Negative / follow-on:** Wider doc and later implementation blast radius (gift cards, payments/tax, reports, monetization). Breakage tax remains a venue/accountant concern outside product remittance (platform records amounts only). Company-wide redeem, reloadable cards, and jurisdiction-specific tax-at-issue modes are explicitly out of scope until new ADRs.
- **Supersedes** contradictory statements in product docs that taxed gift-card purchases at issue, used Invitation on redeem, or included paid gift-card issues in commissionable sales while excluding redemptions.
