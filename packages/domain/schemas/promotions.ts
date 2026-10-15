/**
 * Promotions DTOs — the request bodies, path params and query the promotions
 * routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `_id` and timestamps never appear in a DTO, so a client that sends them gets a
 * `400`. The DTOs own per-field shape and types — the allowed pricing keys with
 * their value types, date coercion and the `weekDaysEnums` membership.
 * Cross-field rules stay in the route as named post-parse checks:
 * `validatePromotionType` enforces exactly one pricing key, `validateDateAndTime`
 * enforces `start < end`, and `validateDaysOfTheWeek` enforces a non-empty day
 * list.
 */
import { z } from "zod";

import { weekDaysEnums } from "../enums.ts";
import {
  coercedBooleanSchema,
  freeTextString,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

/**
 * The pricing keys a promotion may carry, each with its value type. Which key
 * is present (and that exactly one is) is a cross-field rule enforced by
 * `validatePromotionType` after parsing.
 */
export const promotionTypeSchema = z.strictObject({
  fixedPrice: z.number().optional(),
  discountPercent: z.number().optional(),
  twoForOne: z.boolean().optional(),
  threeForTwo: z.boolean().optional(),
  secondHalfPrice: z.boolean().optional(),
  fullComplimentary: z.boolean().optional(),
});

/** A `weekDays` entry from the shared enum. */
const weekDaySchema = z.enum(
  weekDaysEnums as [string, ...string[]],
  "Invalid day(s) in the weekDays array!",
);

/**
 * A list of days of the week. The non-empty rule is a cross-field rule enforced
 * by `validateDaysOfTheWeek` after parsing.
 */
const weekDaysSchema = z.array(weekDaySchema);

/**
 * A promotion period with both dates present and valid. `start < end` is a
 * cross-field rule enforced by `validateDateAndTime` after parsing.
 */
export const promotionPeriodSchema = z.strictObject({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

/** Body for `POST /promotions`. */
export const createPromotionBodySchema = z.strictObject({
  promotionName: sanitizedString("PromotionName is required!"),
  promotionPeriod: promotionPeriodSchema,
  weekDays: weekDaysSchema,
  activePromotion: coercedBooleanSchema,
  promotionType: promotionTypeSchema,
  businessId: objectIdSchema,
  businessGoodsToApplyIds: z.array(objectIdSchema).optional(),
  applyToDelivery: coercedBooleanSchema.optional(),
  description: freeTextString().optional(),
});

/** Path params for `GET`/`PATCH`/`DELETE /promotions/:promotionId`. */
export const promotionIdParamsSchema = z.strictObject({
  promotionId: objectIdSchema,
});

/**
 * Body for `PATCH /promotions/:promotionId` — every create field is optional
 * and `businessId` is not client-settable on update.
 */
export const updatePromotionBodySchema = createPromotionBodySchema
  .omit({ businessId: true })
  .partial();

/** Path params for `GET /promotions/business/:businessId`. */
export const promotionsByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/** An optional query date; an empty string is treated as "not provided". */
const optionalDateSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.coerce.date().optional(),
);

/**
 * Query for `GET /promotions/business/:businessId`. The date-range rule
 * (`startDate <= endDate`) is enforced in the route.
 */
export const promotionsByBusinessQuerySchema = z.strictObject({
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
});

export type PromotionTypeDto = z.infer<typeof promotionTypeSchema>;
export type PromotionPeriod = z.infer<typeof promotionPeriodSchema>;
export type CreatePromotionBody = z.infer<typeof createPromotionBodySchema>;
export type UpdatePromotionBody = z.infer<typeof updatePromotionBodySchema>;
export type PromotionIdParams = z.infer<typeof promotionIdParamsSchema>;
export type PromotionsByBusinessParams = z.infer<
  typeof promotionsByBusinessParamsSchema
>;
export type PromotionsByBusinessQuery = z.infer<
  typeof promotionsByBusinessQuerySchema
>;
