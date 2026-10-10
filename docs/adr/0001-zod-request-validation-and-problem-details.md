# ADR-0001: zod request validation and the RFC 9457 problem-details envelope

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

The Fastify backend exposes ~150 routes under `/api/v1`. Historically each route
validated input by hand: inline `!field`/`typeof` checks, scattered regexes,
enum `.includes()` calls, a generic `objDefaultValidation` helper, and a single
`isObjectIdValid` guard. Only `notifications.ts` used Fastify's native JSON
Schema, and only `auth.ts` used typed body generics.

This produced four problems:

1. **Inconsistent error responses.** Some routes returned `{ message }`, others
   leaked raw Fastify messages, and clients could not map an error to a form
   field.
2. **Uneven validation.** Some routes checked thoroughly, others trusted the
   body, so malformed data could reach the database.
3. **No sanitization.** Strings were stored with surrounding whitespace,
   control characters and HTML markup intact.
4. **Duplicated rules.** The frontend maintained its own zod form schemas that
   drifted from the backend.

## Decision

Make **zod the single boundary validator** for the backend, via the official
`@fastify/type-provider-zod`, and make **one global error handler** produce
**RFC 9457 `application/problem+json`** for every error.

Concretely:

- Add `zod` (v4) and `@fastify/type-provider-zod`; wire
  `setValidatorCompiler(validatorCompiler)` and
  `setSerializerCompiler(serializerCompiler)` globally. There is no mixed
  Ajv/zod.
- Every route declares body/params/query as a strict DTO (unknown keys
  rejected) that excludes server-owned fields. Request types are inferred from
  the schema with `z.infer`, so types and validation cannot drift.
- **Sanitization** (normalization + markup stripping) happens once at the
  boundary. No HTML-entity escaping at input; escaping stays at render time.
- Rules that depend on more than one field or on the database stay as named
  **post-parse checks** (cross-field rules); they are not forced into schemas.
- One global error handler formats every thrown error and provider validation
  failure as problem details. Validation failures return `400`. A shared
  `AppError` lets routes raise typed errors the handler formats.
- Shared zod **primitives** (ObjectId, email, trimmed/sanitized/free-text
  strings, coerced number/int/boolean, JSON-field preprocessor) live in
  `packages/schemas/`, free of Node/Mongoose imports, so the frontend can reuse
  them. Backend-only schemas and the multipart helper live in
  `backend/src/schemas/`.

## Consequences

**Positive**

- One validation path and one documented error shape for the whole API.
- Field-level, dotted error paths (`address.city`) clients can map to forms.
- Server-owned fields cannot be set by clients.
- The frontend can import the same primitives, so rules stop drifting.
- Fast, database-free schema-unit tests pin coercion and sanitization.

**Negative / costs**

- This is a large cross-cutting migration; it must proceed one domain per
  commit/PR so each diff stays reviewable.
- Setting the global zod compiler means native JSON-Schema routes stop being
  validated by Ajv. `notifications.ts`'s schema definitions were converted to
  zod in the foundation to keep the compiler coherent; the rest of that
  migration lands in its own ticket.
- The problem-details `type` base URI is a namespace identifier and does not
  need to resolve.

## Alternatives considered

- **Keep Ajv and layer zod on top.** Rejected: two validators and two error
  shapes defeats the purpose.
- **Put validation in middleware per route.** Rejected: loses the schema ↔ type
  coupling and the field-level error paths.
- **Keep `{ message }` errors and add `errors[]`.** Rejected: RFC 9457
  problem-details is a standard clients and tooling already understand.
