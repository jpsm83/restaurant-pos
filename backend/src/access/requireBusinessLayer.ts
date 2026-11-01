/**
 * Require one signed-in User to hold at least a given access layer at a
 * Business.
 *
 * Every membership route resolves its caller through this guard so list, read,
 * contacts, create, edit, delete, and self-view cannot drift in their access
 * checks. A valid Business with no ownership and no active membership, a
 * business that does not exist, or a caller below the required layer is
 * refused with a `403` Problem Details response.
 */

import type { ClientSession } from "mongoose";

import {
  compareAccessLayers,
  type BusinessAccessLayer,
} from "restaurant-pos-packages/access";
import { forbidden } from "../errors/appError.ts";
import {
  resolveEffectiveAccess,
  type EffectiveAccess,
} from "./resolveEffectiveAccess.ts";

export interface RequireBusinessLayerParams {
  userId: string;
  businessId: string;
  minimumLayer: BusinessAccessLayer;
  /** When set, all reads participate in this MongoDB transaction session. */
  session?: ClientSession;
}

/** True when the resolved access meets the required business layer. */
export function meetsBusinessLayer(
  access: EffectiveAccess | null,
  minimumLayer: BusinessAccessLayer,
): access is EffectiveAccess {
  return (
    access !== null &&
    compareAccessLayers(access.effectiveLayer, minimumLayer) >= 0
  );
}

/**
 * Resolve the caller's effective access at the Business and refuse a caller
 * below the required layer. Returns the resolved access for callers that need
 * the layer, source, or job roles after the check.
 */
export async function requireBusinessLayer(
  params: RequireBusinessLayerParams,
): Promise<EffectiveAccess> {
  const access = await resolveEffectiveAccess({
    userId: params.userId,
    businessId: params.businessId,
    session: params.session,
  });

  if (!meetsBusinessLayer(access, params.minimumLayer)) {
    throw forbidden("Forbidden");
  }

  return access;
}
