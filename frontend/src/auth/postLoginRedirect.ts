import type { AuthSession } from "./types";
import {
  canonicalBusinessDashboardPath,
  canonicalUserCustomerPath,
  canonicalUserModePath,
} from "@/routes/sessionPathGuards";

/**
 * First URL after login/signup or when bouncing an authenticated user off a public-only route.
 * Mirrors `App.tsx` team decisions: business → `/business/:id`; user with staff link → `/:id/mode`;
 * otherwise user → `/:id/customer`.
 */
export function getPostLoginDestination(user: AuthSession): string {
  if (user.type === "business") {
    return canonicalBusinessDashboardPath(user);
  }

  if (user.type === "user" && user.employeeId) {
    return canonicalUserModePath(user);
  }

  return canonicalUserCustomerPath(user);
}
