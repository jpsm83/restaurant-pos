# Glossary

Shared vocabulary for the restaurant-pos codebase. Use these terms exactly;
don't drift to synonyms the glossary avoids.

## DTO

Data Transfer Object. A strict zod schema that describes **only the fields a
client may send** for one route (body, params, query). Unknown keys are
rejected. DTOs are not model mirrors: they exclude every [server-owned
field](#server-owned-field) and are the single source of request validation and
request types. Client-submitted DTOs live in `packages/schemas/`; backend-only
DTOs and helpers live in `backend/src/schemas/`.

_Avoid_: "request model", "payload schema".

## Server-owned field

A value the server derives or controls and a client must never set:
`password` on reads, `verificationToken`, `resetPasswordToken`,
`resetPasswordExpires`, `refreshSessionVersion`, `emailVerified`,
`averageRating`, `ratingCount`, computed `totalAmount`, `qrCode`. Server-owned
fields are excluded from every DTO; if a client sends one it is rejected as an
unknown key.

## Source of truth

Where a definition actually lives. The Mongoose models in `backend/src/models/`
are the **domain** source of truth (fields, enums, computed values). A route's
zod DTO is the source of truth for **what a client may send**. A parity test
asserts that DTO field names match the intended model fields so the two cannot
drift silently.

## Sanitization

Normalization plus markup stripping applied once at the HTTP boundary:

- trim and collapse whitespace,
- strip control characters and null bytes,
- lowercase emails,
- coerce numeric and boolean strings (essential for multipart),
- strip HTML markup from free-text fields.

No HTML-entity escaping happens at input; escaping stays at render time so
stored text is not double-escaped.

## Cross-field rule

A validation rule that depends on more than one field, or on the database, and
therefore cannot live in a field-level schema. Cross-field rules stay as named
post-parse checks (e.g. `ordersArrValidation`, `isScheduleOverlapping`,
occupancy guards) called after the DTO has parsed.

## Problem details

The RFC 9457 error document, served as `application/problem+json`. Every error
response — thrown error, provider validation failure, unexpected exception — is
produced by one global handler and has the shape `{ type, title, status,
detail, instance, errors? }`. `type` is
`https://restaurant-pos.app/errors/<slug>`; `errors[]` carries field-level
errors with dotted paths (`address.city`) for validation failures. Validation
failures return `400`.

## Multipart helper

The shared `parseMultipart` function in `backend/src/schemas/multipart.ts`. It
buffers `req.parts()`, JSON-parses designated fields, collects files, and
validates the resulting field object against a DTO — so multipart routes
validate exactly like JSON routes instead of hand-parsing strings.

## AppError

The typed error routes raise (`backend/src/errors/appError.ts`). The global
handler formats every `AppError` as a problem-details document. Routes must not
hand-build error bodies.
