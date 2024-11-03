import { NextResponse } from "next/server";
import mongoose from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { INotification } from "@/app/lib/interface/INotification";

// imported models
import Notification from "@/app/lib/models/notification";
import Employee from "@/app/lib/models/employee";
import Business from "@/app/lib/models/business";
import Customer from "@/app/lib/models/customer";

// @desc    Get all notifications
// @route   GET /notifications
// @access  Public
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const notifications = await Notification.find()
      .populate({
        path: "employeesRecipientsIds",
        select: "employeeName",
        model: Employee,
      })
      .populate({
        path: "customersRecipientsIds",
        select: "customerName",
        model: Customer,
      })
      .lean();

    return !notifications.length
      ? new NextResponse(
          JSON.stringify({ message: "No notifications found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(notifications), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all notifications failed!", error);
  }
};

// @desc    Create a new notification
// @route   POST /notifications
// @access  Private
export const POST = async (req: Request) => {
  // employeesRecipientsIds or customersRecipientsIds have to be an array of IDs coming from the front end
  const {
    notificationType,
    message,
    employeesRecipientsIds,
    customersRecipientsIds,
    businessId,
    senderId,
  } = (await req.json()) as INotification;

  // check if employeesRecipientsIds or customersRecipientsIds exist
  if (
    (!employeesRecipientsIds && !customersRecipientsIds) ||
    (employeesRecipientsIds && customersRecipientsIds)
  ) {
    return new NextResponse(
      JSON.stringify({
        message:
          "EmployeesRecipientsIds or customersRecipientsIds is required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // check required fields
  if (!notificationType || !message || !businessId) {
    return new NextResponse(
      JSON.stringify({
        message:
          "NotificationType, message, recipientsId and businessId are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const recipientsId = employeesRecipientsIds || customersRecipientsIds;

  // validate recipientsId
  if (!Array.isArray(recipientsId) || recipientsId.length === 0) {
    return new NextResponse(
      JSON.stringify({
        message: "Recipients must be an array of IDs!",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // validation ids
  const objectIds = [...recipientsId];
  if (senderId) {
    objectIds.push(senderId);
  }

  if (!isObjectIdValid([...objectIds, businessId])) {
    return new NextResponse(
      JSON.stringify({
        message: "Invalid array of IDs!",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // connect before first call to DB
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // create new notification object
    const notificationObj = {
      notificationType,
      message,
      employeesRecipientsIds: employeesRecipientsIds || undefined,
      customersRecipientsIds: customersRecipientsIds || undefined,
      senderId: senderId || undefined,
      businessId,
    };

    // check if the business and employees exist
    const [business, employees, customers] = await Promise.all([
      Business.exists({ _id: businessId }),
      employeesRecipientsIds
        ? Employee.exists({ _id: { $in: recipientsId } })
        : null,
      customersRecipientsIds
        ? Customer.exists({ _id: { $in: recipientsId } })
        : null,
    ]);

    if (!employees && !customers) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Employees or customers not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!business) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Business not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // save new notification
    const newNotification = await Notification.create([notificationObj], {
      session,
    });

    if (!newNotification) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Notification could not be created!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Determine the model to update based on the recipients
    const ModelToUpdate = employees ? Employee : Customer;

    // add the notification to the recipientsId
    const sendNotifications = await ModelToUpdate.updateMany(
      { _id: { $in: recipientsId } },
      {
        $push: {
          notifications: {
            notificationId: newNotification[0]._id,
          },
        },
      },
      { session }
    );

    // check if the notification was added to the recipients
    if (sendNotifications.modifiedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: `Failed to update ${
            employees ? "employees" : "customers"
          } with notification!`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: `Notification message created and sent to employees`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Create notification failed!", error);
  } finally {
    session.endSession();
  }
};
