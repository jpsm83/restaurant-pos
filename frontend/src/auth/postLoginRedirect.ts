/**
 * Post-login **routing helper** (`src/auth`) — pure function for guards and pages. See `auth/index.ts`
 * for the full auth folder map.
 *
 * **`getPostLoginDestination`** — first URL after login/signup or when bouncing an authenticated user
 * off a public-only route: business → `/business/:id/home`; staff-linked user → `/:id/mode`; else
 * `/:id/customer/home`. Built from **`routes/canonicalPaths.ts`**.
 */
import { canonicalBusinessHomePath, canonicalUserCustomerHomePath, canonicalUserModePath } from "@/routes/canonicalPaths";
import type { AuthSession } from "./types";

export function getPostLoginDestination(user: AuthSession): string {
  if (user.type === "business") {
    return canonicalBusinessHomePath(user);
  }

  if (user.type === "user" && user.employeeId) {
    return canonicalUserModePath(user);
  }

  return canonicalUserCustomerHomePath(user);
}
