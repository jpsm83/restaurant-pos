# ui — shared design system

The single source of truth for Project Imperium's design system: the
shadcn/radix **primitives**, the Tailwind **design tokens**, and the `cn` class
helper. It ships **raw TypeScript** (no build step) and is consumed by package
name.

## What's here

| Import specifier | Resolves to | Purpose |
|------------------|-------------|---------|
| `ui/<primitive>` | `src/components/<primitive>.tsx` | shadcn/radix primitives (`ui/button`, `ui/card`, `ui/sidebar`, …) |
| `ui/utils` | `src/lib/utils.ts` | `cn` — clsx + tailwind-merge class helper |
| `ui/hooks/<hook>` | `src/hooks/<hook>.ts` | Design-system hooks (`ui/hooks/use-mobile`) |
| `ui/tailwind.css` | `tailwind.css` | Design-token values (`:root` / `.dark`) |

## Package format

- **Name:** `ui`, `"type": "module"`, private, versioned in the workspace.
- **No build / no `dist`.** Files are plain `.ts`/`.tsx` shipped as-is and
  resolved through the workspace symlink via the `exports` map.
- **Import by package name, never by relative path** (no `../packages`, no
  `@/*` alias). Vite transpiles the primitives for the browser.

## Tailwind wiring

`ui` owns the **token values**; `config` owns the **Tailwind preset** (the
`@theme` mapping and the `dark` variant). A workspace entry stylesheet imports
both after Tailwind:

```css
@import "tailwindcss";
@import "ui/tailwind.css";
@import "config/tailwind.css";
```

## Dependencies

- Radix, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
  and `react-day-picker` are **runtime** dependencies.
- `react`, `react-dom`, and `react-i18next` are **peer** dependencies — the
  consuming app provides a single copy so context and the i18n instance are
  shared.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm test --workspace ui` | `vitest run` (primitive + hook tests) |
| `npm run typecheck --workspace ui` | `tsc` |
| `npm run lint --workspace ui` | `eslint .` |
