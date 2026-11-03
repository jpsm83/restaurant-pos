/**
 * Field-level authorization for the venue profile update.
 *
 * The product's business-document matrix splits the editable profile fields
 * into two layers: identity/contact/currency/address are admin (owner) acts,
 * while operational configuration is a manager act. Delivery-partner and
 * provider-credential fields are Owner/Admin only; no such field exists on the
 * current contract, and the deny-by-default fallback below keeps a future one
 * at admin.
 */

import {
  compareAccessLayers,
  type AccessLayer,
  type BusinessAccessLayer,
} from "restaurant-pos-packages/access";

/** The minimum effective layer that may submit each profile field. */
export const BUSINESS_PROFILE_FIELD_MINIMUM_LAYER = {
  tradeName: "admin",
  imageUrl: "admin",
  email: "admin",
  phoneNumber: "admin",
  currencyTrade: "admin",
  address: "admin",
  contactPerson: "admin",
  cuisineType: "manager",
  categories: "manager",
  acceptsDelivery: "manager",
  deliveryRadius: "manager",
  minOrder: "manager",
  businessOpeningHours: "manager",
  deliveryOpeningWindows: "manager",
  metrics: "manager",
  reportingConfig: "manager",
} as const satisfies Record<string, BusinessAccessLayer>;

type BusinessProfileField =
  keyof typeof BUSINESS_PROFILE_FIELD_MINIMUM_LAYER;

/** Unknown fields fall back to admin so a new field is never manager-open. */
function businessProfileFieldMinimumLayer(
  field: string,
): BusinessAccessLayer {
  return Object.hasOwn(BUSINESS_PROFILE_FIELD_MINIMUM_LAYER, field)
    ? BUSINESS_PROFILE_FIELD_MINIMUM_LAYER[field as BusinessProfileField]
    : "admin";
}

/**
 * The submitted fields the actor's effective layer may not write, in request
 * order. An empty array means the whole submission is allowed.
 */
export function findProfileFieldsAboveLayer(params: {
  fields: Iterable<string>;
  actorLayer: AccessLayer;
}): string[] {
  const seen = new Set<string>();
  const refused: string[] = [];

  for (const field of params.fields) {
    if (seen.has(field)) continue;
    seen.add(field);
    if (
      compareAccessLayers(
        businessProfileFieldMinimumLayer(field),
        params.actorLayer,
      ) > 0
    ) {
      refused.push(field);
    }
  }

  return refused;
}
