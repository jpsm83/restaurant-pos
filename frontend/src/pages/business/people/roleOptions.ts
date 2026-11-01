/**
 * Role choices the caller may assign at this venue.
 *
 * Uses the same shared bound as the server, so the form never offers a role the
 * hire endpoint would refuse.
 */
import {
  canAssignJobRoles,
  JOB_ROLE_DEFAULT_LAYERS,
} from "restaurant-pos-packages/access";
import type { BusinessAccessSnapshot } from "@/services/employees/employeesService";

export function roleOptionsFor(access: BusinessAccessSnapshot): string[] {
  return Object.keys(JOB_ROLE_DEFAULT_LAYERS).filter((role) =>
    canAssignJobRoles({
      actorLayer: access.effectiveLayer,
      isOwner: access.source === "ownership",
      roles: [role],
    }),
  );
}
