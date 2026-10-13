# Per-feature product documents — template & conventions

> **About this file.** This is the shared **template and rulebook** for the per-feature product documents under `docs/product/`. It is not itself a subject document. It defines the skeleton every subject document copies and the conventions those documents obey.

Each subject document describes **one subject** — orders, inventories, loyalty, and so on — as the **target-state source of truth** for that subject, written for two readers: AI agents that build POS and engineers onboarding onto it. Capabilities are stated as commitments, not a status report; the audit section is the only place current implementation status is recorded.

Every document is **self-contained** and **link-free**, and every document is listed, with a short description, in the `AGENTS.md` pointer list. That list is the only index: an agent reads `AGENTS.md`, picks the one document it needs, and loads that file alone.

---

## Applying this template

1. Grill the subject with the maintainer (`/grill-me`) **before** writing. The grill settles the open decisions and is where business-model and product advice is given; the document records only the committed behaviour and carries **no advice section**.
2. Copy the skeleton in [The skeleton](#the-skeleton).
3. Replace every `<…>` placeholder and delete the HTML-comment guidance.
4. Run the [consistency review](#consistency-review) before calling the document done.
5. Add the finished document to the `AGENTS.md` pointer list with a one-line description.

---

## Vocabulary

- Use the product's established **domain** vocabulary exactly — the Core vocabulary defined in the product overview and the terms introduced by sibling subject documents — and do not drift to synonyms. Engineering vocabulary (DTO, server-owned field, problem details, …) lives in the repository's root `GLOSSARY.md` and is not product language.
- Define a term in the subject document where the subject **introduces** it. If the term is broadly relevant to the whole product, add it to the product overview's Core vocabulary instead of defining it ad hoc per document.

## Self-contained documents

- A document contains **no link to any other document** — not to the product overview, a sibling subject, an ADR, or the glossary.
- Name other documents in prose only (for example, "the orders subject" or "ADR-0001"). The `AGENTS.md` pointer list is how a reader locates them.
- Internal anchors within the same document are allowed.

## Commitments, not status

- State capabilities as commitments ("the business can…", "POS records…"), never as a status report. No built/planned tags anywhere except the [audit section](#audit) (§5, *Current vs target*).

## Roles and entitlements

- Every document answers "who can do this?" for its subject: the **base access layer** (admin, manager, employee, customer), the **job roles** involved, and any **per-user capabilities** that gate the subject.

## Audit

- Section 5, **Current vs target** — the audit — is the **only** place that records what exists today: the subject's routes, models, and screens, compared against the target above, and the gap. Everywhere else the document stays target-state and status-free.
- A subject document must **not contradict an accepted ADR or a sibling subject document**. Settle every conflict before writing: change the document to match, or amend or supersede the ADR, so the product documents and the ADRs stay one consistent decision set — never a list of open disagreements. Where an ADR constrains the subject (a required field shape, an excluded DTO field), state the target so it complies and name the ADR in prose (for example, `ADR-0001`).

## Consistency review

Before a document is done, check every item:

- [ ] Vocabulary matches the established product/domain terms; no invented synonyms.
- [ ] No link to any other document; references are prose-only (self-contained).
- [ ] No built/planned status outside the audit section (§5, *Current vs target*).
- [ ] It contradicts no accepted ADR and no sibling product document; any ADR decision it changes has been amended or superseded in the same change.
- [ ] It follows [the skeleton](#the-skeleton).
- [ ] It is listed in `AGENTS.md` with a one-line description.

---

## The skeleton

```markdown
# <Subject>

> **About this document.** This is the **target-state source of truth** for <subject> in POS. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes <subject> as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

<!-- What this subject covers, and what it deliberately does not. Name the product-overview themes it expands and the sibling subjects it borders — in prose only, no links. -->

## 2. Domain model and vocabulary

<!-- The entities this subject introduces or owns, and each domain term it adds. Reuse established terms; extend the domain language rather than inventing synonyms. Define a term here only if this subject introduces it. -->

## 3. Capabilities

<!-- The behaviour of the subject, stated as commitments. Use a subsection per capability where that reads better. No status tags. -->

## 4. Roles and entitlements

<!-- Who can do what: base access layer(s), job roles, and per-user capabilities that affect this subject. -->

## 5. Current vs target

<!-- The only place current status is recorded: existing routes, models, and screens for this subject, compared with the target above, and the gap. Where the target implements an ADR's decision, name the ADR in prose (for example, ADR-0003). -->
