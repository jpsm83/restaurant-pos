import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { INotification } from "@/app/lib/interface/INotification";

// imported models
import Notification from "@/app/lib/models/notification";
import Employee from "@/app/lib/models/employee";
import Customer from "@/app/lib/models/customer";

// @desc    Get notification by ID
// @route   GET /notifications/:notificationId
// @access  Public
export const GET = async (
  req: Request,
  context: { params: { notificationId: Types.ObjectId } }
) => {
  const notificationId = context.params.notificationId;

  // check if the notificationId is valid
  if (!isObjectIdValid([notificationId])) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid notification ID" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // connect before first call to DB
    await connectDb();

    const notification = await Notification.findById(notificationId)
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

    return !notification
      ? new NextResponse(
          JSON.stringify({ message: "Notification not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(notification), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get notification by its id failed!", error);
  }
};

// @desc    Update a notification
// @route   PATCH /notifications/:notificationId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { notificationId: Types.ObjectId } }
) => {
  const notificationId = context.params.notificationId;

  const {
    notificationType,
    message,
    employeesRecipientsIds,
    customersRecipientsIds,
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

  if (!isObjectIdValid([...objectIds, notificationId])) {
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
    const RecipientsModel = employeesRecipientsIds ? Employee : Customer;
    const notificationField = employeesRecipientsIds
      ? "employeesRecipientsIds"
      : "customersRecipientsIds";

    // check all employees exist and get notification object
    const [notification, validRecipients] = await Promise.all([
      Notification.findById(notificationId)
        .select(`${notificationField} message`)
        .lean()
        .session(session) as Promise<INotification | null>,
      RecipientsModel.find({ _id: { $in: objectIds } }, null, { lean: true }),
    ]);

    if (!notification || validRecipients.length !== objectIds.length) {
      await session.abortTransaction();
      const message = !notification
        ? "Notification not found!"
        : "One or more recipients do not exist!";
      return new NextResponse(JSON.stringify({ message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find the recipientsId that were added
    const addedRecipients = recipientsId.filter(
      (id) =>
        !notification[notificationField].toString().includes(id.toString())
    );

    // Find the recipientsId that were removed
    const removedRecipients = notification[notificationField].filter(
      (id: Types.ObjectId) => !recipientsId.toString().includes(id.toString())
    );

    // Find the recipientsId that were not changed
    const unchangedRecipients = recipientsId.filter((id) =>
      notification[notificationField].toString().includes(id.toString())
    );

    // prepare the update object
    const updateNotification: Partial<INotification> = {};

    if (notificationType)
      updateNotification.notificationType = notificationType;
    if (message) updateNotification.message = message;
    if (employeesRecipientsIds)
      updateNotification.employeesRecipientsIds = employeesRecipientsIds;
    if (customersRecipientsIds)
      updateNotification.customersRecipientsIds = customersRecipientsIds;
    if (senderId) updateNotification.senderId = senderId;

    // handle all the employee updates at once
    const [
      updatedNotification,
      employeeNotficationAdded,
      employeeNotificationRemoved,
      employeeFlagUpdated,
    ] = await Promise.all([
      // update notification
      Notification.updateOne(
        { _id: notificationId },
        { $set: updateNotification },
        {
          session,
        }
      ),

      // Add notification to new RecipientsModel notifications array
      addedRecipients.length > 0
        ? RecipientsModel.updateMany(
            { _id: { $in: addedRecipients } },
            { $push: { notifications: { notificationId } } },
            { session }
          )
        : Promise.resolve(true), // Resolve with a success flag if no RecipientsModel added

      // Remove notification from old RecipientsModel notifications array
      removedRecipients.length > 0
        ? RecipientsModel.updateMany(
            { _id: { $in: removedRecipients } },
            { $pull: { notifications: { notificationId } } },
            { session }
          )
        : Promise.resolve(true), // Resolve with a success flag if no RecipientsModel added

      // update the readFlag for each unchangedRecipients
      unchangedRecipients.length > 0 && notification.message !== message
        ? RecipientsModel.updateMany(
            {
              _id: { $in: unchangedRecipients },
              "notifications.notificationId": notificationId,
            },
            {
              $set: {
                "notifications.$.readFlag": false,
                "notifications.$.deletedFlag": false,
              },
            },
            { session }
          )
        : Promise.resolve(true), // Resolve with a success flag if no recipients added
    ]);

    if (
      !updatedNotification ||
      !employeeNotficationAdded ||
      !employeeNotificationRemoved ||
      !employeeFlagUpdated
    ) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Failed to update recipients!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: "Notification and recipients updated successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Update notification failed!", error);
  } finally {
    session.endSession();
  }
};

// @desc    Delete a notification
// @route   DELETE /notifications/:notificationId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { notificationId: Types.ObjectId } }
) => {
  const notificationId = context.params.notificationId;

  // check if the notificationId is valid
  if (!isObjectIdValid([notificationId])) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid notification ID!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // connect before first call to DB
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Delete the notification and retrieve the affected employees in one step
    const notificationDeleted = (await Notification.findByIdAndDelete(
      notificationId,
      {
        session,
        select: "employeesRecipientsIds customersRecipientsIds",
        lean: true,
      }
    )) as INotification | null;

    if (!notificationDeleted) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Notification not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const isEmployeeNotification = !!notificationDeleted.employeesRecipientsIds;
    const RecipientsModel = isEmployeeNotification ? Employee : Customer;
    const recipientIds =
      notificationDeleted[
        isEmployeeNotification
          ? "employeesRecipientsIds"
          : "customersRecipientsIds"
      ];

    // Remove notification from recipients' notifications arrays
    const recipientsUpdated =
      recipientIds.length > 0
        ? await RecipientsModel.updateMany(
            { _id: { $in: recipientIds } },
            { $pull: { notifications: { notificationId } } },
            { session }
          )
        : { modifiedCount: 0 };

    // Check if recipients update was successful
    if (recipientsUpdated.modifiedCount === 0 && recipientIds.length > 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Failed to update recipients!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Commit transaction if all steps were successful
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({ message: "Notification deleted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Delete notification failed!", error);
  } finally {
    session.endSession();
  }
};
