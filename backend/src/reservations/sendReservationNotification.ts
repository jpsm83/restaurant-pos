/**
 * sendReservationNotification - Creates a Notification and pushes to Users' inboxes
 */

import { Types } from "mongoose";
import Notification from "../models/notification.ts";
import User from "../models/user.ts";

/**
 * Creates a Notification and pushes it to the given Users' inboxes.
 * Uses Notification.customersRecipientsIds for userIds (same pattern as orderConfirmation).
 */
const sendReservationNotification = async (params: {
  userIds: Types.ObjectId[];
  businessId: Types.ObjectId;
  message: string;
  notificationType?:
    | "Info"
    | "Warning"
    | "Emergency"
    | "Message"
    | "Promotion"
    | "Birthday"
    | "Event";
}): Promise<void> => {
  try {
    if (!params.userIds?.length) return;

    const [newNotification] = await Notification.create([
      {
        notificationType: params.notificationType ?? "Info",
        message: params.message,
        businessId: params.businessId,
        customersRecipientsIds: params.userIds,
      },
    ]);

    if (!newNotification?._id) return;

    await User.updateMany(
      { _id: { $in: params.userIds } },
      {
        $push: {
          notifications: {
            notificationId: newNotification._id,
            readFlag: false,
            deletedFlag: false,
          },
        },
      },
    );
  } catch (error) {
    console.error("[reservations] sendReservationNotification failed:", error);
  }
};

export default sendReservationNotification;
