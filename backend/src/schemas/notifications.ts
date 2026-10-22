/**
 * Notifications DTOs — the request bodies, path params and query the
 * notifications routes accept.
 *
 * Backend-only (not shared with the frontend). Strict (unknown keys rejected)
 * and client-settable only: the server-owned `_id` and timestamps never appear
 * in a DTO, so a client that sends them gets a `400`. `notificationType` is
 * pinned to the shared `notificationEnums` values (the parity test asserts they
 * cannot drift); recipient arrays are ObjectId arrays. The employees/customers
 * recipient exclusivity rule spans more than one field and stays in the route as
 * a named post-parse check. Pagination query values are coerced from the URL
 * string form and clamped to safe bounds.
 */
import { z } from "zod";

import {
  coercedBooleanSchema,
  coercedIntSchema,
  freeTextString,
  objectIdSchema,
} from "restaurant-pos-packages/schemas/primitives";

/** Default page size when a client sends no `limit`. */
export const NOTIFICATIONS_DEFAULT_LIMIT = 20;
/** Largest page size a client may request. */
export const NOTIFICATIONS_MAX_LIMIT = 100;

/**
 * The notification types. Pinned locally so `z.enum` carries the literal union
 * into `z.infer`; the parity test asserts these match the shared
 * `notificationEnums` so the two cannot drift.
 */
export const notificationTypeValues = [
  "Warning",
  "Emergency",
  "Info",
  "Message",
  "Promotion",
  "Birthday",
  "Event",
] as const;

/** A `notificationType` from the shared enum. */
export const notificationTypeSchema = z.enum(
  notificationTypeValues,
  `notificationType must be one of: ${notificationTypeValues.join(", ")}`,
);

/** An array of recipient ObjectIds; non-emptiness is a post-parse check. */
const recipientIdsSchema = z.array(objectIdSchema);

/**
 * Query for the notification list endpoints. `page` and `limit` are coerced
 * from strings and clamped (`page` >= 1, `limit` 1..100); `includeRecipients`
 * accepts the string forms of a boolean.
 */
export const notificationsPaginationQuerySchema = z.strictObject({
  page: coercedIntSchema
    .optional()
    .transform((value) => (value === undefined || value < 1 ? 1 : value)),
  limit: coercedIntSchema.optional().transform((value) => {
    if (value === undefined || value < 1) return NOTIFICATIONS_DEFAULT_LIMIT;
    return Math.min(value, NOTIFICATIONS_MAX_LIMIT);
  }),
  includeRecipients: coercedBooleanSchema.optional(),
  includeDeleted: coercedBooleanSchema.optional(),
});

/** Path params for `GET`/`PATCH`/`DELETE /notifications/:notificationId`. */
export const notificationIdParamsSchema = z.strictObject({
  notificationId: objectIdSchema,
});

/** Optional query for single-notification reads. */
export const notificationsIncludeDeletedQuerySchema = z.strictObject({
  includeDeleted: coercedBooleanSchema.optional(),
});

/** Path params for `GET /notifications/business/:businessId`. */
export const notificationsByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/** Path params for `GET /notifications/user/:userId`. */
export const notificationsByUserParamsSchema = z.strictObject({
  userId: objectIdSchema,
});

/**
 * Body for `POST /notifications`. The employees/customers recipient exclusivity
 * rule is enforced in the route after parsing.
 */
export const createNotificationBodySchema = z.strictObject({
  notificationType: notificationTypeSchema,
  message: freeTextString("Message is required!"),
  businessId: objectIdSchema,
  senderId: objectIdSchema.optional(),
  employeesRecipientsIds: recipientIdsSchema.optional(),
  customersRecipientsIds: recipientIdsSchema.optional(),
});

/**
 * Body for `PATCH /notifications/:notificationId` — every field is optional and
 * client-settable. `businessId` is server-owned and not accepted.
 */
export const updateNotificationBodySchema = z.strictObject({
  notificationType: notificationTypeSchema.optional(),
  message: freeTextString().optional(),
  senderId: objectIdSchema.optional(),
  employeesRecipientsIds: recipientIdsSchema.optional(),
  customersRecipientsIds: recipientIdsSchema.optional(),
});

export type NotificationTypeDto = z.infer<typeof notificationTypeSchema>;
export type NotificationsPaginationQuery = z.infer<
  typeof notificationsPaginationQuerySchema
>;
export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;
export type NotificationsByBusinessParams = z.infer<
  typeof notificationsByBusinessParamsSchema
>;
export type NotificationsIncludeDeletedQuery = z.infer<
  typeof notificationsIncludeDeletedQuerySchema
>;
export type NotificationsByUserParams = z.infer<
  typeof notificationsByUserParamsSchema
>;
export type CreateNotificationBody = z.infer<
  typeof createNotificationBodySchema
>;
export type UpdateNotificationBody = z.infer<
  typeof updateNotificationBodySchema
>;
