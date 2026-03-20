import { Types } from "mongoose";
import Notification from "../models/notification.ts";
import User from "../models/user.ts";

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
