/**
 * SalesInstances DTOs — the request bodies and path params the core
 * `salesInstances` routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `dailyReferenceNumber`, `openedByUserId`, `openedAsRole`, `closedByUserId`,
 * `closedAt`, `salesGroup`, `paymentId` and `reservationId` never appear in a
 * DTO, so a client that sends them gets a `400`. ObjectId relations, the status
 * enums and the guest/discount numbers are validated here; the
 * `ordersArrValidation`, ownership, role and billing-status guards stay in the
 * route as named post-parse checks.
 */
import { z } from "zod";

import {
  coercedBooleanSchema,
  coercedIntSchema,
  coercedNumberSchema,
  freeTextString,
  objectIdSchema,
  sanitizedString,
} from "./primitives.ts";

/**
 * The salesInstance statuses. Pinned locally so `z.enum` carries the literal
 * union into `z.infer`; the parity test asserts these match the shared
 * `salesInstanceStatusEnums` so the two cannot drift.
 */
export const salesInstanceStatusValues = [
  "Occupied",
  "Reserved",
  "Bill",
  "Closed",
] as const;

export type SalesInstanceStatus = (typeof salesInstanceStatusValues)[number];

const salesInstanceStatusSchema = z.enum(
  salesInstanceStatusValues,
  "Invalid status value!",
);

/**
 * The billing statuses accepted as `ordersNewBillingStatus`. Pinned locally for
 * the literal union; the parity test asserts these match the shared
 * `billingStatusEnums`.
 */
export const ordersNewBillingStatusValues = [
  "Open",
  "Paid",
  "Void",
  "Cancel",
  "Invitation",
] as const;

const ordersNewBillingStatusSchema = z.enum(
  ordersNewBillingStatusValues,
  "Invalid billing status value!",
);

/**
 * The order statuses accepted as `ordersNewStatus`. Pinned locally for the
 * literal union; the parity test asserts these match the shared
 * `orderStatusEnums`.
 */
export const ordersNewStatusValues = [
  "Sent",
  "Done",
  "Dont Make",
  "Hold",
  "Delivered",
] as const;

const ordersNewStatusSchema = z.enum(
  ordersNewStatusValues,
  "Invalid order status value!",
);

/** A positive integer guest count. */
const guestCountSchema = coercedIntSchema.positive(
  "Guests must be greater than 0!",
);

/**
 * A single payment method line inside `paymentMethodArr`. The branch/type
 * matching stays in `validatePaymentMethodArray` as a post-parse check.
 */
export const paymentMethodItemSchema = z.strictObject({
  paymentMethodType: sanitizedString(),
  methodBranch: sanitizedString(),
  methodSalesTotal: coercedNumberSchema,
});

/** Body for `POST /salesInstances`. */
export const createSalesInstanceBodySchema = z.strictObject({
  salesPointId: objectIdSchema,
  guests: guestCountSchema,
  salesInstanceStatus: salesInstanceStatusSchema.optional(),
  businessId: objectIdSchema,
  clientName: sanitizedString().optional(),
});

/** Path params for `GET`/`PATCH`/`DELETE /salesInstances/:salesInstanceId`. */
export const salesInstanceIdParamsSchema = z.strictObject({
  salesInstanceId: objectIdSchema,
});

/**
 * Body for `PATCH /salesInstances/:salesInstanceId`. Every field is optional.
 * Beyond the instance fields it carries the operation parameters
 * (`ordersIdsArr`, `cancel`, `paymentMethodArr`, `toSalesInstanceId`, ...) whose
 * cross-field and ownership rules stay in the route.
 */
export const updateSalesInstanceBodySchema = z.strictObject({
  ordersIdsArr: z.array(objectIdSchema).optional(),
  discountPercentage: coercedNumberSchema.optional(),
  comments: freeTextString().optional(),
  cancel: coercedBooleanSchema.optional(),
  ordersNewBillingStatus: ordersNewBillingStatusSchema.optional(),
  voidReason: freeTextString().optional(),
  ordersNewStatus: ordersNewStatusSchema.optional(),
  paymentMethodArr: z.array(paymentMethodItemSchema).optional(),
  toSalesInstanceId: objectIdSchema.optional(),
  guests: guestCountSchema.optional(),
  salesInstanceStatus: salesInstanceStatusSchema.optional(),
  responsibleByUserId: objectIdSchema.optional(),
  clientName: sanitizedString().optional(),
});

/** Body for `PATCH /salesInstances/:salesInstanceId/transferSalesPoint`. */
export const transferSalesPointBodySchema = z.strictObject({
  salesPointId: objectIdSchema,
});

/** Path params for `GET /salesInstances/business/:businessId`. */
export const salesInstancesByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/** Path params for `GET /salesInstances/user/:userId`. */
export const salesInstancesByUserParamsSchema = z.strictObject({
  userId: objectIdSchema,
});

export type CreateSalesInstanceBody = z.infer<
  typeof createSalesInstanceBodySchema
>;
export type UpdateSalesInstanceBody = z.infer<
  typeof updateSalesInstanceBodySchema
>;
export type SalesInstanceIdParams = z.infer<typeof salesInstanceIdParamsSchema>;
export type TransferSalesPointBody = z.infer<
  typeof transferSalesPointBodySchema
>;
export type SalesInstancesByBusinessParams = z.infer<
  typeof salesInstancesByBusinessParamsSchema
>;
export type SalesInstancesByUserParams = z.infer<
  typeof salesInstancesByUserParamsSchema
>;
