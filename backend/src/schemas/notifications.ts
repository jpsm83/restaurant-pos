/**
 * Notifications DTOs — the path params and query the inbox routes accept.
 *
 * There is no request body DTO: the internal `notificationService` is the only
 * notification write path and it accepts only the machine-readable
 * `NotificationContent` shape. No route can reintroduce free-form client copy.
 * Pagination query values are coerced from the URL string form and clamped to
 * safe bounds.
 */
import { z } from "zod";

import {
  coercedIntSchema,
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

/** Query for the authenticated self inbox; only pagination is accepted. */
export const notificationInboxQuerySchema = z.strictObject({
  page: coercedIntSchema
    .optional()
    .transform((value) => (value === undefined || value < 1 ? 1 : value)),
  limit: coercedIntSchema.optional().transform((value) => {
    if (value === undefined || value < 1) return NOTIFICATIONS_DEFAULT_LIMIT;
    return Math.min(value, NOTIFICATIONS_MAX_LIMIT);
  }),
});

/** Path params for the inbox read/hide routes. */
export const notificationIdParamsSchema = z.strictObject({
  notificationId: objectIdSchema,
});

export type NotificationTypeDto = z.infer<typeof notificationTypeSchema>;
export type NotificationInboxQuery = z.infer<
  typeof notificationInboxQuerySchema
>;
export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;
