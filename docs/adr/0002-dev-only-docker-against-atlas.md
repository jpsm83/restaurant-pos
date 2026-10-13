# ADR-0002: Dev-only Docker environment against Atlas

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

The app only ran on one developer's machine, set up by hand: install the root
npm workspace, then run the backend and frontend in two separate terminals.
Nothing guaranteed another machine (or a new contributor) could reproduce that
setup, and the Node version the app is built against was not recorded anywhere.

The database is MongoDB Atlas — a shared source of truth in the cloud. An
approach to "run anywhere" is to reach for a Docker database container with a
volume, but a volume lives on one host and cannot carry data between machines,
so it solves a problem we do not have while creating a second, divergent
database.

## Decision

Add a **dev-only Docker environment** that runs both the backend and the
frontend, with hot reload, against the **same Atlas database the app already
uses**. Concretely:

- One root `Dockerfile` based on Node 26 installs the workspace dependencies;
  both services build from it and differ only by the command they run. No
  production image is produced.
- One root `docker-compose.yml` defines two services, `backend` and `frontend`,
  and **no database service**.
- The repo root is bind-mounted so host edits hot-reload in place; anonymous
  volumes protect the container-built `node_modules` (including native
  `bcrypt`) from the host's platform-specific modules.
- The existing root `.env` is read at runtime through the bind mount — no
  `.env` content is baked into an image layer. `MONGODB_URI` (Atlas) is
  unchanged.
- The frontend overrides `VITE_PROXY_API_TARGET` to the backend service by its
  compose network name, so browser `/api` requests reach the backend the same
  way they do locally.
- Ports match the local defaults: backend `4000`, frontend `5173`.
- Node 26 is recorded in `.nvmrc` and `engines.node`, and is the image base.

The existing two-terminal local workflow keeps working unchanged. Atlas remains
the **single source of truth**; no database container and no data volume are
introduced (the only volumes are anonymous ones that protect `node_modules`);
Docker is an **addition, not a replacement**.

## Consequences

**Positive**

- One command brings up the full stack on any machine with Docker installed.
- New contributors get a reproducible environment instead of undocumented setup.
- The containerized stack and the local stack see the same Atlas data.
- Host edits hot-reload in the containers, keeping the fast feedback loop.
- Secrets stay in the root `.env` at runtime and never enter an image layer.
- The Node version cannot silently drift between host and container.

**Negative / costs**

- Two ways to run the stack must both be kept working.
- Docker adds tooling overhead (image build, bind-mount permissions) that the
  local workflow does not have.
- Because the database is Atlas, the stack depends on network access; it cannot
  run fully offline.

## Alternatives considered

- **Run MongoDB in Docker with a data volume.** Rejected: a volume lives on one
  host and cannot carry data between machines, so it would create a second,
  divergent database instead of the shared source of truth.
- **Replace the local workflow with Docker only.** Rejected: it would force a
  migration on developers who are productive with two terminals; Docker is
  meant to be an option.
- **Bake `.env` into the image.** Rejected: it would write Atlas/JWT/SMTP
  credentials into an image layer.
- **Produce a production image now.** Rejected as out of scope: this environment
  installs dev dependencies and runs watch-mode commands.
