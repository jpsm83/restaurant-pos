/**
 * Business DTOs — the request bodies, path params and query the business routes
 * accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `averageRating`, `ratingCount`, `timezone`, `emailVerified`, token fields and
 * `refreshSessionVersion` never appear in a DTO, so a client that sends them
 * gets a `400`. The registration and profile-update bodies are consumed through
 * the shared multipart helper, so JSON-encoded fields (`address`,
 * `businessOpeningHours`, `deliveryOpeningWindows`, `metrics`,
 * `reportingConfig`) are parsed and validated here. Enum values come from
 * `packages/enums.ts`.
 */
import { z } from "zod";

import {
  currenctyEnums,
  cuisineTypeEnums,
  foodSubCategoryEnums,
  subscriptionEnums,
} from "../enums.ts";
import { passwordSchema } from "./auth.ts";
import { addressSchema } from "./address.ts";
import {
  coercedBooleanSchema,
  coercedIntSchema,
  coercedNumberSchema,
  emailSchema,
  emptyToUndefined,
  type EnumValues,
  jsonField,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

/** An optional boolean field; a blank string is treated as "not provided". */
const optionalBooleanSchema = z.preprocess(
  emptyToUndefined,
  coercedBooleanSchema.optional(),
);

/** An optional non-negative number; a blank string is "not provided". */
const optionalNonNegativeNumberSchema = z.preprocess(
  emptyToUndefined,
  coercedNumberSchema.min(0).optional(),
);

/** An optional JSON-encoded field; a blank string is "not provided". */
const optionalJsonField = <T extends z.ZodType>(schema: T) =>
  z.preprocess(emptyToUndefined, jsonField(schema).optional());

/** `HH:MM`, 24-hour clock. */
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const clockTimeSchema = z
  .string()
  .trim()
  .regex(CLOCK_TIME_PATTERN, "Time must use the HH:MM format");

/** A `dayOfWeek` from 0 (Sunday) to 6 (Saturday). */
const dayOfWeekSchema = coercedIntSchema.min(0).max(6);

/**
 * The address payload attached to a business (JSON-encoded over multipart).
 * The shape is shared with every other address-owning entity.
 */
export const businessAddressSchema = addressSchema;

/** One weekly opening-hours entry. */
const businessOpeningHourSchema = z.strictObject({
  dayOfWeek: dayOfWeekSchema,
  openTime: clockTimeSchema,
  closeTime: clockTimeSchema,
});

/** One delivery time window. */
const deliveryWindowSchema = z.strictObject({
  openTime: clockTimeSchema,
  closeTime: clockTimeSchema,
});

/** One weekly delivery-opening entry with its nested windows. */
const deliveryOpeningWindowSchema = z.strictObject({
  dayOfWeek: dayOfWeekSchema,
  windows: z.array(deliveryWindowSchema),
});

/** Business cost metrics; every key is required when a `metrics` field is sent. */
export const businessMetricsSchema = z.strictObject({
  foodCostPercentage: coercedNumberSchema,
  beverageCostPercentage: coercedNumberSchema,
  laborCostPercentage: coercedNumberSchema,
  fixedCostPercentage: coercedNumberSchema,
  supplierGoodWastePercentage: z.strictObject({
    veryLowBudgetImpact: coercedNumberSchema,
    lowBudgetImpact: coercedNumberSchema,
    mediumBudgetImpact: coercedNumberSchema,
    hightBudgetImpact: coercedNumberSchema,
    veryHightBudgetImpact: coercedNumberSchema,
  }),
});

/** Reporting configuration; the weekly report start day is 0-6 (0 = Sunday). */
export const businessReportingConfigSchema = z.strictObject({
  weeklyReportStartDay: z.number().int().min(0).max(6),
});

const cuisineTypeValueSchema = z.enum(
  cuisineTypeEnums as EnumValues,
  "Invalid cuisineType!",
);

/**
 * A cuisine list. Canonical clients send a JSON array; a legacy client may send
 * a single enum value as a bare string, which normalizes to a one-item list.
 */
const cuisineTypeSchema = z
  .preprocess(
    (value, ctx) => {
      if (typeof value !== "string") return value;
      const raw = value.trim();
      if (raw === "") return undefined;
      if (raw.startsWith("[")) {
        try {
          return JSON.parse(raw);
        } catch {
          ctx.addIssue({ code: "custom", message: "Invalid JSON" });
          return z.NEVER;
        }
      }
      return raw;
    },
    z
      .union([z.array(cuisineTypeValueSchema), cuisineTypeValueSchema])
      .transform((value) => (Array.isArray(value) ? value : [value])),
  )
  .optional();

const foodSubCategorySchema = z.enum(
  foodSubCategoryEnums as EnumValues,
  "Invalid category!",
);

/**
 * The cuisine list on profile update. A blank field clears the list (`[]`), a
 * JSON array replaces it, and an absent field leaves it unchanged.
 */
const optionalCuisineTypeSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? "[]" : value),
  jsonField(z.array(cuisineTypeValueSchema)).optional(),
);

const optionalCategoriesSchema = optionalJsonField(
  z.array(foodSubCategorySchema),
);

const optionalOpeningHoursSchema = optionalJsonField(
  z.array(businessOpeningHourSchema),
);

const optionalDeliveryWindowsSchema = optionalJsonField(
  z.array(deliveryOpeningWindowSchema),
);

/**
 * Body for `POST /business` (multipart). The uploaded logo is collected by the
 * multipart helper as a file, not a field. `averageRating` and `ratingCount` are
 * server-owned and rejected here.
 */
export const createBusinessBodySchema = z.strictObject({
  tradeName: sanitizedString("Trade name is required!"),
  legalName: sanitizedString("Legal name is required!"),
  email: emailSchema,
  password: passwordSchema,
  phoneNumber: sanitizedString("Phone number is required!"),
  taxNumber: sanitizedString("Tax number is required!"),
  subscription: z.enum(subscriptionEnums as EnumValues, "Invalid subscription!"),
  currencyTrade: z.enum(currenctyEnums as EnumValues, "Invalid currencyTrade!"),
  address: jsonField(businessAddressSchema),
  contactPerson: sanitizedString().optional(),
  cuisineType: cuisineTypeSchema,
  categories: optionalCategoriesSchema,
  acceptsDelivery: optionalBooleanSchema,
  deliveryRadius: optionalNonNegativeNumberSchema,
  minOrder: optionalNonNegativeNumberSchema,
  businessOpeningHours: optionalOpeningHoursSchema,
  deliveryOpeningWindows: optionalDeliveryWindowsSchema,
});

/**
 * Body for `PATCH /business/:businessId` (multipart). The identity fields are
 * required (the profile form always submits them); everything else is optional.
 * The sign-in `email` and the credentials (`password`/`currentPassword`) are not
 * part of this contract: email changes go through the verified email-change flow
 * and password changes through the reset-password flow, so a client that sends
 * them gets a `400` as unknown keys.
 */
export const updateBusinessBodySchema = z.strictObject({
  tradeName: sanitizedString("Trade name is required!"),
  legalName: sanitizedString("Legal name is required!"),
  phoneNumber: sanitizedString("Phone number is required!"),
  taxNumber: sanitizedString("Tax number is required!"),
  subscription: z.enum(subscriptionEnums as EnumValues, "Invalid subscription!"),
  currencyTrade: z.enum(currenctyEnums as EnumValues, "Invalid currencyTrade!"),
  address: jsonField(businessAddressSchema),
  contactPerson: sanitizedString().optional(),
  cuisineType: optionalCuisineTypeSchema,
  categories: optionalCategoriesSchema,
  acceptsDelivery: optionalBooleanSchema,
  deliveryRadius: optionalNonNegativeNumberSchema,
  minOrder: optionalNonNegativeNumberSchema,
  businessOpeningHours: optionalOpeningHoursSchema,
  deliveryOpeningWindows: optionalDeliveryWindowsSchema,
  metrics: optionalJsonField(businessMetricsSchema),
  reportingConfig: optionalJsonField(businessReportingConfigSchema),
});

/** Path params for `GET`/`DELETE /business/:businessId` and profile update. */
export const businessIdParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/**
 * Query for `GET /business` discovery. `name`/`tradeName` and `rating`/
 * `minRating` are accepted aliases; a blank value is treated as "not provided".
 */
export const discoverBusinessesQuerySchema = z.strictObject({
  cuisineType: z.preprocess(
    emptyToUndefined,
    cuisineTypeValueSchema.optional(),
  ),
  categories: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  name: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  tradeName: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  rating: z.preprocess(
    emptyToUndefined,
    coercedNumberSchema.min(0).max(5).optional(),
  ),
  minRating: z.preprocess(
    emptyToUndefined,
    coercedNumberSchema.min(0).max(5).optional(),
  ),
  lat: z.preprocess(emptyToUndefined, coercedNumberSchema.optional()),
  lng: z.preprocess(emptyToUndefined, coercedNumberSchema.optional()),
  radius: optionalNonNegativeNumberSchema,
  limit: z.preprocess(
    emptyToUndefined,
    coercedIntSchema
      .optional()
      .transform((value) =>
        value === undefined ? undefined : Math.min(Math.max(value, 1), 100),
      ),
  ),
  includeDeleted: z.preprocess(emptyToUndefined, coercedBooleanSchema.optional()),
});

/** Optional query for single-business reads. */
export const businessIncludeDeletedQuerySchema = z.strictObject({
  includeDeleted: z.preprocess(emptyToUndefined, coercedBooleanSchema.optional()),
});

export type BusinessAddress = z.infer<typeof businessAddressSchema>;
export type BusinessMetrics = z.infer<typeof businessMetricsSchema>;
export type BusinessReportingConfig = z.infer<
  typeof businessReportingConfigSchema
>;
export type CreateBusinessBody = z.infer<typeof createBusinessBodySchema>;
export type UpdateBusinessBody = z.infer<typeof updateBusinessBodySchema>;
export type BusinessIdParams = z.infer<typeof businessIdParamsSchema>;
export type DiscoverBusinessesQuery = z.infer<
  typeof discoverBusinessesQuerySchema
>;
export type BusinessIncludeDeletedQuery = z.infer<
  typeof businessIncludeDeletedQuerySchema
>;
