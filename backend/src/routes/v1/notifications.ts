import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { INotification } from "../../../../lib/interface/INotification.ts";
import type { NotificationType } from "../../communications/types.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import Notification from "../../models/notification.ts";
import Employee from "../../models/employee.ts";
import Business from "../../models/business.ts";
import User from "../../models/user.ts";
import notificationRepository from "../../communications/repositories/notificationRepository.ts";

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  // Boundary note:
  // - This route handles manual/admin notification CRUD operations.
  // - Domain-triggered notifications must go through communications/dispatchEvent.
  // GET /notifications - list all
  app.get("/", async (req, reply) => {
    try {
      const notifications = await Notification.find()
        .populate({
          path: "employeesRecipientsIds",
          select: "userId",
          model: Employee,
          populate: {
            path: "userId",
            select:
              "personalDetails.firstName personalDetails.lastName personalDetails.username",
            model: User,
          },
        })
        .populate({
          path: "customersRecipientsIds",
          select:
            "personalDetails.firstName personalDetails.lastName personalDetails.username",
          model: User,
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
        message:
          "EmployeesRecipientsIds or customersRecipientsIds is required!",
      });
    }

    if (!notificationType || !message || !businessId) {
      return reply.code(400).send({
        message:
          "NotificationType, message, recipientsId and businessId are required!",
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
      const business = await Business.exists({ _id: businessId }).session(
        session,
      );
      const employeesCount = employeesRecipientsIds
        ? await Employee.countDocuments({ _id: { $in: recipientsId } }).session(
            session,
          )
        : 0;
      const customersCount = customersRecipientsIds
        ? await User.countDocuments({ _id: { $in: recipientsId } }).session(
            session,
          )
        : 0;

      if (
        (employeesRecipientsIds && employeesCount !== recipientsId.length) ||
        (customersRecipientsIds && customersCount !== recipientsId.length)
      ) {
        await session.abortTransaction();
        return reply
          .code(400)
          .send({ message: "One or more recipients do not exist!" });
      }

      if (!business) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Business not found!" });
      }

      await notificationRepository.createAndFanout({
        notificationType: notificationType as NotificationType | undefined,
        message,
        businessId,
        senderId: senderId || undefined,
        recipients: employeesRecipientsIds
          ? { employeeIds: employeesRecipientsIds as Types.ObjectId[] }
          : { customerUserIds: customersRecipientsIds as Types.ObjectId[] },
        session,
      });

      await session.commitTransaction();

      return reply.code(201).send({
        message: "Notification message created and sent",
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
          select: "userId",
          model: Employee,
          populate: {
            path: "userId",
            select:
              "personalDetails.firstName personalDetails.lastName personalDetails.username",
            model: User,
          },
        })
        .populate({
          path: "customersRecipientsIds",
          select:
            "personalDetails.firstName personalDetails.lastName personalDetails.username",
          model: User,
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
        message:
          "EmployeesRecipientsIds or customersRecipientsIds is required!",
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

    if (
      !isObjectIdValid([
        ...objectIds,
        notificationId as string,
      ] as Types.ObjectId[])
    ) {
      return reply.code(400).send({
        message: "Invalid array of IDs!",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const RecipientsModel = employeesRecipientsIds ? Employee : User;
      const notificationField = employeesRecipientsIds
        ? "employeesRecipientsIds"
        : "customersRecipientsIds";

      const [notification, validRecipients] = await Promise.all([
        Notification.findById(notificationId)
          .select(`${notificationField} message`)
          .lean()
          .session(session) as Promise<INotification | null>,
        RecipientsModel.find({ _id: { $in: objectIds } }, null, {
          lean: true,
        }).session(session),
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
        (id) => !existingRecipients.toString().includes(id.toString()),
      );

      const removedRecipients = existingRecipients.filter(
        (id: Types.ObjectId) =>
          !recipientsId.toString().includes(id.toString()),
      );

      const unchangedRecipients = recipientsId.filter((id) =>
        existingRecipients.toString().includes(id.toString()),
      );

      const updateNotification: Partial<INotification> = {};

      if (notificationType)
        updateNotification.notificationType = notificationType;
      if (message) updateNotification.message = message;
      if (employeesRecipientsIds)
        updateNotification.employeesRecipientsIds = employeesRecipientsIds;
      if (customersRecipientsIds)
        updateNotification.customersRecipientsIds = customersRecipientsIds;
      if (senderId) updateNotification.senderId = senderId;

      // Inbox state is centralized on User.notifications only.
      let addedRecipientUserIds = addedRecipients;
      let removedRecipientUserIds = removedRecipients;
      let unchangedRecipientUserIds = unchangedRecipients;

      if (employeesRecipientsIds) {
        const allEmployeeIdsToMap = [
          ...addedRecipients,
          ...removedRecipients,
          ...unchangedRecipients,
        ];

        const employeeDocs = await Employee.find({
          _id: { $in: allEmployeeIdsToMap },
        })
          .select("userId")
          .lean()
          .session(session);

        const employeeUserIdByEmployeeId = new Map(
          employeeDocs.map((e) => [String(e._id), e.userId]),
        );

        addedRecipientUserIds = addedRecipients
          .map((id) => employeeUserIdByEmployeeId.get(String(id)))
          .filter(Boolean);
        removedRecipientUserIds = removedRecipients
          .map((id) => employeeUserIdByEmployeeId.get(String(id)))
          .filter(Boolean);
        unchangedRecipientUserIds = unchangedRecipients
          .map((id) => employeeUserIdByEmployeeId.get(String(id)))
          .filter(Boolean);
      }

      const [
        updatedNotification,
        employeeNotificationAdded,
        employeeNotificationRemoved,
        employeeFlagUpdated,
      ] = await Promise.all([
        Notification.updateOne(
          { _id: notificationId },
          { $set: updateNotification },
          { session },
        ),

        addedRecipientUserIds.length > 0
          ? User.updateMany(
              { _id: { $in: addedRecipientUserIds } },
              { $push: { notifications: { notificationId } } },
              { session },
            )
          : Promise.resolve(true),

        removedRecipientUserIds.length > 0
          ? User.updateMany(
              { _id: { $in: removedRecipientUserIds } },
              { $pull: { notifications: { notificationId } } },
              { session },
            )
          : Promise.resolve(true),

        unchangedRecipientUserIds.length > 0 && notification.message !== message
          ? User.updateMany(
              {
                _id: { $in: unchangedRecipientUserIds },
                "notifications.notificationId": notificationId,
              },
              {
                $set: {
                  "notifications.$.readFlag": false,
                  "notifications.$.deletedFlag": false,
                },
              },
              { session },
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
        return reply
          .code(400)
          .send({ message: "Failed to update recipients!" });
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
        },
      )) as INotification | null;

      if (!notificationDeleted) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Notification not found!" });
      }

      const isEmployeeNotification =
        !!notificationDeleted.employeesRecipientsIds;
      const recipientIds =
        notificationDeleted[
          isEmployeeNotification
            ? "employeesRecipientsIds"
            : "customersRecipientsIds"
        ] || [];

      // Inbox state is centralized on User.notifications only.
      let recipientUserIds = recipientIds;
      if (isEmployeeNotification) {
        const employeeDocs = await Employee.find({ _id: { $in: recipientIds } })
          .select("userId")
          .lean()
          .session(session);

        recipientUserIds = employeeDocs.map((e) => e.userId).filter(Boolean);
      }

      const recipientsUpdated =
        recipientUserIds.length > 0
          ? await User.updateMany(
              { _id: { $in: recipientUserIds } },
              { $pull: { notifications: { notificationId } } },
              { session },
            )
          : { modifiedCount: 0 };

      if (
        recipientsUpdated.modifiedCount === 0 &&
        recipientUserIds.length > 0
      ) {
        await session.abortTransaction();
        return reply
          .code(400)
          .send({ message: "Failed to update recipients!" });
      }

      await session.commitTransaction();

      return reply
        .code(200)
        .send({ message: "Notification deleted successfully" });
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
          select: "userId",
          model: Employee,
          populate: {
            path: "userId",
            select:
              "personalDetails.firstName personalDetails.lastName personalDetails.username",
            model: User,
          },
        })
        .populate({
          path: "customersRecipientsIds",
          select:
            "personalDetails.firstName personalDetails.lastName personalDetails.username",
          model: User,
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
      const employeeDocs = await Employee.find({ userId }).select("_id").lean();
      const employeeIds = employeeDocs.map((e) => e._id);

      const notifications = await Notification.find({
        $or: [
          ...(employeeIds.length > 0
            ? [{ employeesRecipientsIds: { $in: employeeIds } }]
            : []),
          { customersRecipientsIds: userId },
        ],
      })
        .populate({
          path: "employeesRecipientsIds",
          select: "userId",
          model: Employee,
          populate: {
            path: "userId",
            select:
              "personalDetails.firstName personalDetails.lastName personalDetails.username",
            model: User,
          },
        })
        .populate({
          path: "customersRecipientsIds",
          select:
            "personalDetails.firstName personalDetails.lastName personalDetails.username",
          model: User,
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
