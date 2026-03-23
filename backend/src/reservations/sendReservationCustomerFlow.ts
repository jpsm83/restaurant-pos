/**
 * sendReservationCustomerFlow - Reservation notification flows for customers
 *
 * Contains two main flows:
 * - sendReservationPendingFlow: Notifies customer and managers when a reservation is pending
 * - sendReservationDecisionFlow: Notifies customer when a reservation is confirmed/cancelled
 */

import { Types } from "mongoose";
import dispatchEvent from "../communications/dispatchEvent.ts";

export async function sendReservationPendingFlow(params: {
  userId: Types.ObjectId;
  businessId: Types.ObjectId;
  reservationId: Types.ObjectId;
  reservationStart: Date;
  guestCount: number;
  description?: string;
}): Promise<void> {
  try {
    await dispatchEvent(
      "RESERVATION_PENDING",
      {
        businessId: params.businessId,
        userId: params.userId,
        reservationId: params.reservationId,
        reservationStart: params.reservationStart,
        guestCount: params.guestCount,
        description: params.description,
      },
      { fireAndForget: true }
    );
  } catch (error) {
    console.error("[reservations] sendReservationPendingFlow failed:", error);
  }
}

export async function sendReservationDecisionFlow(params: {
  userId: Types.ObjectId;
  businessId: Types.ObjectId;
  reservationId: Types.ObjectId;
  reservationStart: Date;
  guestCount: number;
  description?: string;
  status: "Confirmed" | "Cancelled";
}): Promise<void> {
  try {
    await dispatchEvent(
      "RESERVATION_DECIDED",
      {
        businessId: params.businessId,
        userId: params.userId,
        reservationId: params.reservationId,
        reservationStart: params.reservationStart,
        guestCount: params.guestCount,
        description: params.description,
        status: params.status,
      },
      { fireAndForget: true }
    );
  } catch (error) {
    console.error("[reservations] sendReservationDecisionFlow failed:", error);
  }
}
