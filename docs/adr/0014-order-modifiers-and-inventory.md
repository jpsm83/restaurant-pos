# ADR-0014: Order modifiers — ingredient removal and choice groups

- **Status:** Accepted
- **Date:** 2026-11-02

## Context

Orders currently compose one main business good plus add-ons and an optional free-text comment. That is not enough for the two common kitchen requests a venue hears every service:

- **Remove an ingredient** — “no pickles”, “no onions”, “no cheese”.
- **Choose a preparation option** — “medium rare”, “spicy”, “oat milk”.

The first affects what the kitchen uses, so it must affect inventory and cost. The second is a label the kitchen must see but should not change the price, the stock, or the declared allergens. Treating both as add-ons is wrong: add-ons are ordinary priced goods on a global list. Treating both as free-text comments is also wrong: comments cannot be enforced, filtered, reported, or shown consistently on screens.

A grill on 2026-11-02 settled the model. The key constraints:

- `No` is structured and affects inventory and cost, but never the selling price.
- `Less` is out of scope; “less salt” or “less pickles” stays a free-text note and has no inventory effect.
- Allergens stay a property of the good as configured; a modifier never recalculates them.
- Choice groups are labels only: no price, cost, inventory, allergen, or preparation-time impact.
- The modifiable ingredient is recorded on the business good when it is created.

## Decision

1. **Two mechanisms, not one.**
   - **Ingredient removal (`No`)** applies only to a **modifiable ingredient** on a recipe-based good.
   - **Choice groups** are venue-defined reusable groups of labels (for example `Doneness`: rare, medium rare, medium, medium well, well done).
   - Free-text **order comments** remain for anything else. A comment never affects inventory, cost, allergens, or preparation time.

2. **The modifiable flag lives on the recipe component line.** A recipe-based good marks each ingredient line `modifiable: yes/no`. A simple item resold as bought has no modifiable ingredients. A combo’s members carry their own flags; the combo inherits them and presents them grouped by member. `No` is offered only for flagged ingredients.

3. **`No` never changes the selling price.** The guest pays the full configured price. The order’s **recorded cost** is reduced by the removed ingredient’s recipe cost, and inventory deducts the reduced quantity. `No` does not change the good’s preparation time or its ticket deadline.

4. **`No` never changes allergens.** A good’s derived allergens and guest-facing allergen list stay exactly as configured on the good. Removing cheese does not remove Milk from the display. This is a deliberate conservative position: the platform models declared contains only, and a removal request is not an allergy guarantee.

5. **`No` does not change availability.** Availability is computed from the full recipe. A good that is Sold out because an ingredient is short does not become orderable by removing that ingredient.

6. **Choice groups are labels only.** They carry no price, cost, inventory, allergen, or preparation-time effect. A group is single-select and may be required or optional. Groups are reused across goods. For a combo, groups attach to the member goods unless the combo itself defines its own.

7. **Both staff and self-service channels may select `No` and choice groups** where the good offers them. Self-service keeps the good’s static allergen display and still runs the allergen pre-pay confirmation.

8. **Inventory and cost follow the modified recipe.** At send, stock deducts the recipe net of removed ingredients. A cancellation restores the modified quantities. A void does not restore stock, matching the existing order rules. Theoretical usage is computed from the modified recipe.

9. **Contradictions are blocked.** `No X` plus an add-on that adds X on the same line is rejected. Multiple `No` selections on one line are allowed, one per ingredient, with no duplicates.

10. **No `Less` model.** The platform does not carry a partial-reduction quantity, percentage, or per-ingredient “less” amount. “Less” requests go through the order comment.

## Consequences

**Positive**

- The kitchen gets structured, readable removals and choices instead of ambiguous notes.
- Inventory and COGS reflect what was actually used, while the guest still pays the menu price.
- Allergen declarations stay stable and conservative.
- Choice groups are cheap to add and do not touch pricing, stock, or allergen logic.

**Negative / trade-offs**

- The order line and recipe component gain modifier fields and a modified-cost calculation.
- Combos need member-grouped modifier UI.
- `No` and comments can both be used; staff must learn which one affects inventory.
- Report and ticket rendering must show removals and choices clearly without turning them into add-on lines.

**Follow-ups**

- Add modifier fields to the order-line schema and to prep-ticket rendering.
- Extend theoretical-usage derivation in inventory to net out `No` removals.
- Add a “Modified” marker to prep surfaces, bills, and receipts where the line carries a modifier.

**Supersedes:** no prior ADR. This ADR establishes the modifier model.
