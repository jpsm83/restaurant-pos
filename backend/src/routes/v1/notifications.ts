import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { INotification } from "@shared/interfaces/INotification";

import { isObjectIdValid } from "../../utils/isObjectIdValid.js";
import Notification from "../../models/notification.js";
import Employee from "../../models/employee.js";
import Business from "../../models/business.js";
import Customer from "../../models/customer.js";

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  // GET /notifications - list all
  app.get("/", async (req, reply) => {
    try {
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

      if (!notifications.length) {
        return reply.code(404).send({ message: "No notifications found" });
      }
      return reply.code(200).send(notifications);
    } catch (error) {
      return reply.code(500).send({
        message: "Get all notifications failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // POST /notifications - create (transaction)
  app.post("/", async (req, reply) => {
    const {
      notificationType,
      message,
      employeesRecipientsIds,
      customersRecipientsIds,
      businessId,
      senderId,
    } = req.body as INotification;

    if (
      (!employeesRecipientsIds && !customersRecipientsIds) ||
      (employeesRecipientsIds && customersRecipientsIds)
    ) {
      return reply.code(400).send({
        message: "EmployeesRecipientsIds or customersRecipientsIds is required!",
      });
    }

    if (!notificationType || !message || !businessId) {
      return reply.code(400).send({
        message: "NotificationType, message, recipientsId and businessId are required!",
      });
    }

    const recipientsId = employeesRecipientsIds || customersRecipientsIds;

    if (!Array.isArray(recipientsId) || recipientsId.length === 0) {
      return reply.code(400).send({
        message: "Recipients must be an array of IDs!",
      });
    }

    const objectIds = [...recipientsId];
    if (senderId) {
      objectIds.push(senderId);
    }

    if (!isObjectIdValid([...objectIds, businessId] as Types.ObjectId[])) {
      return reply.code(400).send({
        message: "Invalid array of IDs!",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const notificationObj = {
        notificationType,
        message,
        employeesRecipientsIds: employeesRecipientsIds || undefined,
        customersRecipientsIds: customersRecipientsIds || undefined,
        senderId: senderId || undefined,
        businessId,
      };

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
        return reply.code(404).send({ message: "Employees or customers not found!" });
      }

      if (!business) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Business not found!" });
      }

      const newNotification = await Notification.create([notificationObj], {
        session,
      });

      if (!newNotification) {
        await session.abortTransaction();
        return reply.code(400).send({ message: "Notification could not be created!" });
      }

      const ModelToUpdate = employees ? Employee : Customer;

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

      if (sendNotifications.modifiedCount === 0) {
        await session.abortTransaction();
        return reply.code(400).send({
          message: `Failed to update ${employees ? "employees" : "customers"} with notification!`,
        });
      }

      await session.commitTransaction();

      return reply.code(201).send({
        message: "Notification message created and sent to employees",
      });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Create notification failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /notifications/:notificationId - get by ID
  app.get("/:notificationId", async (req, reply) => {
    const params = req.params as { notificationId?: string };
    const notificationId = params.notificationId;

    if (!notificationId || !isObjectIdValid([notificationId])) {
      return reply.code(400).send({ message: "Invalid notification ID" });
    }

    try {
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

      if (!notification) {
        return reply.code(404).send({ message: "Notification not found" });
      }
      return reply.code(200).send(notification);
    } catch (error) {
      return reply.code(500).send({
        message: "Get notification by its id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // PATCH /notifications/:notificationId - update
  app.patch("/:notificationId", async (req, reply) => {
    const params = req.params as { notificationId?: string };
    const notificationId = params.notificationId;

    const {
      notificationType,
      message,
      employeesRecipientsIds,
      customersRecipientsIds,
      senderId,
    } = req.body as INotification;

    if (
      (!employeesRecipientsIds && !customersRecipientsIds) ||
      (employeesRecipientsIds && customersRecipientsIds)
    ) {
      return reply.code(400).send({
        message: "EmployeesRecipientsIds or customersRecipientsIds is required!",
      });
    }

    const recipientsId = employeesRecipientsIds || customersRecipientsIds;

    if (!Array.isArray(recipientsId) || recipientsId.length === 0) {
      return reply.code(400).send({
        message: "Recipients must be an array of IDs!",
      });
    }

    const objectIds = [...recipientsId];
    if (senderId) {
      objectIds.push(senderId);
    }

    if (!isObjectIdValid([...objectIds, notificationId as string] as Types.ObjectId[])) {
      return reply.code(400).send({
        message: "Invalid array of IDs!",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const RecipientsModel = employeesRecipientsIds ? Employee : Customer;
      const notificationField = employeesRecipientsIds
        ? "employeesRecipientsIds"
        : "customersRecipientsIds";

      const [notification, validRecipients] = await Promise.all([
        Notification.findById(notificationId)
          .select(`${notificationField} message`)
          .lean()
          .session(session) as Promise<INotification | null>,
        RecipientsModel.find({ _id: { $in: objectIds } }, null, { lean: true }),
      ]);

      if (!notification || validRecipients.length !== objectIds.length) {
        await session.abortTransaction();
        const msg = !notification
          ? "Notification not found!"
          : "One or more recipients do not exist!";
        return reply.code(400).send({ message: msg });
      }

      const existingRecipients = notification[notificationField] || [];

      const addedRecipients = recipientsId.filter(
        (id) => !existingRecipients.toString().includes(id.toString())
      );

      const removedRecipients = existingRecipients.filter(
        (id: Types.ObjectId) => !recipientsId.toString().includes(id.toString())
      );

      const unchangedRecipients = recipientsId.filter((id) =>
        existingRecipients.toString().includes(id.toString())
      );

      const updateNotification: Partial<INotification> = {};

      if (notificationType) updateNotification.notificationType = notificationType;
      if (message) updateNotification.message = message;
      if (employeesRecipientsIds)
        updateNotification.employeesRecipientsIds = employeesRecipientsIds;
      if (customersRecipientsIds)
        updateNotification.customersRecipientsIds = customersRecipientsIds;
      if (senderId) updateNotification.senderId = senderId;

      const [
        updatedNotification,
        employeeNotificationAdded,
        employeeNotificationRemoved,
        employeeFlagUpdated,
      ] = await Promise.all([
        Notification.updateOne(
          { _id: notificationId },
          { $set: updateNotification },
          { session }
        ),

        addedRecipients.length > 0
          ? RecipientsModel.updateMany(
              { _id: { $in: addedRecipients } },
              { $push: { notifications: { notificationId } } },
              { session }
            )
          : Promise.resolve(true),

        removedRecipients.length > 0
          ? RecipientsModel.updateMany(
              { _id: { $in: removedRecipients } },
              { $pull: { notifications: { notificationId } } },
              { session }
            )
          : Promise.resolve(true),

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
          : Promise.resolve(true),
      ]);

      if (
        !updatedNotification ||
        !employeeNotificationAdded ||
        !employeeNotificationRemoved ||
        !employeeFlagUpdated
      ) {
        await session.abortTransaction();
        return reply.code(400).send({ message: "Failed to update recipients!" });
      }

      await session.commitTransaction();

      return reply.code(200).send({
        message: "Notification and recipients updated successfully",
      });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Update notification failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // DELETE /notifications/:notificationId - delete (transaction)
  app.delete("/:notificationId", async (req, reply) => {
    const params = req.params as { notificationId?: string };
    const notificationId = params.notificationId;

    if (!notificationId || !isObjectIdValid([notificationId])) {
      return reply.code(400).send({ message: "Invalid notification ID!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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
        return reply.code(404).send({ message: "Notification not found!" });
      }

      const isEmployeeNotification = !!notificationDeleted.employeesRecipientsIds;
      const RecipientsModel = isEmployeeNotification ? Employee : Customer;
      const recipientIds =
        notificationDeleted[
          isEmployeeNotification
            ? "employeesRecipientsIds"
            : "customersRecipientsIds"
        ] || [];

      const recipientsUpdated =
        recipientIds.length > 0
          ? await RecipientsModel.updateMany(
              { _id: { $in: recipientIds } },
              { $pull: { notifications: { notificationId } } },
              { session }
            )
          : { modifiedCount: 0 };

      if (recipientsUpdated.modifiedCount === 0 && recipientIds.length > 0) {
        await session.abortTransaction();
        return reply.code(400).send({ message: "Failed to update recipients!" });
      }

      await session.commitTransaction();

      return reply.code(200).send({ message: "Notification deleted successfully" });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Delete notification failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /notifications/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || !isObjectIdValid([businessId])) {
      return reply.code(400).send({ message: "Invalid business ID!" });
    }

    try {
      const notifications = await Notification.find({ businessId })
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

      if (!notifications.length) {
        return reply.code(404).send({ message: "No notifications found!" });
      }
      return reply.code(200).send(notifications);
    } catch (error) {
      return reply.code(500).send({
        message: "Get notifications by business id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /notifications/user/:userId - get by user
  app.get("/user/:userId", async (req, reply) => {
    const params = req.params as { userId?: string };
    const userId = params.userId;

    if (!userId || !isObjectIdValid([userId])) {
      return reply.code(400).send({ message: "Invalid user ID!" });
    }

    try {
      const notifications = await Notification.find({
        $or: [
          { employeesRecipientsIds: userId },
          { customersRecipientsIds: userId },
        ],
      })
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

      if (!notifications.length) {
        return reply.code(404).send({ message: "No notifications found!" });
      }
      return reply.code(200).send(notifications);
    } catch (error) {
      return reply.code(500).send({
        message: "Get notifications by user id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};
