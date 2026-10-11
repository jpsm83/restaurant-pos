# Testing

- Write or update tests for the changed behavior, and run them; tests pass before you progress.
- Test external behavior, not implementation details — never assert on zod internals.
- Primary seam: the HTTP boundary via Fastify `inject()` (assert status, content type, body). Secondary seam: direct zod schema unit tests for coercion and sanitization, database-free.
- Backend: `npm test` from `backend/`; frontend: `npm test` from `frontend/`.
- Verify the real user flow too (see [debugging.md](./debugging.md)).
