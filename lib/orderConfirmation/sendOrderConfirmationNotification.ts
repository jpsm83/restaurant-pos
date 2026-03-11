import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import Notification from "@/lib/db/models/notification";
import User from "@/lib/db/models/user";

/**
 * Creates an order confirmation Notification and pushes it to the User's inbox.
 * Used after self-order or delivery payment. Fire-and-forget safe: does not throw.
 * We push to User (not Customer) because the customer identity for self-order is User.
 */
export async function sendOrderConfirmationNotification(
  userId: Types.ObjectId,
  businessId: Types.ObjectId,
  message: string
): Promise<void> {
  try {
    await connectDb();

    const [newNotification] = await Notification.create([
      {
        notificationType: "Info",
        message,
        businessId,
        customersRecipientsIds: [userId],
      },
    ]);

    if (newNotification?._id) {
      await User.updateOne(
        { _id: userId },
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
    }
  } catch (error) {
    console.error(
      "[orderConfirmation] sendOrderConfirmationNotification failed:",
      error
    );
  }
}
