/**
 * Classify the Business profile-update event actor by effective access.
 *
 * Ownership always wins. A member at manager or admin layer is a manager;
 * every lower layer, and a missing access read, is system.
 */
import { compareAccessLayers } from "restaurant-pos-packages/access";
import type { EffectiveAccess } from "../access/resolveEffectiveAccess.ts";
import type { BusinessProfileUpdatedEventPayload } from "./types.ts";

type BusinessProfileUpdateActorSource =
  BusinessProfileUpdatedEventPayload["actor"]["source"];

export function profileUpdateActorSource(
  access: EffectiveAccess | null,
): BusinessProfileUpdateActorSource {
  if (access?.source === "ownership") return "businessOwner";
  if (
    access?.source === "membership" &&
    compareAccessLayers(access.effectiveLayer, "manager") >= 0
  ) {
    return "manager";
  }
  return "system";
}
