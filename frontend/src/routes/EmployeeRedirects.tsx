/**
 * Compatibility redirects for the retired employee shell.
 *
 * `/employee/dashboard` (and its legacy id-based form) now lands in Business at
 * the linked venue when that venue is usable, otherwise in the Customer
 * dashboard. `/employee/profile` redirects to the shared account Profile from
 * the route tree.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/store/AuthContext";
import { useAccessibleVenuesQuery } from "@/services/authVenues";
import { SessionLoading } from "@/routes/AuthRouteGuards";
import {
  canonicalBusinessDashboardRoutePath,
  canonicalCustomerDashboardPath,
} from "@/routes/canonicalPaths";

export function EmployeeDashboardRedirect() {
  const { state } = useAuth();
  const venuesQuery = useAccessibleVenuesQuery();

  if (venuesQuery.isLoading) {
    return <SessionLoading />;
  }

  const venues = venuesQuery.data ?? [];
  const linkedBusinessId =
    state.user?.type === "user" ? state.user.businessId : undefined;
  const linkedVenue = linkedBusinessId
    ? venues.find(
        (venue) =>
          venue.businessId === linkedBusinessId && venue.canEnterBusiness,
      )
    : undefined;

  return (
    <Navigate
      to={
        linkedVenue
          ? canonicalBusinessDashboardRoutePath(linkedVenue.businessId)
          : canonicalCustomerDashboardPath()
      }
      replace
    />
  );
}
