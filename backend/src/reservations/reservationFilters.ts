/**
 * Shared reservation filter helpers.
 *
 * `GET /reservations` and `GET /reservations/business/:businessId` build the
 * same Mongo filter and run the same list query; these helpers keep that shape
 * and the cross-field date-range rule in one place. The date-range rule spans
 * `startDate` and `endDate`, so it stays a post-parse check.
 */
import { Types } from "mongoose";

import Reservation from "../models/reservation.ts";
import { badRequest, notFound } from "../errors/appError.ts";
import type { ReservationStatus } from "domain/schemas/reservations";

export interface ReservationFilter {
  businessId?: Types.ObjectId;
  reservationStart?: { $gte?: Date; $lte?: Date };
  status?: ReservationStatus;
}

/**
 * Adds `reservationStart` bounds to `filter`. Throws a `badRequest` problem when
 * an inverted range is supplied (`startDate > endDate`).
 */
export function applyReservationDateRange(
  filter: ReservationFilter,
  startDate?: Date,
  endDate?: Date,
): void {
  if (!startDate && !endDate) return;

  filter.reservationStart = {};
  if (startDate) filter.reservationStart.$gte = startDate;
  if (endDate) filter.reservationStart.$lte = endDate;

  if (startDate && endDate && startDate > endDate) {
    throw badRequest("Invalid date range, startDate must be before endDate!");
  }
}

/** Finds reservations for `filter`, or throws a `notFound` problem when empty. */
export async function listReservations(filter: ReservationFilter) {
  const reservations = await Reservation.find(filter).sort({
    reservationStart: 1,
  });

  if (!reservations.length) {
    throw notFound("No reservations found!");
  }
  return reservations;
}
