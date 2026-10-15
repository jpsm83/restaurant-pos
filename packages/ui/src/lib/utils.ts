/**
 * Shared **UI utilities** for the design system (no React, no API calls).
 *
 * ## `cn`
 * Merges class names with **tailwind-merge** on top of **clsx** so conditional Tailwind classes
 * resolve conflicts predictably (last wins for same utility “slot”).
 *
 * ## Wiring
 * Imported by the shadcn-style primitives under `src/components/*` (`button`, `card`, `input`, …)
 * and re-exported to consumers as `ui/utils`. This is the standard helper for `className`
 * composition across every client that uses the design system.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}