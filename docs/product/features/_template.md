# Per-feature product documents — template & conventions

> **About this file.** This is the **shared template and rulebook** for the per-feature product documents under `docs/product/features/`. It is not itself a subject document. It defines the skeleton every subject document copies and the conventions those documents obey. Read the product's target-state source of truth, [`overview.md`](../overview.md), first.

Each subject document describes **one subject** — orders, inventories, loyalty, and so on — as the **target-state source of truth** for that subject. Like [`overview.md`](../overview.md), it is written for two readers: AI agents that build POS, and engineers onboarding onto it. Capabilities are stated as commitments, not a status report. The **audit section is the single exception** — the only place current implementation status is recorded.

---

## Applying this template

1. Grill the subject with the maintainer (`/grill-me`) **before** writing. The grill settles the open decisions; the document then records them.
2. Copy the skeleton in [The skeleton](#the-skeleton).
3. Replace every `<…>` placeholder and delete the HTML-comment guidance.
4. Run the [consistency review](#consistency-review) before calling the document done.

---

## Vocabulary

- Product and domain terms come from the **Core vocabulary** table in [`overview.md`](../overview.md) and from sibling subject documents. Engineering vocabulary (DTO, server-owned field, problem details, …) lives in the root [`GLOSSARY.md`](../../../GLOSSARY.md).
- Use these terms exactly; do not drift to synonyms.
- Define a term in the subject document where the subject **introduces** it. If the term is broadly relevant to the whole product, add it to the Core vocabulary table in [`overview.md`](../overview.md) instead of defining it ad hoc.

## Link hygiene

- A subject document links **only** to targets inside `docs/product/` (`../overview.md`, `./<sibling>.md`), to `docs/adr/` (`../../adr/`), and to the root [`GLOSSARY.md`](../../../GLOSSARY.md). No other targets.
- Never link into the deleted `docs/features/` or `docs/engineering/` trees.
- Use relative links, and make sure every one resolves.

## Commitments, not status

- State capabilities as commitments ("the business can…", "POS records…"), never as a status report. No built/planned tags anywhere except the [audit section](#audit) (§6, *Current vs target*).

## Roles and entitlements

- Every document answers "who can do this?" for its subject: the **base access layer** (admin, manager, employee, customer), the **job roles** involved, and any **per-user capabilities** that gate the subject. See [`overview.md` §5](../overview.md#5-access-roles-and-the-mode-chooser).

## Audit

- Section 6, **Current vs target** — the audit — is the **only** place that records what exists today: the subject's routes, models, and screens, compared against the target above, and the gap. Everywhere else the document stays target-state and status-free.
- If the subject contradicts an existing ADR, surface it explicitly in the audit's **ADR conflicts** subsection (link the ADR) rather than silently overriding it.

## Consistency review

Before a document is done, check every item:

- [ ] Vocabulary matches [`overview.md`](../overview.md) and [`GLOSSARY.md`](../../../GLOSSARY.md); no invented synonyms.
- [ ] No built/planned status outside the audit section (§6, *Current vs target*).
- [ ] Every relative link resolves (none into deleted trees).
- [ ] Nothing contradicts [`overview.md`](../overview.md); any conflict is surfaced and resolved deliberately in one or the other.
- [ ] Contradictions with an existing ADR are flagged.
- [ ] It follows [the skeleton](#the-skeleton).

---

## The skeleton

```markdown
# <Subject>

> **About this document.** This is the **target-state source of truth** for <subject> in POS. It is written for two readers: AI agents that build the product, and engineers onboarding onto it. It describes <subject> as it is *meant to be* — capabilities are stated as commitments, without built/planned tags. It builds on [`overview.md`](../overview.md), whose vocabulary it reuses; engineering vocabulary (DTO, server-owned field, …) lives in the root [`GLOSSARY.md`](../../../GLOSSARY.md).

---

## 1. Scope

<!-- What this subject covers, and what it deliberately does not. Link the overview section(s) it expands and name the sibling subject documents it borders. -->

## 2. Domain model and vocabulary

<!-- The entities this subject introduces or owns, and each domain term it adds. Reuse overview/GLOSSARY terms; extend the domain language rather than inventing synonyms. Define a term here only if this subject introduces it; broadly relevant terms belong in overview.md's Core vocabulary. -->

## 3. Capabilities

<!-- The behaviour of the subject, stated as commitments. Use a subsection per capability where that reads better. No status tags. -->

## 4. Roles and entitlements

<!-- Who can do what: base access layer(s), job roles, and per-user capabilities that affect this subject. -->

## 5. Product and business advice

<!-- Explicit recommendations — monetisation, retention, pricing, operational best practice, risks. Clearly advice, kept separate from the committed behaviour in §3. -->

## 6. Current vs target

<!-- The only place current status is recorded: existing routes, models, and screens for this subject, compared with the target above, and the gap. -->

### ADR conflicts

<!-- Any contradiction with an existing ADR (link it), surfaced rather than silently overridden. -->

## 7. Where to go next

- [`overview.md`](../overview.md) — the product overview and this subject's place in it.
- Sibling subject documents in this folder.
- [`docs/adr/`](../../adr/) — architecture decisions affecting this subject.
```

---

## Where to go next

- [`overview.md`](../overview.md) — the product's target-state source of truth and core vocabulary.
- Sibling subject documents — one per subject, in this folder.
- [`docs/adr/`](../../adr/) — architecture decisions.
