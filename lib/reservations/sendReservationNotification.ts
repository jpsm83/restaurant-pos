import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import Notification from "@/lib/db/models/notification";
import User from "@/lib/db/models/user";

/**
 * Creates a Notification and pushes it to the given Users' inboxes.
 * Uses Notification.customersRecipientsIds for userIds (same pattern as orderConfirmation).
 */
export async function sendReservationNotification(params: {
  userIds: Types.ObjectId[];
  businessId: Types.ObjectId;
  message: string;
  notificationType?: "Info" | "Warning" | "Emergency" | "Message" | "Promotion" | "Birthday" | "Event";
}): Promise<void> {
  try {
    if (!params.userIds?.length) return;
    await connectDb();

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
      }
    );
  } catch (error) {
    console.error("[reservations] sendReservationNotification failed:", error);
  }
}

