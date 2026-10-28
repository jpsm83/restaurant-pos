/**
 * Post-login **routing helper** (`src/auth`) — pure function for guards and pages.
 *
 * **`getPostLoginDestination`** — first URL after login/signup or when bouncing an authenticated user
 * off a public-only route. The person stays on the Customer surface; entering Business is a later
 * mode-switch action. Built from **`routes/canonicalPaths.ts`**.
 */
import { canonicalDefaultDashboardPath } from "@/routes/canonicalPaths";
import type { AuthSession } from "./types";

export function getPostLoginDestination(user: AuthSession): string {
  return canonicalDefaultDashboardPath(user);
}
