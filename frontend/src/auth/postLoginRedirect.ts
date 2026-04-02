/**
 * Post-login **routing helper** (`src/auth`) — pure function for guards and pages.
 *
 * **`getPostLoginDestination`** — first URL after login/signup or when bouncing an authenticated user
 * off a public-only route: business → `/business/:id/dashboard`; staff-linked user → `/:id/mode`; else
 * `/:id/customer/dashboard`. Built from **`routes/canonicalPaths.ts`**.
 */
import {
  canonicalBusinessDashboardRoutePath,
  canonicalUserCustomerDashboardPath,
  canonicalUserModePath,
} from "@/routes/canonicalPaths";
import type { AuthSession } from "./types";

export function getPostLoginDestination(user: AuthSession): string {
  if (user.type === "business") {
    return canonicalBusinessDashboardRoutePath(user);
  }

  if (user.type === "user" && user.employeeId) {
    return canonicalUserModePath(user);
  }

  return canonicalUserCustomerDashboardPath(user);
}
