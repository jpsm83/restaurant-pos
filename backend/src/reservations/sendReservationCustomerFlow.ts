/**
 * sendReservationCustomerFlow - Reservation notification flows for customers
 *
 * Contains two main flows:
 * - sendReservationPendingFlow: Notifies customer and managers when a reservation is pending
 * - sendReservationDecisionFlow: Notifies customer when a reservation is confirmed/cancelled
 */

import { Types } from "mongoose";
import User from "../models/user.ts";
import { buildReservationMessage } from "./buildReservationMessage.ts";
import { sendReservationEmail } from "./sendReservationEmail.ts";
import { sendReservationNotification } from "./sendReservationNotification.ts";
import { getOnDutyManagersUserIds } from "./getOnDutyManagersUserIds.ts";

export async function sendReservationPendingFlow(params: {
  userId: Types.ObjectId;
  businessId: Types.ObjectId;
  reservationId: Types.ObjectId;
  reservationStart: Date;
  guestCount: number;
  description?: string;
}): Promise<void> {
  try {
    const user = (await User.findById(params.userId)
      .select("personalDetails.email")
      .lean()) as { personalDetails?: { email?: string } } | null;

    const message = buildReservationMessage({
      reservationId: params.reservationId,
      status: "Pending",
      reservationStart: params.reservationStart,
      guestCount: params.guestCount,
      description: params.description,
    });

    const customerEmail = user?.personalDetails?.email;
    if (customerEmail) {
      await sendReservationEmail(customerEmail, message, {
        ref: params.reservationId.toString(),
        subject: `Reservation request received – Ref ${params.reservationId}`,
      });
    }

    await sendReservationNotification({
      userIds: [params.userId],
      businessId: params.businessId,
      message: `${message}\n\nYour reservation is pending approval.`,
      notificationType: "Info",
    });

    const managerUserIds = await getOnDutyManagersUserIds(params.businessId);
    if (managerUserIds.length) {
      await sendReservationNotification({
        userIds: managerUserIds,
        businessId: params.businessId,
        message: `${message}\n\nAction required: approve or reject this reservation.`,
        notificationType: "Info",
      });
    }
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
    const user = (await User.findById(params.userId)
      .select("personalDetails.email")
      .lean()) as { personalDetails?: { email?: string } } | null;

    const message = buildReservationMessage({
      reservationId: params.reservationId,
      status: params.status,
      reservationStart: params.reservationStart,
      guestCount: params.guestCount,
      description: params.description,
    });

    const customerEmail = user?.personalDetails?.email;
    if (customerEmail) {
      await sendReservationEmail(customerEmail, message, {
        ref: params.reservationId.toString(),
        subject: `Reservation ${params.status.toLowerCase()} – Ref ${params.reservationId}`,
      });
    }

    await sendReservationNotification({
      userIds: [params.userId],
      businessId: params.businessId,
      message,
      notificationType: "Info",
    });
  } catch (error) {
    console.error("[reservations] sendReservationDecisionFlow failed:", error);
  }
}
