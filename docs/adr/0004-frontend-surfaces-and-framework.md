# ADR-0004: Frontend surfaces — two apps, a trust-realm split, and React Router v7 framework mode

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Project Imperium is **three product surfaces over one platform**: the **Business** app, the **Customer** app, and the **Superadmin** console (`overview.md` §5, §7–§9). Today the web client is a **single React 19 + Vite SPA** (`frontend/`) that serves every audience through route shells and guards — `BusinessLayout`, `CustomerLayout`, `EmployeeLayout`, `PublicLayout` — plus a mode chooser and schedule gating. It is **client-side rendered only**.

Three forces now press on that shape.

1. **Trust realms are not equal.** There are three realms but only two session realities. The **Superadmin** console has its own authentication realm — separate credentials, MFA, and access restrictions (`overview.md` §9) — while the **Business** and **Customer** surfaces share one identity and one session, because *every user is a customer* and the **mode chooser** lets a business user switch between the two (`overview.md` §3, §5). Splitting Business and Customer cleanly is therefore about **sessions, not audiences**: they belong behind one origin.
2. **The Customer surface needs SEO and shareable links.** Venue discovery, public menus, and shared links (self-ordering QRs, reservations) live and die on crawlable HTML and **Open Graph metadata**. React 19 hoists `<title>`/`<meta>`, but on a Vite CSR SPA those tags are injected **after JS runs**: link-preview crawlers (WhatsApp, Slack, iMessage, Facebook, X, LinkedIn, Discord) do not execute JavaScript, so a CSR app yields no previews, and Googlebot renders JS only on a delayed second wave.
3. **A native POS client is coming.** A first-party **native POS** will consume the same backend. The API must remain the single source of truth, and the frontend framework must never become a second backend (see ADR-0005).

The current `frontend/` also carries marketing pages and three audience shells in one undifferentiated tree, so surfaces can import each other's internals freely, and there is no package boundary that would make a future split cheap.

## Decision

Adopt a **trust-realm split** of the frontend and build the product app on **React Router v7 framework mode**.

Concretely:

- **Two frontend deployables plus a static marketing site.**
  - `apps/web` — the **product app**: one codebase exposing **two surfaces** through route groups, `/business` (owner shell, back-office, POS, employee self-service) and `/client` (customer).
  - `apps/admin` — the **Superadmin console**: its own subdomain, its own auth realm, its own build and deploy.
  - `imperium.com` — the public **marketing site**, static/prerendered and separate from both apps.
- **Device is a layout concern, never an app boundary.** Business admin vs POS, desktop vs mobile, are layouts and responsive behaviour **inside** `apps/web`. The POS is **tablet-first, responsive down to phone**. There is no `pos-mobile` app, no `business-desktop` app.
- **`apps/web` uses React Router v7 framework mode** (Vite-based, SSR). `/client` and the marketing routes are **server-rendered or prerendered** with per-route `meta()`/`links()`; `/business` and POS routes stay **client-rendered**, because they are WebSocket-driven and highly interactive.
- **Surfaces are internally modular.** `surfaces/business/**` and `surfaces/client/**` never import each other; shared code lives in `shared/**` and `packages/*`. The boundary is enforced by lint import rules so the two surfaces cannot rot into one pile.
- **One session, same origin.** Business and Customer are served from one origin, so the mode chooser and default-surface redirect are **route changes**, not cross-domain SSO. `/` and `/mode` redirect to the user's default surface; there is no shared-cookie-across-subdomains machinery.
- **Shared workspace packages**, extracted so any future split is a lift-and-shift:
  - `packages/domain` — enums, interfaces, zod schemas (today's `packages/`).
  - `packages/ui` — the shadcn/radix design system and tokens.
  - `packages/api-client` — the typed client derived from the backend contract (ADR-0005).
  - `packages/auth` — session store, route guards, mode-chooser helper.
  - `packages/config` — shared tsconfig, eslint, and tailwind preset.
- **Repository layout** moves to `apps/` + `packages/` (with `backend/` unchanged), the conventional two-axis layout for a multi-deployable workspace.

## Consequences

**Positive**

- The Superadmin console is isolated by origin and realm, matching its security model.
- Business and Customer keep a trivial mode chooser because they share one origin and session.
- The Customer and marketing surfaces become crawlable and shareable via SSR/prerender and per-route metadata; React 19 metadata hoisting covers the in-app tags without a helmet library.
- Operational surfaces keep a fast client-rendered experience where rendering on the server would add nothing.
- The package boundaries make a later extraction of the Customer surface a move, not a rewrite.
- Adding more clients (native POS, kiosk) is unaffected by the web app's framework.

**Negative / costs**

- A framework-mode migration changes how routing and data loading work: `loader`s replace some `useEffect`/query patterns on server-rendered routes, and the app gains a Node render server to run and host.
- SSR means two rendering paths to reason about; a route must declare which one it uses.
- The layout move (`frontend/` → `apps/web`, `packages/` → `packages/domain`) touches every path and must be sequenced so the app never breaks.
- Two deployables plus a marketing site is more CI surface than one SPA.
- Import-boundary enforcement is only as good as the lint rule that upholds it; a missing rule lets the boundary erode.

## Alternatives considered

- **Keep one Vite CSR SPA with path-only surfaces.** Rejected: no server-rendered HTML means no link previews and weak discovery SEO, and the Superadmin console would share an origin and realm it should not.
- **Next.js App Router.** Rejected: its headline value is a server data layer (RSC, Server Actions, ISR) inside the framework, but Project Imperium's data layer is the external, shared `/api/v1` — which a native client must also call. Server Actions are not reachable from native, so they would fragment the contract. React Router v7 keeps the server a thin render layer and reuses the existing React Router + Vite investment.
- **Split Business, Customer, and POS into separate apps by device.** Rejected: device is not a boundary; it multiplies deployables and duplicates auth, routing, and state without reducing coupling.
- **Three apps by audience (Business, Customer, Superadmin).** Rejected: Business and Customer share one session and are coupled by the mode chooser; keeping them behind one origin is cheaper and simpler than cross-subdomain session sharing.
- **Micro-frontends / Module Federation.** Rejected: runtime composition adds complexity with no payoff at this scale.
