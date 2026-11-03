/**
 * Field-level authorization for the venue profile update.
 *
 * The field matrix is shared product data, so it lives with the access
 * vocabulary in `restaurant-pos-packages/access`. This module keeps the
 * backend import path stable for the route and its tests.
 */

export {
  BUSINESS_PROFILE_FIELD_MINIMUM_LAYER,
  canEditBusinessProfileField,
  findProfileFieldsAboveLayer,
  type BusinessProfileField,
} from "restaurant-pos-packages/access";
