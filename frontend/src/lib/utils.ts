/**
 * Shared **UI utilities** for `src/lib` (no React, no API calls).
 *
 * ## `cn`
 * Merges class names with **tailwind-merge** on top of **clsx** so conditional Tailwind classes
 * resolve conflicts predictably (last wins for same utility “slot”).
 *
 * ## Wiring
 * Imported by shadcn-style components under `components/ui/*` (`button`, `card`, `input`, …) and
 * a few pages/components that need the same pattern (`AccountMenuPopover`, `BusinessRegisterPage`).
 * This is the standard helper for `className` composition in the app.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}