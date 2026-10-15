/**
 * Reservations DTOs — the request bodies, path params and query the reservations
 * routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `createdByUserId`, `createdByRole`, `salesInstanceId` and the timestamps never
 * appear in a DTO, so a client that sends them gets a `400`. The DTOs own
 * per-field shape and types — the `reservationStatusValues` membership, ObjectId
 * relations, the guest count and date coercion. Cross-field and
 * database-dependent rules stay in the route as named post-parse checks: the
 * `reservationEnd > reservationStart` period rule, the allowed status
 * transitions, and the employee/management role guards.
 */
import { z } from "zod";

import { coercedIntSchema, freeTextString, objectIdSchema } from "./primitives.ts";

/**
 * The reservation statuses. Pinned locally so `z.enum` carries the literal
 * union into `z.infer`; the parity test asserts these match the shared
 * `reservationStatusEnums` so the two cannot drift.
 */
export const reservationStatusValues = [
  "Pending",
  "Confirmed",
  "Arrived",
  "Seated",
  "Cancelled",
  "NoShow",
  "Completed",
] as const;

export type ReservationStatus = (typeof reservationStatusValues)[number];

const reservationStatusSchema = z.enum(
  reservationStatusValues,
  "Invalid status value!",
);

/** A positive integer guest count. */
const guestCountSchema = coercedIntSchema.positive(
  "GuestCount must be greater than 0!",
);

/** An optional query date; an empty string is treated as "not provided". */
const optionalDateSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.coerce.date().optional(),
);

/**
 * Body for `POST /reservations`. `createdByUserId` and `createdByRole` are
 * derived from the authenticated session, not the body. The default
 * `reservationEnd` (start + 2h) and the `reservationEnd > reservationStart` rule
 * are applied in the route after parsing.
 */
export const createReservationBodySchema = z.strictObject({
  businessId: objectIdSchema,
  guestCount: guestCountSchema,
  reservationStart: z.coerce.date(),
  reservationEnd: z.coerce.date().optional(),
  description: freeTextString().optional(),
});

/** Path params for `GET`/`PATCH`/`DELETE /reservations/:reservationId`. */
export const reservationIdParamsSchema = z.strictObject({
  reservationId: objectIdSchema,
});

/**
 * Body for `PATCH /reservations/:reservationId` — every field is optional and
 * client-settable. `businessId`, `createdByUserId`, `createdByRole` and
 * `salesInstanceId` are server-owned and not accepted.
 */
export const updateReservationBodySchema = z.strictObject({
  status: reservationStatusSchema.optional(),
  salesPointId: objectIdSchema.optional(),
  reservationStart: z.coerce.date().optional(),
  reservationEnd: z.coerce.date().optional(),
  guestCount: guestCountSchema.optional(),
  description: freeTextString().optional(),
  employeeResponsableByUserId: objectIdSchema.optional(),
});

/**
 * Query for `GET /reservations/business/:businessId`. The date-range rule
 * (`startDate <= endDate`) is enforced in the route.
 */
export const reservationsByBusinessQuerySchema = z.strictObject({
  status: reservationStatusSchema.optional(),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
});

/**
 * Query for `GET /reservations`. The date-range rule (`startDate <= endDate`) is
 * enforced in the route.
 */
export const reservationsQuerySchema = reservationsByBusinessQuerySchema.extend({
  businessId: objectIdSchema.optional(),
});

/** Path params for `GET /reservations/business/:businessId`. */
export const reservationsByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

export type CreateReservationBody = z.infer<typeof createReservationBodySchema>;
export type UpdateReservationBody = z.infer<typeof updateReservationBodySchema>;
export type ReservationIdParams = z.infer<typeof reservationIdParamsSchema>;
export type ReservationsQuery = z.infer<typeof reservationsQuerySchema>;
export type ReservationsByBusinessParams = z.infer<
  typeof reservationsByBusinessParamsSchema
>;
export type ReservationsByBusinessQuery = z.infer<
  typeof reservationsByBusinessQuerySchema
>;
