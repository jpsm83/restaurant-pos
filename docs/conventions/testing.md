# Testing

- Write or update tests for the changed behavior, and run them; tests pass before you progress.
- Test external behavior, not implementation details — never assert on zod internals.
- Primary seam: the HTTP boundary via Fastify `inject()` (assert status, content type, body). Secondary seam: direct zod schema unit tests for coercion and sanitization, database-free.
- One install at the repo root (`npm install`). Run `npm test` at the root to test every workspace, or `npm test --workspace backend` / `--workspace frontend` to scope one. See [workspace.md](../engineering/workspace.md).
- Verify the real user flow too (see [debugging.md](./debugging.md)).
