# Backend routes (v1)

Fastify route plugins live here, organized by domain (business, orders, inventories, ...).

- Mounted by `[backend/src/server.ts](../server.ts)` at prefix `/api/v1`.
- Each domain should export a `FastifyPluginAsync` and be registered from `routes/v1/index.ts`.

We keep this structure close to the existing legacy docs under `app/api/v1/**/README.md`, but the implementation is now in `backend/`.

