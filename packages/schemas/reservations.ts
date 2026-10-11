/**
 * Reservations DTOs — the request bodies, path params and query the reservations
 * routes accept.
 *
 * Strict (unknown keys rejected) and client-settable only: the server-owned
 * `createdByUserId`, `createdByRole` and the timestamps never appear in a DTO,
 * so a client that sends them gets a `400`. The DTOs own per-field shape and
 * types — the `reservationStatusEnums` membership, ObjectId relations, the guest
 * count and date coercion. Cross-field and database-dependent rules stay in the
 * route as named post-parse checks: `reservationEnd > reservationStart`, the
 * allowed status transitions, and the employee/management role guards.
 */
import { z } from "zod";

import { reservationStatusEnums } from "../enums.ts";
import {
  coercedIntSchema,
  freeTextString,
  objectIdSchema,
} from "./primitives.ts";

/** A reservation status from the shared enum. */
const reservationStatusSchema = z.enum(
  reservationStatusEnums as [string, ...string[]],
  "Invalid status value!",
);

/** An optional query date; an empty string is treated as "not provided". */
const optionalDateSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.coerce.date().optional(),
);

/** The filters shared by `GET /reservations` and `GET /reservations/business/:businessId`. */
const reservationFiltersSchema = z.strictObject({
  status: reservationStatusSchema.optional(),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
});

/**
 * Body for `POST /reservations`. `createdByUserId` and `createdByRole` are
 * derived from the authenticated session, not the body. The default
 * `reservationEnd` (start + 2h) and the `reservationEnd > reservationStart` rule
 * are applied in the route after parsing.
 */
export const createReservationBodySchema = z.strictObject({
  businessId: objectIdSchema,
  guestCount: coercedIntSchema.positive("GuestCount must be greater than 0!"),
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
 * client-settable. `businessId`, `createdByUserId` and `createdByRole` are not.
 */
export const updateReservationBodySchema = z.strictObject({
  status: reservationStatusSchema.optional(),
  salesPointId: objectIdSchema.optional(),
  reservationStart: z.coerce.date().optional(),
  reservationEnd: z.coerce.date().optional(),
  guestCount: coercedIntSchema.positive("GuestCount must be greater than 0!").optional(),
  description: freeTextString().optional(),
  employeeResponsableByUserId: objectIdSchema.optional(),
  salesInstanceId: objectIdSchema.optional(),
});

/**
 * Query for `GET /reservations`. The date-range rule (`startDate <= endDate`) is
 * enforced in the route.
 */
export const reservationsQuerySchema = reservationFiltersSchema.extend({
  businessId: objectIdSchema.optional(),
});

/** Path params for `GET /reservations/business/:businessId`. */
export const reservationsByBusinessParamsSchema = z.strictObject({
  businessId: objectIdSchema,
});

/**
 * Query for `GET /reservations/business/:businessId`. The date-range rule
 * (`startDate <= endDate`) is enforced in the route.
 */
export const reservationsByBusinessQuerySchema = reservationFiltersSchema;

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
