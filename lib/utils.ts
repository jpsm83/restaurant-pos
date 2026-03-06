/**
 * cn — Tailwind class name utility
 *
 * Composes conditional and conflicting Tailwind CSS class names safely.
 * Uses clsx for conditional classes and tailwind-merge to resolve conflicts
 * (e.g. "p-4" + "p-2" → "p-2"). Necessary to keep component class logic
 * readable and avoid unintended style overrides in the app.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges class names and resolves Tailwind conflicts. Accepts any ClassValue
 * (string, array, object, undefined). Later conflicting classes win.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
