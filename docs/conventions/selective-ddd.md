# Selective DDD (high-impact only)

Use Domain-Driven Design selectively, only where it improves correctness and change safety in complex business behavior. Keep simple CRUD flows simple.

This project already follows SDD and TDD. This convention adds a DDD lens for implementation choices without changing product behavior defined in `docs/product/*`.

## Goals

- Protect critical invariants in complex domains.
- Reduce rule duplication across routes/services.
- Keep APIs and DTO contracts stable while internals evolve.
- Avoid unnecessary architecture weight in simple areas.

## Scope rule

Apply DDD when a slice has at least one of:

- many cross-field or cross-entity invariants
- multi-step state transitions with failure/rollback rules
- concurrency-sensitive behavior
- duplicated business rules in multiple handlers
- high-cost regressions if rules drift

Do not force DDD when a slice is straightforward CRUD with low coupling.

## Where to apply first in Project Imperium

Prioritize these subjects because they have the highest complexity and consistency risk:

1. Order lifecycle and billing semantics  
   (`docs/product/orders.md`, `docs/product/order-flow.md`, `docs/product/payments-and-tax.md`, `docs/product/realtime-and-concurrency.md`)
2. Inventory and purchasing consistency  
   (`docs/product/inventories.md`, `docs/product/purchases.md`, `docs/product/supplier-goods.md`, `docs/product/business-goods.md`)
3. Workforce time and cash responsibility  
   (`docs/product/time-control.md`, `docs/product/employee-cash-out.md`, `docs/product/schedules.md`, `docs/product/payroll.md`)
4. Financial/reporting reconciliations  
   (`docs/product/sales-reports.md`, `docs/product/business-reports.md`, `docs/product/business-metrics.md`)

## Where to keep it lightweight

Default to existing thin-route + schema-validation patterns for simpler areas, for example:

- static/reference-style configuration endpoints
- simple profile and catalog CRUD with minimal invariants
- read-heavy endpoints that mainly compose already-validated data

## Tactical patterns allowed (not mandatory)

Inside a selected high-impact slice, prefer:

- explicit domain services/use-cases for business decisions
- aggregate boundaries for invariant ownership
- value objects for constrained concepts reused in rules
- repository interfaces only where persistence coupling blocks testing or portability

Avoid introducing all patterns at once. Use the minimum set that solves the real problem.

## Guardrails

- No rewrite mandate: migrate per slice, behind existing route contracts.
- Keep shared Zod DTOs as boundary validation source of truth.
- Keep routes thin and transport-focused.
- Preserve existing ADR decisions unless a new ADR explicitly supersedes them.
- Every DDD refactor must be covered by behavior tests (TDD remains mandatory).

## Delivery workflow (SDD + TDD + selective DDD)

For each selected slice:

1. Confirm behavior from `docs/product/*` and relevant ADRs.
2. Identify invariants and state transitions that must not drift.
3. Add or tighten tests for those invariants first.
4. Introduce the smallest domain boundary needed.
5. Keep HTTP and schema contracts unchanged unless explicitly requested.
6. Document only the new architecture decision (ADR) if it changes implementation rules.

## Definition of done for a selective DDD change

- Product behavior unchanged unless product docs changed intentionally.
- Existing API contracts remain compatible.
- Invariant-focused tests are present and passing.
- No new accidental coupling between unrelated domains.
- Documentation updated only where ownership changed (ADR/conventions), not broad product rewrites.
