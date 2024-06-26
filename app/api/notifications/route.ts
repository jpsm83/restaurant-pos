import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

import { INotification } from "@/app/lib/interface/INotification";

// imported models
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import { handleApiError } from "@/app/utils/handleApiError";
import { removeUserFromNotification } from "./utils/removeUserFromNotification";

// @desc    Get all notifications
// @route   GET /notifications
// @access  Public
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const notifications = await Notification.find()
      .populate("recipients", "username")
      .lean();

    return !notifications.length
      ? new NextResponse("No notifications found", { status: 404 })
      : new NextResponse(JSON.stringify(notifications), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error: any) {
    return handleApiError("Get all notifications failed!", error);
  }
};

// @desc    Create a new notification
// @route   POST /notifications
// @access  Private
export const POST = async (req: Request) => {
  try {
    // recipients have to be an array of user IDs coming from the front end
    const {
      dayReferenceNumber,
      notificationType,
      message,
      recipients,
      business,
      sender,
    } = (await req.json()) as INotification;

    // check required fields
    if (
      !dayReferenceNumber ||
      !notificationType ||
      !message ||
      !recipients ||
      !business
    ) {
      return new NextResponse(
        "DayReferenceNumber, notificationType, message, recipients and business are required!",
        { status: 400 }
      );
    }

    // validate recipients
    if (!Array.isArray(recipients)) {
      return new NextResponse(
        "Recipients must be an array of user IDs or empty!",
        {
          status: 400,
        }
      );
    }

    // create new notification object
    const notificationObj = {
      dayReferenceNumber,
      notificationType,
      message,
      recipients: recipients,
      business,
      sender: sender || undefined,
    };

    // connect before first call to DB
    await connectDB();

    // save new notification
    const newNotification = await Notification.create(notificationObj);

    if (newNotification) {
      // add the notification to the recipients users
      const sendNotifications = await User.updateMany(
        { _id: { $in: recipients } },
        {
          $push: {
            notifications: {
              notification: newNotification._id,
              readFlag: false,
            },
          },
        }
      );

      // check if the notification was added to the users
      if (!sendNotifications) {
        return new NextResponse(
          "Notification could not be add on user but has been created!",
          { status: 400 }
        );
      }
      return new NextResponse(
        `Notification message created and sent to users`,
        {
          status: 201,
        }
      );
    } else {
      return new NextResponse("Notification could not be created!", {
        status: 400,
      });
    }
  } catch (error) {
    return handleApiError("Create notification failed!", error);
  }
};

// export const POST = async (req: Request) => {
//   try {
//     const userId = "66741dbbdf254a9fd7e3af59";
//     const notificationId = "6675475e3bfefbb6373c7158";

//     // @ts-ignore
//     const result = await removeUserFromNotification(userId, notificationId);

//     return new NextResponse(JSON.stringify(result), {
//       status: 200,
//     });
//   } catch (error) {
//     return handleApiError("Helper user function failed!", error);
//   }
// };
