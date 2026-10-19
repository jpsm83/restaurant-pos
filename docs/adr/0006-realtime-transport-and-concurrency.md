# ADR-0006: Realtime transport and concurrency mechanisms

- **Status:** Accepted
- **Date:** 2026-10-19
- **Ticket:** GitHub issue #105

## Context

Product overview and sibling subjects already promise a live, online-only platform (POS, fulfilment, stock, inbox, customer order status). Issue #105 and its grill settle the product rules in the realtime-and-concurrency subject: the whole entitled app is a live surface; disconnect blocks writes with no offline queue; structural conflicts use optimistic reject, same-attempt idempotency, lifecycle blocks, compatible concurrent adds, and no exclusive editor lock; self-service baskets are isolated per ordering session.

Those commitments force engineering choices for **how** live push and conflict detection work. Product documents must stay business-language only. Soft delete (ADR-0003), gift-card liability (ADR-0004), and Stripe Connect direction (ADR-0005) are unrelated and must not be silently overridden.

## Decision

1. **Live push transport.** Use **WebSocket** as the live push channel to connected clients (aligned with existing overview and notifications wording). Persistence-first inbox and other durable records remain the source of truth; the socket accelerates delivery and state sync for online clients. Alternative transports (SSE-only, long poll) are out of stage-1 scope unless a later ADR supersedes this point.
2. **Authoritative server.** The server is the single source of truth. Clients do not maintain an offline write queue or CRDT merge for money, stock, or kitchen work.
3. **Optimistic concurrency.** Mutating APIs that can overwrite shared structure carry a **version** (or equivalent concurrency token) the client last observed. A stale version yields a conflict response; the client must reload server truth and retry with a new intent when appropriate.
4. **Attempt idempotency.** Send, pay, and fulfilment-advance (and other critical mutations named by product) accept a client-generated **idempotency key** (attempt identity) scoped so that retries and double-taps of the **same attempt** replay the stored outcome. A new intentional act uses a new key. Same key with a different payload is rejected.
5. **Lifecycle enforcement.** Domain state machines (instance status, sent vs draft, fulfilment forward-only, Closed bill) are enforced on the server independently of version checks so an already-committed outcome cannot be duplicated by a racing second intent.
6. **Self-service session isolation.** Baskets are keyed to the **ordering session**, not solely to the sales point, so concurrent QR/delivery/kiosk customers never share or merge baskets.
7. **No exclusive editor lock** in stage 1. Concurrent viewers of the same staff tab are allowed; live push plus the rules above cover races.
8. **Product boundary.** Business outcomes live in the realtime-and-concurrency subject (and order-flow thicken for session isolation). This ADR does not change ADR-0003, ADR-0004, or ADR-0005.

## Consequences

- **Positive:** Build tickets can implement one transport and one conflict stack without inventing double-pay or double-send behaviour; product docs stay free of routes and schemas.
- **Negative / follow-on:** Clients must hold version tokens and attempt keys; reconnect paths must resync before enabling writes; load and fan-out of “entire app live” must be engineered carefully (rooms/topics, backpressure) in later build work — not prescribed here beyond WebSocket + server authority.
- **Does not supersede** ADR-0003–0005.
