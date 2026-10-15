# ADR-0005: Contract-first API and multi-client authentication

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Project Imperium is served by one Fastify backend exposing `/api/v1` (ADR-0001). That same backend must now serve **several independent clients**: the web product app (`apps/web`, ADR-0004), the Superadmin console (`apps/admin`), and a first-party **native POS** built outside the browser. Each is released on its own schedule and none may special-case the others.

Two forces shape this:

1. **The contract must be the source of truth.** If a framework becomes a second backend — Next.js Server Actions, a server-only data layer, tRPC procedures — then a native client built in Swift, Kotlin, or React Native cannot reach those writes, and the API splits into two divergent paths.
2. **Clients authenticate differently.** A browser can hold a cookie session; a native app cannot rely on one and needs a bearer token. Both must resolve to the same identity, permissions, and tenant scope.

The existing request-validation contract already lives in strict zod DTOs and shared primitives (ADR-0001), and shared schemas live in `packages/schemas/` free of Node/Mongoose imports — a foundation a generated client can build on.

## Decision

Make the HTTP API the **single, framework-agnostic contract** for every client, and support **both authentication transports** on the same model.

Concretely:

- **Contract-first REST + OpenAPI on `/api/v1`.** The zod schemas in `packages/domain` remain the source of truth for request shapes; an **OpenAPI document is generated** from the route schemas and published as the client contract.
- **No framework-owned write path.** The web app's SSR server is a **thin render layer** and, at most, a same-origin proxy to `/api/v1`. It holds **no domain logic**. There is no tRPC, and no Server Actions / server-only data layer used as a write path, because non-JS and native clients cannot call them.
- **`packages/api-client` is derived from the contract.** A typed TypeScript client is generated (or hand-derived) from the OpenAPI document for web clients; any non-TypeScript client (Swift/Kotlin/native) uses the same document with its own generated client. `packages/domain` (enums, interfaces, zod schemas) is DOM-free so it is reusable by a React Native client too.
- **Dual authentication transport, one identity model.** The API accepts both:
  - a **cookie session** for browser clients (the existing `@fastify/cookie` flow, used by `apps/web` and `apps/admin`), and
  - an **`Authorization: Bearer` token** for native and other non-browser clients.
  Both resolve to the same user, employee membership, access layer, and business scope.
- **WebSockets connect directly to Fastify** from every client; they are not proxied through the SSR render server.
- **Versioning is additive.** `/api/v1` grows compatibly; a breaking change introduces a new version rather than mutating the existing one.
- **Errors stay RFC 9457 `application/problem+json`** (ADR-0001), unchanged, so every client formats failures identically.

## Consequences

**Positive**

- One contract serves web, admin, and native; a change lands once and every client sees it.
- Native clients are first-class, not second-class citizens routed around the web app.
- The SSR server cannot accrete hidden backend logic, keeping the API authoritative.
- A generated client removes drift between backend DTOs and client calls, and OpenAPI unlocks generated clients for non-TS platforms.
- The same identity and permission model resolves regardless of transport.

**Negative / costs**

- A generated client and an OpenAPI artifact must be maintained in the build; the pipeline has to keep them in lockstep with the schemas.
- Supporting two auth transports means two code paths on the auth layer, both needing tests.
- Keeping SSR servers logic-free is a discipline that must be reviewed for, since it is easy to "just fetch and reshape here".
- Generated native clients outside the repo cannot be validated by the same tests; the OpenAPI document becomes a published, versioned surface.

## Alternatives considered

- **tRPC.** Rejected: TypeScript-only, so the native POS and any non-TS client are excluded.
- **Next.js Server Actions / an in-framework server data layer as the primary write path.** Rejected: native and non-JS clients cannot call them, which fragments the backend into two paths.
- **Cookie sessions only.** Rejected: a native client cannot depend on a browser cookie; bearer tokens are required for non-browser clients.
- **Bearer tokens only.** Rejected: the browser already has a working cookie-session flow (ADR-0001), and forcing bearer management into the web app adds risk for no gain.
- **Hand-written per-platform clients without a shared contract.** Rejected: without a generated contract they drift from the DTOs silently.
