# Per-feature product documents — template & conventions

> **About this file.** This is the shared **template and rulebook** for the per-feature product documents under `docs/product/`. It is not itself a subject document. It defines the skeleton every subject document copies and the conventions those documents obey.

Each subject document describes **one subject** — orders, inventories, loyalty, and so on — as the **target-state source of truth** for that subject, written for two readers: AI agents that build Project Imperium and engineers onboarding onto it. Capabilities are stated as commitments, not a status report, and the document describes the **business** — its behaviour and rules — never the implementation.

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

## Business language, not implementation

- The document describes **what the feature is and does**, in business language. It contains **no implementation detail**: no code, no field, model, schema, or type names, no source file paths, no API routes, and no database collections.
- Do **not** name a business concept by its code identifier. Write "average rating and rating count", not `averageRating`; "the job-role list", not `userRolesEnum`; "delivery enabled", not `acceptsDelivery`.
- There is **no current-vs-target audit** and no "what exists today" section. The document is target-state throughout: state the committed behaviour, never the gap from the current code, and never a route, model, or screen that happens to exist today.

## Commitments, not status

- State capabilities as commitments ("the business can…", "Project Imperium records…"), never as a status report, and carry **no built/planned tags**.

## Roles and entitlements

- Every document answers "who can do this?" for its subject: the **base access layer** (admin, manager, employee, customer), the **job roles** involved, and any **per-user capabilities** that gate the subject.

## Consistency review

Before a document is done, check every item:

- [ ] Vocabulary matches the established product/domain terms; no invented synonyms.
- [ ] No link to any other document; references are prose-only (self-contained).
- [ ] No implementation detail — no code, identifiers, source paths, routes, models, schemas, or database collections.
- [ ] No "what exists today" audit, no current-vs-target gap, and no built/planned status tags.
- [ ] It contradicts no accepted ADR and no sibling product document; any ADR decision it changes has been amended or superseded in the same change.
- [ ] It follows [the skeleton](#the-skeleton).
- [ ] It is listed in `AGENTS.md` with a one-line description.

---

## The skeleton

```markdown
# <Subject>

> **About this document.** This is the **target-state source of truth** for <subject> in Project Imperium. It is written for two readers: AI agents that build the product and engineers onboarding onto it. It describes <subject> as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

<!-- What this subject covers, and what it deliberately does not. Name the product-overview themes it expands and the sibling subjects it borders — in prose only, no links. -->

## 2. Domain model and vocabulary

<!-- The entities this subject introduces or owns, and each domain term it adds. Reuse established terms; extend the domain language rather than inventing synonyms. Define a term here only if this subject introduces it. -->

## 3. Capabilities

<!-- The behaviour of the subject, stated as commitments in business language. Use a subsection per capability where that reads better. No status tags, no implementation detail. -->

## 4. Roles and entitlements

<!-- Who can do what: base access layer(s), job roles, and per-user capabilities that affect this subject. -->
```
