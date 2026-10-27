# ADR-0010: Tailwind v4 token-based theming and shadcn customisation

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The frontend uses Tailwind v4 CSS-first and shadcn/ui, but styling is not centralised in practice:

- Colours are partly tokenised in `src/index.css` (`@theme inline` plus `:root` / `.dark`), yet roughly 180 raw palette utilities (`text-neutral-800`, `bg-gray-100`, `border-red-300`, ...) are spread across pages and components.
- A shadcn primitive has drifted from upstream: `card.tsx` hardcodes `bg-white`, `border-neutral-200`, and `text-neutral-900` instead of semantic tokens.
- There are two conflicting button variant definitions (`button.tsx` and `button-variants.ts`) with different heights and radii; `calendar.tsx` consumes the stale one.
- `--destructive-foreground` is mapped in Tailwind but never defined, so the utility silently resolves to nothing.
- Marketing heading sizes (`h1` 56px, `h2` 24px) are global and leak into app pages.
- Dark tokens exist but there is no theme wiring, no boot script, no persistence, and no contrast test.
- Size and spacing choices are mostly arbitrary (`w-[300px]`, `text-[0.8rem]`), and nothing enforces semantic colour usage.

A grill on 2026-10-27 settled the desired system: centralised tokens, multiple future themes, and shadcn components that stay close to upstream while remaining customisable. This ADR records the architecture; the day-to-day rules live in [`docs/conventions/styling.md`](../conventions/styling.md).

## Decision

### 1. Tailwind v4 CSS-first remains the single styling engine

- No `tailwind.config.js`. Tokens live in CSS and are mapped into Tailwind with `@theme` / `@theme inline`.
- `src/index.css` is the only entry imported by `main.tsx`; it composes `src/styles/{tokens,base,marketing,third-party}.css` and `src/styles/themes/*.css`.
- Raw colour values exist only in `src/styles/**`. App and component code uses semantic utilities (`bg-background`, `text-muted-foreground`, `border-border`).

### 2. Semantic token set extended beyond shadcn defaults

Add `--success`, `--warning`, `--info`, `--surface`, `--elevated`, `--overlay` (with foreground pairs where relevant), and define the missing `--destructive-foreground`. Keep shadcn's existing semantic names and do not introduce per-component tokens beyond `card`, `sidebar`, and `popover`.

The required token list is an explicit contract (`src/styles/theme-contract.ts`) consumed by tests and documentation. Adding or removing a token is a reviewed spec change.

### 3. Themes are two independent axes over runtime CSS variables

- `data-theme` selects a brand palette; `.dark` selects the mode.
- `default` is the base (`:root` for light, `.dark` for dark). Every additional theme defines a **complete** light set in `[data-theme="<id>"]:not(.dark)` and a **complete** dark set in `[data-theme="<id>"].dark`. Partial inheritance is not supported.
- `color-scheme` is set per theme block. A tiny `useTheme` hook applies the attributes, persists `pos.theme` and `pos.mode` in `localStorage`, and follows `prefers-color-scheme` while the mode is `system`. An inline boot script in `index.html` prevents a first-paint flash.
- The account menu exposes Light / Dark / System. A brand-theme selector appears only when more than one real theme exists.
- Because tokens are CSS variables, a future per-Business theme can be applied to a subtree without touching components. That is not built now.

### 4. shadcn components stay close to upstream and are customised through a ladder

shadcn is project source, not a vendor dependency. The customisation order is fixed:

1. tokens,
2. built-in variants,
3. `className` at the call site,
4. minimal `cva` variant edits in `components/ui/`,
5. a wrapper in `components/ui-kit/`,
6. a reviewed structural edit in `components/ui/`.

Colour changes are always token changes, never component edits. Repeated app semantics live in `components/ui-kit/`; domain components stay in their existing folders. Updates use `npx shadcn@latest add <component> --diff` before any overwrite. Keeping local edits small preserves the ability to restore plain upstream with `--overwrite`.

### 5. Enforcement and testing are part of the architecture

- A CI script fails on raw palette/arbitrary colours outside `src/styles/**`, and on arbitrary sizes/values outside `src/styles/**` and `components/ui/**`.
- A central, shrinking allowlist (`frontend/style-allowlist.json`) is the only escape hatch. Inline disables are forbidden, and the allowlist ends empty after migration.
- Vitest verifies token completeness for every registered theme × mode, WCAG AA contrast for the required pairs, and registry/CSS consistency. A test-only inline theme proves two-axis resolution with more than one theme; no fixture theme ships.
- A dev-only `/dev/themes` route previews registered themes across light and dark.
- New code is clean from the foundation change onward; existing pages migrate in vertical slices with their allowlist entries removed as they reach zero.

### 6. Marketing shares the token system

Marketing uses the same tokens, themes, and accessibility rules. Marketing typography moves into `styles/marketing.css` under a `.marketing` scope; global `h1`/`h2` rules no longer set fixed sizes.

### 7. Explicitly deferred

Server-side theme preference sync, per-Business/per-Owner theming, Storybook, Playwright visual regression, a theme editor, shipped fixture themes, and user-selectable brand themes before a second real theme exists.

## Consequences

**Positive**

- One place changes the brand: colours, radius, type, shadows, motion, and overlays.
- Multiple themes can be added as one CSS file plus one registry entry, without touching components.
- Dark mode is a real, tested mode rather than unused tokens.
- shadcn stays upgradeable because edits are small, token-first, and diffable.
- Drift is caught by CI and contrast is a gate, not a review opinion.
- The same token model can later scope a theme to a Business subtree.

**Negative / costs**

- Each theme duplicates the full token set for light and dark. This is intentional; it removes cascade ambiguity and makes completeness testable.
- The migration touches most styled files and must land in reviewable slices.
- A custom `useTheme` hook and boot script must be maintained instead of delegating to `next-themes`; the two-axis model makes the library a poor fit.
- The style CI script and contrast test add tooling and a small dev dependency for colour math.
- Some upstream shadcn internals may still need a wrapper or, rarely, a documented structural edit.

## Alternatives considered

- **`tailwind.config.js` with a JS theme object.** Rejected: Tailwind v4 is CSS-first, and runtime themes need CSS variables, not build-time values.
- **Strict vendor freeze: never edit `components/ui/`, wrappers only.** Rejected: it is not how shadcn is designed to be used, it pushes every override into wrappers, and it does not actually improve resetability compared with small diffs plus `--overwrite`.
- **Free-form edits to shadcn primitives.** Rejected: it destroys the update/diff path and lets palette values back into components.
- **TypeScript theme objects or CSS-in-JS.** Rejected: Tailwind cannot statically scan class strings in constants, and runtime styling already exists through CSS variables.
- **Self-contained theme bundles (`ocean-dark`, `ocean-light`).** Rejected: it multiplies theme names and makes mode logic leak into component rules.
- **Single-axis `data-theme` only (mode baked into a preset).** Rejected: it prevents mixing a brand theme with the user's light/dark preference.
- **Storybook and Playwright from the start.** Rejected: new workflows for a small number of themes; `/dev/themes` and Vitest cover the immediate risk.
- **Partial themes that inherit from `default`.** Rejected: CSS cascade across `data-theme` and `.dark` makes missing tokens easy to miss; complete sets are safer and testable.

## Supersedes

None. This ADR changes frontend styling architecture only; ADR-0001 through ADR-0009 remain in force.
