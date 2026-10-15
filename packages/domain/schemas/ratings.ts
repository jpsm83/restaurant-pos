/**
 * Ratings DTOs — the request bodies, path params and query the ratings routes
 * accept.
 *
 * Strict (unknown keys rejected) and client-settable only: `userId` and the
 * cached `averageRating` / `ratingCount` are server-owned and never appear in a
 * DTO. Query pagination is coerced from the URL string form and clamped to safe
 * bounds so a client cannot ask for an unbounded page.
 */
import { z } from "zod";

import { coercedIntSchema, freeTextString, objectIdSchema } from "./primitives.ts";

/** Default page size when a client sends no `limit`. */
export const RATINGS_DEFAULT_LIMIT = 20;
/** Largest page size a client may request. */
export const RATINGS_MAX_LIMIT = 100;

/**
 * Body for `POST /ratings`. `userId` is derived from the authenticated session,
 * not the body; `businessId`, `score` and the optional `orderId`/`comment` are
 * the only client-settable fields.
 */
export const createRatingBodySchema = z.strictObject({
  businessId: objectIdSchema,
  orderId: objectIdSchema.optional(),
  score: z
    .number({ error: "Score is required!" })
    .min(0, "Score must be between 0 and 5!")
    .max(5, "Score must be between 0 and 5!"),
  comment: freeTextString().optional(),
});

/** Path params for `GET /ratings/:ratingId`. */
export const ratingIdParamsSchema = z.strictObject({
  ratingId: objectIdSchema,
});

/** Path params for `GET /ratings/business/:businessId`. */
export const ratingsByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/**
 * Query for `GET /ratings/business/:businessId`: `limit`/`skip` are coerced
 * from strings and clamped (`limit` 1..100, `skip` >= 0).
 */
export const ratingsPaginationQuerySchema = z.strictObject({
  limit: coercedIntSchema.optional().transform((value) =>
    value === undefined
      ? RATINGS_DEFAULT_LIMIT
      : Math.min(Math.max(value, 1), RATINGS_MAX_LIMIT),
  ),
  skip: coercedIntSchema.optional().transform((value) =>
    value === undefined ? 0 : Math.max(value, 0),
  ),
});

export type CreateRatingBody = z.infer<typeof createRatingBodySchema>;
export type RatingIdParams = z.infer<typeof ratingIdParamsSchema>;
export type RatingsByBusinessParams = z.infer<
  typeof ratingsByBusinessParamsSchema
>;
export type RatingsPaginationQuery = z.infer<typeof ratingsPaginationQuerySchema>;
