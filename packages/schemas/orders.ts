/**
 * Orders DTOs — the request bodies, path params and query the orders routes
 * accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * fields (`createdByUserId`, `createdAsRole`, `billingStatus`, `orderStatus`,
 * the promotion-derived `discountPercentage`) never appear in a DTO, so a
 * client that sends them gets a `400`. ObjectIds inside the order array are
 * validated with the shared ObjectId schema; the per-order key whitelist is
 * enforced here by `z.strictObject`, while `ordersArrValidation` and the
 * price-tolerance check stay in the route as named post-parse checks.
 */
import { z } from "zod";

import { allergensEnums } from "../enums.ts";
import {
  coercedIntSchema,
  coercedNumberSchema,
  freeTextString,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

const allergenSchema = z.enum(allergensEnums as [string, ...string[]]);

/**
 * A single order line inside `ordersArr`. Mirrors the client-settable subset
 * of the Order model; `businessGoodId`/`addOns` are ObjectIds and the prices
 * are coerced so numeric strings are accepted like the previous handler did.
 */
export const orderItemSchema = z.strictObject({
  businessGoodId: objectIdSchema,
  addOns: z.array(objectIdSchema).optional(),
  orderGrossPrice: coercedNumberSchema,
  orderNetPrice: coercedNumberSchema,
  orderCostPrice: coercedNumberSchema,
  allergens: z.array(allergenSchema).optional(),
  promotionApplyed: sanitizedString().optional(),
  comments: freeTextString().optional(),
});

/**
 * Body for `POST /orders`. `createdByUserId` and `createdAsRole` are derived
 * from the authenticated session, not the body.
 */
export const createOrderBodySchema = z.strictObject({
  ordersArr: z
    .array(orderItemSchema)
    .min(1, "OrdersArr must contain at least one order!"),
  salesInstanceId: objectIdSchema,
  businessId: objectIdSchema,
  dailyReferenceNumber: coercedIntSchema,
});

/** Path params for `GET`/`DELETE /orders/:orderId`. */
export const orderIdParamsSchema = z.strictObject({
  orderId: objectIdSchema,
});

/** Path params for `GET /orders/salesInstance/:salesInstanceId`. */
export const ordersBySalesInstanceParamsSchema = z.strictObject({
  salesInstanceId: objectIdSchema,
});

/** Path params for `GET /orders/user/:userId`. */
export const ordersByUserParamsSchema = z.strictObject({
  userId: objectIdSchema,
});

export type OrderItem = z.infer<typeof orderItemSchema>;
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type OrderIdParams = z.infer<typeof orderIdParamsSchema>;
export type OrdersBySalesInstanceParams = z.infer<
  typeof ordersBySalesInstanceParamsSchema
>;
export type OrdersByUserParams = z.infer<typeof ordersByUserParamsSchema>;
