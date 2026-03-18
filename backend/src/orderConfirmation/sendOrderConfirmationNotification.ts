import { Types } from "mongoose";
import Notification from "../models/notification.js";
import User from "../models/user.js";

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
