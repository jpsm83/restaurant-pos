# Styling and theming

Rules for Tailwind v4, shadcn/ui, design tokens, and themes.

Load this when writing or changing styles, Tailwind classes, shadcn components, or a theme. The architecture decision is recorded in [ADR-0010](../adr/0010-tailwind-theme-architecture.md).

## Non-negotiables

1. **`src/styles/` is the only place raw colour values live.** Application and component code use semantic utilities only (`bg-background`, `text-muted-foreground`, `border-border`).
2. **Themes are runtime CSS variables.** No build-time theme generation, no theme objects in TypeScript, no per-theme component code.
3. **Every registered theme provides a complete light and dark token set.** Partial themes are not supported.
4. **Customise shadcn in this order:** tokens → built-in variants → `className` → `cva` variant → wrapper → structural edit. Stop at the first rung that solves the problem.
5. **Use `cva` + `cn`.** Never build class strings dynamically and never store Tailwind classes in TypeScript constants.
6. **Accessibility is a gate.** Every theme meets WCAG AA, has a visible focus ring, and respects reduced motion.
7. **CI enforces the rules.** Code review is not the enforcement mechanism.

## Stack baseline

- **Tailwind v4, CSS-first.** There is no `tailwind.config.js`. Tokens live in CSS via `@theme` and `@theme inline`; `frontend/src/index.css` is the single entry imported by `main.tsx`.
- **shadcn/ui is project source, not a dependency.** `frontend/components.json` points at `src/index.css`, uses CSS variables, and the `radix-nova` style. Components are copied into `src/components/ui/` and customised by the ladder in this document.
- **React 19 + Vite SPA.** There is no server render, so a tiny inline boot script applies the saved theme before first paint.

## File layout

```text
frontend/src/index.css          entry: Tailwind, tokens, themes, base, marketing, third-party
frontend/src/styles/
  tokens.css                    @theme / @theme inline mappings; no raw theme values
  base.css                      @layer base resets, app shell, focus, reduced motion
  marketing.css                 scoped marketing typography and layout
  third-party.css               vendor overrides driven by theme variables
  theme-contract.ts             required token names; consumed by tests and docs
  themes/
    index.ts                    registry: id, label, default id
    default.css                 default light + dark token sets (:root / .dark)
    <id>.css                    additional complete theme (light + dark)
```

`index.css` imports, in this order:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "./styles/tokens.css";
@import "./styles/themes/default.css";
@import "./styles/themes/<id>.css";
@import "./styles/base.css";
@import "./styles/marketing.css";
@import "./styles/third-party.css";
```

CSS `@import` statements must come before any other rule. Keep one file per concern and one file per theme; do not grow `index.css` back into a monolith.

## Token contract

Raw CSS variables are the contract. `tokens.css` maps them into Tailwind's theme so utilities exist; it does not define theme values.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... every semantic colour ... */
  --font-sans: var(--sans);
  --font-heading: var(--heading);
  --font-mono: var(--mono);
  --shadow-panel: var(--elevation-panel);
  --shadow-overlay: var(--elevation-overlay);
  --container-page: var(--page-width);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}

@custom-variant dark (&:where(.dark, .dark *));
```

Use `@theme inline` whenever the value references a raw variable; plain `@theme` is only for values that never change per theme. Motion and z-index tokens are exposed with small `@utility` definitions in `tokens.css` (`duration-fast`, `z-modal`, ...) rather than guessed at the call site.

### Required tokens

`src/styles/theme-contract.ts` exports this list. Every theme defines every token it contains, for both modes. The contract stores token names, not Tailwind classes, so it is not a style-constant file. Adding or removing a token is a spec change: update the contract, every theme, the tests, and this document.

| Group | Tokens |
|-------|--------|
| Surfaces | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `surface`, `surface-foreground`, `elevated`, `elevated-foreground`, `overlay` |
| Brand | `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `accent`, `accent-foreground` |
| Muted | `muted`, `muted-foreground` |
| States | `destructive`, `destructive-foreground`, `success`, `success-foreground`, `warning`, `warning-foreground`, `info`, `info-foreground` |
| Borders and focus | `border`, `input`, `ring` |
| Charts | `chart-1`, `chart-2`, `chart-3`, `chart-4`, `chart-5` |
| Sidebar | `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring` |
| Shape and type | `radius`, `sans`, `heading`, `mono` |
| Elevation and layout | `elevation-panel`, `elevation-overlay`, `page-width` |
| Motion | `motion-fast`, `motion-base`, `motion-slow`, `motion-ease-standard`, `motion-ease-emphasized` |
| Z-index | `z-dropdown`, `z-sticky`, `z-overlay`, `z-modal`, `z-toast`, `z-tooltip` |

`--destructive-foreground` currently has a Tailwind mapping in `index.css` but no value. It is required by the contract and must be defined by every theme.

### Contrast pairs

Every theme, in both modes, must pass:

- **4.5:1 (normal text):** each `*-foreground` against its paired surface, including `muted-foreground` on `muted`, `sidebar-foreground` on `sidebar`, `sidebar-primary-foreground` on `sidebar-primary`, and `sidebar-accent-foreground` on `sidebar-accent`.
- **3:1 (large text and UI):** `border` and `input` against the surface behind them; `ring` against the surface it outlines; `chart-1..5` against `background`; `foreground` against `background` for large text.
- **Focus:** `ring` remains distinguishable from `background` in every theme; `focus-visible` is never removed without a replacement of equal contrast.

`--overlay` is a scrim and is exempt from contrast checks.

## Themes

### Two axes

- `data-theme` selects the brand palette: `default`, later `high-contrast`, `ocean`, and so on.
- `.dark` selects the mode. It is independent of the brand palette.

Every theme therefore has a light and a dark token set, and a brand theme works with both modes without a second attribute.

### Default theme is the base

`default` is the only theme without its own `[data-theme]` block. Its light set is `:root` and its dark set is `.dark`, with `.dark` declared after `:root` so it wins at equal specificity. Both blocks set `color-scheme` (`light` / `dark`). The boot script still sets `data-theme="default"` so the attribute is always present and the registry is honest. An unknown `data-theme` falls back to the `:root` defaults.

### Complete sets, explicit selectors

Every additional theme defines the full contract twice:

```css
/* src/styles/themes/ocean.css */
[data-theme="ocean"]:not(.dark) {
  color-scheme: light;
  --background: oklch(0.99 0.01 220);
  /* ... every contract token ... */
}

[data-theme="ocean"].dark {
  color-scheme: dark;
  --background: oklch(0.17 0.02 220);
  /* ... every contract token ... */
}
```

Rules:

- The `:not(.dark)` guard stops a light block from overriding the default dark tokens through cascade order.
- `[data-theme="<id>"].dark` has higher specificity than `.dark`, so the complete dark set wins.
- No partial inheritance. Duplication across themes is accepted; it removes cascade ambiguity and makes the completeness test meaningful.
- `color-scheme` is set in the same block so native controls, scrollbars, and form widgets follow the mode.

### Registry

```ts
// src/styles/themes/index.ts
export const THEMES = [{ id: "default", label: "Default" }] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME_ID: ThemeId = "default";
```

Registry IDs are stable, kebab-case, and carry no mode suffix. CSS filenames match the ID. Labels are separate, human-readable strings. Adding a theme requires both a registry entry and an import in `index.css`; a test asserts they agree.

### Runtime

`useTheme` is the only code that touches theme attributes. It exposes:

```ts
{
  theme: ThemeId;              // brand palette
  mode: "light" | "dark" | "system";
  resolvedMode: "light" | "dark";
  setTheme(id: ThemeId): void;
  setMode(mode: "light" | "dark" | "system"): void;
}
```

It applies `data-theme` and `.dark` to `document.documentElement`, persists `pos.theme` and `pos.mode` in `localStorage`, and listens to `matchMedia("(prefers-color-scheme: dark)")` while `mode === "system"`. It does not add `next-themes`; the hook is smaller than adapting a one-axis library to two axes.

`frontend/index.html` runs a boot script before the app bundle so the first paint already has the right tokens:

```html
<script>
  (() => {
    const theme = localStorage.getItem("pos.theme") || "default";
    const mode = localStorage.getItem("pos.mode") || "system";
    const dark =
      mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", dark);
  })();
</script>
```

The account menu exposes **Light / Dark / System**. The brand-theme selector stays hidden until more than one user-facing theme exists.

### Per-Business theming (future, not now)

Because tokens are runtime CSS variables, a future Business theme can be applied with `data-theme` on a subtree instead of `<html>`. Do not build that now. Do not scope tokens to a component today; keep the selector at the root so the same tokens can be moved later without changing components.

### Test-only themes

Tests may define an inline theme (for example in a Vitest fixture) to prove two-axis resolution with more than one theme. It must not be added to the registry, `index.css`, `/dev/themes`, or any bundle. No fixture theme ships.

## Customization ladder

Use the first rung that solves the problem.

1. **Tokens.** Global appearance — colours, radius, fonts, shadows, motion — is a theme change. If a component looks wrong across the app, fix the token, not the component.
2. **Built-in variants.** Prefer `variant` and `size` over local classes.
3. **`className` at the call site.** One-off layout or spacing belongs where it is used; `cn()` resolves conflicts.
4. **`cva` variant in `components/ui/`.** When a style must apply to every use of a component (for example, all inputs share a control height), add or adjust a variant. Keep the edit minimal, token-based, and free of business logic.
5. **Wrapper in `components/ui-kit/`.** When the component carries app semantics (`PageHeader`, `StatusBadge`, `FormField`, `Panel`, `AppCard`) or composes several primitives, wrap it.
6. **Structural edit in `components/ui/`.** Rare. Allowed only when the component's shape or behaviour genuinely must change. Review it as a diff against upstream and note it in the pull request.

### shadcn update path

Before updating a primitive:

```bash
npx shadcn@latest add <component> --diff       # inspect local changes vs upstream
npx shadcn@latest add <component> --overwrite  # restore plain upstream if desired
```

Keep edits small and purposeful so the diff stays readable. Git history is the second safety net. Editing a primitive for a colour that a token can express is not allowed.

### Current drift to remove

- Reset `frontend/src/components/ui/card.tsx` to upstream: it hardcodes `bg-white`, `border-neutral-200`, and `text-neutral-900` instead of the semantic tokens upstream uses.
- Delete `frontend/src/components/ui/button-variants.ts` and its test. `button.tsx` and `calendar.tsx` must import one set of variants, not two divergent ones.
- Move the global `h1`/`h2` sizing out of base styles and into `styles/marketing.css`.

## Directory boundary

| Path | Owns |
|------|------|
| `src/components/ui/` | shadcn primitives. Minimal token/`cva` edits only; no business logic, no domain copy. |
| `src/components/ui-kit/` | Cross-cutting app compositions built on `ui/`: `PageHeader`, `Section`, `FormField`, `StatusBadge`, `Panel`, `AppCard`. |
| `src/components/business/`, `src/features/**` | Domain components. Domain behaviour and copy live here. |
| `src/pages/**`, `src/layouts/**` | Composition and layout. No design-system definitions. |
| `src/lib/utils.ts` | `cn()` and non-React helpers. No style definitions. |
| `src/styles/**` | Tokens, themes, base, marketing, third-party overrides. |

Pages may import from `components/ui` and `components/ui-kit`. `ui-kit` may import from `ui`. The reverse dependencies are forbidden.

## Authoring components

- Use semantic utilities only. `bg-card`, `text-card-foreground`, `border-border` — never `bg-white`, `text-neutral-900`, or a hex/oklch value in JSX.
- Use `cva` for variants and `cn` for composition. Variant names describe intent (`tone`, `size`), not colour (`green`, `big`).
- Prefer tokens that flip automatically. Use `dark:` only when the token model cannot express the difference — images, chart series, third-party widgets. If a colour needs a `dark:` variant, add a semantic token instead.
- Limit `@apply` to `@layer base` in `styles/base.css`. Feature and page code uses utilities.
- No dynamic class construction (`bg-${color}-500`), no class strings in constants, no `style={{ color: ... }}` for theme colours.
- Do not add per-component tokens beyond shadcn's existing ones (`card`, `sidebar`, `popover`). Presentational tokens recreate hardcoding under new names.
- Every interactive primitive keeps a visible `focus-visible` ring. Motion respects reduced motion.
- Use `Skeleton` for loading placeholders; do not invent a second loading surface.

## Third-party UI

Third-party surfaces are themed through the same variables, in one place:

- **Sonner:** `<Toaster theme={resolvedMode} />` in `main.tsx`; toast colours come from the theme tokens.
- **Leaflet:** map, controls, and popups consume variables in `styles/third-party.css`; no raw colours in the map wrapper.
- **react-day-picker:** styled through the shadcn `Calendar` wrapper and its tokens; do not give it a separate palette.
- **Google sign-in:** keeps its mandated brand colours. This is the documented exception; do not use it as precedent for other widgets.

If a vendor widget cannot be themed with variables, use a wrapper in `ui-kit/`; do not fork the vendor CSS into feature code. A `vendor-overrides.css` layer keyed by `data-slot` is allowed only for a concrete, reviewed case that a wrapper cannot solve.

## Marketing

Marketing and the app share one token system. Marketing typography lives in `styles/marketing.css` under a `.marketing` scope applied by the marketing layout or page. Global `h1`/`h2` rules do not set fixed sizes; the app uses its component typography (`PageHeader`, `CardTitle`, etc.).

Marketing code follows the same colour, token, and accessibility rules as the app. It does not get a separate palette or a `.dark`-only exception.

## Enforcement

A single script, `frontend/scripts/check-styles.mjs`, runs from `frontend` lint/CI and fails on:

1. **Raw colour:** palette utilities (`bg-neutral-*`, `text-gray-*`, `border-red-*`, ...) and arbitrary colour values (`bg-[#...]`, `text-[oklch(...)]`) anywhere outside `src/styles/**`.
2. **Arbitrary sizes/values:** `w-[...]`, `h-[...]`, `p-[...]`, `text-[...]`, `gap-[...]`, and similar outside `src/styles/**` and `src/components/ui/**`.

`frontend/style-allowlist.json` is the only escape hatch:

```json
{
  "colors": [
    "src/pages/**",
    "src/layouts/**",
    "src/features/**",
    "src/components/ui-kit/**",
    "src/components/business/**",
    "src/components/*.tsx"
  ],
  "arbitraryValues": [
    "src/pages/**",
    "src/layouts/**",
    "src/features/**",
    "src/components/ui-kit/**",
    "src/components/business/**",
    "src/components/*.tsx"
  ]
}
```

- The allowlist shrinks as migration slices land. It must end empty.
- Inline disable comments are forbidden. The allowlist is central, auditable, and removable.
- `src/components/ui/**` is a permanent exception for arbitrary sizes because upstream shadcn uses them. It is never an exception for raw colours; the allowlist must not include that path.
- A new exception requires a spec amendment and review; it is not a drive-by change.

## Testing

1. **Token completeness:** for every registered theme × mode, all tokens in `THEME_TOKEN_CONTRACT` resolve to a non-empty value. The default theme is checked through `:root` / `.dark`.
2. **Contrast:** the required pairs meet AA in every theme × mode. Resolve `oklch()`/`var()` values with a small colour-math dev dependency; do not eyeball it.
3. **Registry consistency:** every `THEMES` entry has a CSS definition (or is `default`), and every imported theme CSS has a registry entry.
4. **Two-axis resolution:** a test-only inline theme proves `data-theme` + `.dark` resolve independently. It is never registered or shipped.
5. **CI guard:** the style script passes with the current allowlist; the allowlist is empty before the migration is declared complete.

`/dev/themes` is a dev-only route that renders token swatches and a fixed gallery for every registered theme × mode: typography, button variants and sizes, inputs/select/checkbox, card, alert, table, sidebar sample, dialog/overlay, toasts, focus states, and charts. It previews real registered themes only; with one theme it doubles as the dark-mode review.

There is no Playwright visual regression suite. Add one only when theme count or observed drift justifies it.

## Authoring a theme

A theme is complete only when all of these are true:

- [ ] CSS file in `src/styles/themes/` named after the ID.
- [ ] Registry entry with a stable kebab-case ID and a human-readable label.
- [ ] Import in `src/index.css`.
- [ ] Complete light set in `[data-theme="<id>"]:not(.dark)`.
- [ ] Complete dark set in `[data-theme="<id>"].dark`.
- [ ] `color-scheme` set in both blocks.
- [ ] Every contract token defined; no partial inheritance.
- [ ] Contrast test passes for every required pair in both modes.
- [ ] Focus ring visible and 3:1 against the surfaces it outlines.
- [ ] Motion respects `prefers-reduced-motion`.
- [ ] Any font override has a preloaded file, a fallback stack, and `font-display: swap`.
- [ ] `/dev/themes` preview reviewed.
- [ ] No theme-specific component code, copy, or business logic.
- [ ] This document or the contract updated if the theme adds a token.

Any contributor may author a theme; the frontend owner reviews it. A new token is a contract change, not a theme detail.

## Migration plan

1. **Foundation.**
   - Reset drifted primitives (`card.tsx`, `button-variants.ts` removal).
   - Split `src/index.css` into `src/styles/`.
   - Add the token contract, status/surface tokens, and the complete default light/dark sets.
   - Wire `useTheme`, the boot script, and the account-menu toggle.
   - Add the theme registry (default only), `/dev/themes`, third-party adapters, and the tests.
   - Move marketing typography out of base.
   - Add the CI script and allowlist with current violations.
   - New code is clean from this point on.
2. **Auth and public surfaces.** Login, sign-up, recovery, confirmation, access-denied, not-found, mode selection, public/recovery layouts, navbar, footer, account menu.
3. **Marketing.** Customer and business marketing pages.
4. **Customer and employee.** Layouts and pages.
5. **Business settings.** Business pages, business components, profile/settings shells.
6. **Advanced table.** Feature components and table primitives.
7. **Exit.** Allowlist `colors` and `arbitraryValues` are empty; strict rules apply everywhere except the built-in `components/ui` arbitrary-size exception. Remove the allowlist file or leave it empty with a comment that entries require a spec amendment.

Each slice removes its own allowlist globs and runs the contrast, completeness, and style checks before merging.

## Out of scope

- Server-side theme preference sync.
- Per-Business or per-Owner theming.
- Storybook.
- Playwright visual regression.
- A theme editor.
- Shipped fixture/demo themes.
- User-selectable brand themes before a second real theme exists.

## References

- [ADR-0010](../adr/0010-tailwind-theme-architecture.md)
- [Tailwind CSS v4 theme variables](https://tailwindcss.com/docs/theme)
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui customization](https://ui.shadcn.com/docs/customization)
