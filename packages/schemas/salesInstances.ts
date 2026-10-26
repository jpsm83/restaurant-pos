/**
 * SalesInstances DTOs — the request bodies and path params the core
 * `salesInstances` routes plus the delivery and self-ordering flows accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `dailyReferenceNumber`, `openedByUserId`, `openedAsRole`, `closedByUserId`,
 * `closedAt`, `salesGroup` and `reservationId` never appear in a DTO, so a
 * client that sends them gets a `400`. ObjectId relations, the status enums and
 * the guest/discount numbers are validated here; the `ordersArrValidation`,
 * `validatePaymentMethodArray`, ownership, role, billing-status, paid>=total
 * and idempotency guards stay in the route as named post-parse checks.
 *
 * The delivery and self-ordering flows are the one exception to the
 * `paymentId` rule: the client supplies it as a stable idempotency key so a
 * retried payment resolves to the same SalesInstance.
 */
import { z } from "zod";

import {
  coercedBooleanSchema,
  coercedIntSchema,
  coercedNumberSchema,
  freeTextString,
  objectIdSchema,
  sanitizedString,
  trimmedString,
} from "./primitives.ts";
import { orderItemSchema } from "./orders.ts";
import { reasonCode, reasonNote } from "./operationalReasons.ts";

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
  reasonCode: reasonCode.optional(),
  reasonNote,
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

/**
 * A delivery address. Mirrors the Address model's required/optional fields;
 * every text field is sanitized at the boundary.
 */
export const deliveryAddressSchema = z.strictObject({
  country: sanitizedString("Country is required!"),
  state: sanitizedString("State is required!"),
  city: sanitizedString("City is required!"),
  street: sanitizedString("Street is required!"),
  buildingNumber: sanitizedString("Building number is required!"),
  doorNumber: sanitizedString().optional(),
  complement: sanitizedString().optional(),
  postCode: sanitizedString("Postcode is required!"),
  region: sanitizedString().optional(),
  additionalDetails: freeTextString().optional(),
  coordinates: z.tuple([coercedNumberSchema, coercedNumberSchema]).optional(),
});

/** Path params for the self-ordering routes. */
export const selfOrderingLocationIdParamsSchema = z.strictObject({
  selfOrderingLocationId: objectIdSchema,
});

/**
 * Body for `POST /salesInstances/selfOrderingLocation/:selfOrderingLocationId/openTable`.
 * An on-duty employee opens a table scanned from a QR; `guests` defaults to 1.
 */
export const openSelfOrderingTableBodySchema = z.strictObject({
  businessId: objectIdSchema,
  guests: guestCountSchema.default(1),
});

/**
 * Body for `POST /salesInstances/delivery`. `ordersArr` and `paymentMethodArr`
 * are validated at the boundary; `ordersArrValidation`,
 * `validatePaymentMethodArray` and the paid>=total check stay in the route.
 */
export const createDeliveryOrderBodySchema = z.strictObject({
  businessId: objectIdSchema,
  ordersArr: z.array(orderItemSchema),
  paymentMethodArr: z.array(paymentMethodItemSchema),
  deliveryAddress: deliveryAddressSchema.optional(),
  paymentId: trimmedString("paymentId is required for delivery idempotency!"),
});

/**
 * Body for `POST /salesInstances/selfOrderingLocation/:selfOrderingLocationId`
 * (customer QR self-order). The same boundary/post-parse split as delivery.
 */
export const createSelfOrderBodySchema = z.strictObject({
  businessId: objectIdSchema,
  ordersArr: z.array(orderItemSchema),
  paymentMethodArr: z.array(paymentMethodItemSchema),
  paymentId: trimmedString("paymentId is required for self-order idempotency!"),
});

/** Path params for `GET /salesInstances/business/:businessId`. */
export const salesInstancesByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/** Path params for `GET /salesInstances/user/:userId`. */
export const salesInstancesByUserParamsSchema = z.strictObject({
  userId: objectIdSchema,
});

/** Optional query for sales-instance reads: include soft-deleted records explicitly. */
export const salesInstancesIncludeDeletedQuerySchema = z.strictObject({
  includeDeleted: coercedBooleanSchema.optional(),
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
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;
export type SelfOrderingLocationIdParams = z.infer<
  typeof selfOrderingLocationIdParamsSchema
>;
export type OpenSelfOrderingTableBody = z.infer<
  typeof openSelfOrderingTableBodySchema
>;
export type CreateDeliveryOrderBody = z.infer<
  typeof createDeliveryOrderBodySchema
>;
export type CreateSelfOrderBody = z.infer<typeof createSelfOrderBodySchema>;
export type SalesInstancesByBusinessParams = z.infer<
  typeof salesInstancesByBusinessParamsSchema
>;
export type SalesInstancesByUserParams = z.infer<
  typeof salesInstancesByUserParamsSchema
>;
export type SalesInstancesIncludeDeletedQuery = z.infer<
  typeof salesInstancesIncludeDeletedQuerySchema
>;
