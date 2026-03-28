import type { AuthSession } from "@/auth/types";
import {
  canonicalBusinessDashboardPath,
  canonicalUserCustomerPath,
} from "@/routes/sessionPathGuards";

/** Deep links for account menu (user customer shell vs business tenant). */
export function getAccountMenuPaths(session: AuthSession) {
  if (session.type === "business") {
    const base = canonicalBusinessDashboardPath(session);
    return {
      dashboard: base,
      profile: `${base}/profile`,
      favorites: `${base}/favorites`,
    };
  }
  const home = canonicalUserCustomerPath(session);
  return {
    dashboard: `${home}/dashboard`,
    profile: `${home}/profile`,
    favorites: `${home}/favorites`,
  };
}
