import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { NotificationType } from "../../communications/types.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import Notification from "../../models/notification.ts";
import Employee from "../../models/employee.ts";
import Business from "../../models/business.ts";
import User from "../../models/user.ts";
import notificationService from "../../communications/services/notificationService.ts";
import { runTxnWithTransientRetry } from "../../mongo/runTxnWithTransientRetry.ts";

const LOG_SCOPE = "communications.notifications.route";
const ROUTE_SOURCE = "manual_notifications_route";
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parsePositiveInt = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.floor(value);
    return n > 0 ? n : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const n = Math.floor(parsed);
    return n > 0 ? n : null;
  }
  return null;
};

const parsePagination = (query: Record<string, unknown>) => {
  const page = parsePositiveInt(query.page) ?? DEFAULT_PAGE;
  const requestedLimit = parsePositiveInt(query.limit) ?? DEFAULT_LIMIT;
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const shouldIncludeRecipients = (query: Record<string, unknown>): boolean => {
  const raw = query.includeRecipients;
  if (typeof raw !== "string") return false;
  return raw.toLowerCase() === "true";
};

const toIdKeySet = (ids: Array<Types.ObjectId | string>): Set<string> =>
  new Set(ids.map((id) => String(id)));

type NotificationCreateBody = {
  notificationType: string;
  message: string;
  businessId: Types.ObjectId;
  senderId?: Types.ObjectId;
  employeesRecipientsIds?: Types.ObjectId[];
  customersRecipientsIds?: Types.ObjectId[];
};

type NotificationUpdateBody = {
  notificationType?: string;
  message?: string;
  senderId?: Types.ObjectId;
  employeesRecipientsIds?: Types.ObjectId[];
  customersRecipientsIds?: Types.ObjectId[];
};

const paginationQuerystringSchema = {
  type: "object",
  properties: {
    page: { type: "integer", minimum: 1 },
    limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
    includeRecipients: { type: "string", enum: ["true", "false"] },
  },
  additionalProperties: false,
} as const;

const notificationIdParamsSchema = {
  type: "object",
  required: ["notificationId"],
  properties: {
    notificationId: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const;

const businessIdParamsSchema = {
  type: "object",
  required: ["businessId"],
  properties: {
    businessId: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const;

const userIdParamsSchema = {
  type: "object",
  required: ["userId"],
  properties: {
    userId: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const;

const createNotificationBodySchema = {
  type: "object",
  required: ["notificationType", "message", "businessId"],
  properties: {
    notificationType: { type: "string", minLength: 1 },
    message: { type: "string", minLength: 1 },
    businessId: { type: "string", minLength: 1 },
    senderId: { type: "string" },
    employeesRecipientsIds: { type: "array", items: { type: "string" } },
    customersRecipientsIds: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
} as const;

const patchNotificationBodySchema = {
  type: "object",
  properties: {
    notificationType: { type: "string", minLength: 1 },
    message: { type: "string", minLength: 1 },
    senderId: { type: "string" },
    employeesRecipientsIds: { type: "array", items: { type: "string" } },
    customersRecipientsIds: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
} as const;

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  // Route boundary:
  // - Handles manual/admin notification CRUD and read endpoints only.
  // - Must not orchestrate domain-triggered notification workflows.
  // - Domain-triggered flows must enter via communications/dispatchEvent.
  // GET /notifications - list all
  app.get("/", { schema: { querystring: paginationQuerystringSchema } }, async (req, reply) => {
    try {
      const query = (req.query ?? {}) as Record<string, unknown>;
      const { limit, skip } = parsePagination(query);
      const includeRecipients = shouldIncludeRecipients(query);

      let notificationsQuery = Notification.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id notificationType message businessId senderId employeesRecipientsIds customersRecipientsIds createdAt updatedAt"
        );

      if (includeRecipients) {
        notificationsQuery = notificationsQuery
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
          });
      }

      const notifications = await notificationsQuery.lean();

      return reply.code(200).send(notifications);
    } catch (error) {
      return reply.code(500).send({
        message: "Get all notifications failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // POST /notifications - create (transaction)
  app.post("/", { schema: { body: createNotificationBodySchema } }, async (req, reply) => {
    const correlationId = req.id;
    const {
      notificationType,
      message,
      employeesRecipientsIds,
      customersRecipientsIds,
      businessId,
      senderId,
    } = req.body as NotificationCreateBody;

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

    const recipientIds = employeesRecipientsIds || customersRecipientsIds;

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return reply.code(400).send({
        message: "Recipients must be an array of IDs!",
      });
    }

    const objectIds = [...recipientIds];
    if (senderId) {
      objectIds.push(senderId);
    }

    if (!isObjectIdValid([...objectIds, businessId] as Types.ObjectId[])) {
      return reply.code(400).send({
        message: "Invalid array of IDs!",
      });
    }

    try {
      const txnOut = await runTxnWithTransientRetry(async (session) => {
        const business = await Business.exists({ _id: businessId }).session(
          session,
        );
        const employeesCount = employeesRecipientsIds
          ? await Employee.countDocuments({
              _id: { $in: recipientIds },
            }).session(session)
          : 0;
        const customersCount = customersRecipientsIds
          ? await User.countDocuments({ _id: { $in: recipientIds } }).session(
              session,
            )
          : 0;

        if (
          (employeesRecipientsIds && employeesCount !== recipientIds.length) ||
          (customersRecipientsIds && customersCount !== recipientIds.length)
        ) {
          return {
            type: "http" as const,
            status: 400,
            body: { message: "One or more recipients do not exist!" },
          };
        }

        if (!business) {
          return {
            type: "http" as const,
            status: 404,
            body: { message: "Business not found!" },
          };
        }

        await notificationService.createAndDeliver({
          notificationType: notificationType as NotificationType | undefined,
          message,
          businessId,
          senderId: senderId || undefined,
          recipients: employeesRecipientsIds
            ? { employeeIds: employeesRecipientsIds as Types.ObjectId[] }
            : { customerUserIds: customersRecipientsIds as Types.ObjectId[] },
          correlationId,
          session,
        });

        return { type: "commit" as const, value: undefined };
      });

      if (txnOut.type === "http") {
        return reply.code(txnOut.status).send(txnOut.body);
      }

      app.log.info({
        scope: LOG_SCOPE,
        source: ROUTE_SOURCE,
        action: "create",
        outcome: "success",
        correlationId,
        notificationType,
        businessId: String(businessId),
        recipientCount: recipientIds.length,
        recipientMode: employeesRecipientsIds ? "employees" : "customers",
      });

      return reply.code(201).send({
        message: "Notification message created and sent",
      });
    } catch (error) {
      app.log.error({
        scope: LOG_SCOPE,
        source: ROUTE_SOURCE,
        action: "create",
        outcome: "failed",
        correlationId,
        notificationType,
        businessId: String(businessId),
        recipientCount: recipientIds.length,
        recipientMode: employeesRecipientsIds ? "employees" : "customers",
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.code(500).send({
        message: "Create notification failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /notifications/:notificationId - get by ID
  app.get("/:notificationId", { schema: { params: notificationIdParamsSchema } }, async (req, reply) => {
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
  app.patch(
    "/:notificationId",
    { schema: { params: notificationIdParamsSchema, body: patchNotificationBodySchema } },
    async (req, reply) => {
    const correlationId = req.id;
    const params = req.params as { notificationId?: string };
    const notificationId = params.notificationId;

    const {
      notificationType,
      message,
      employeesRecipientsIds,
      customersRecipientsIds,
      senderId,
    } = req.body as NotificationUpdateBody;

    if (
      (!employeesRecipientsIds && !customersRecipientsIds) ||
      (employeesRecipientsIds && customersRecipientsIds)
    ) {
      return reply.code(400).send({
        message:
          "EmployeesRecipientsIds or customersRecipientsIds is required!",
      });
    }

    const recipientIds = employeesRecipientsIds || customersRecipientsIds;

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return reply.code(400).send({
        message: "Recipients must be an array of IDs!",
      });
    }

    const objectIds = [...recipientIds];
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

      const notification = (await Notification.findById(notificationId)
        .select(`${notificationField} message`)
        .lean()
        .session(session)) as {
        message?: string;
        employeesRecipientsIds?: Types.ObjectId[];
        customersRecipientsIds?: Types.ObjectId[];
      } | null;

      const validRecipients = await RecipientsModel.find(
        { _id: { $in: objectIds } },
        null,
        {
          lean: true,
        },
      ).session(session);

      if (!notification || validRecipients.length !== objectIds.length) {
        await session.abortTransaction();
        const msg = !notification
          ? "Notification not found!"
          : "One or more recipients do not exist!";
        return reply.code(400).send({ message: msg });
      }

      const existingRecipients = (notification[notificationField] ||
        []) as Types.ObjectId[];
      const existingSet = toIdKeySet(existingRecipients);
      const incomingSet = toIdKeySet(recipientIds as Array<Types.ObjectId | string>);

      const addedRecipients = (recipientIds as Types.ObjectId[]).filter(
        (id) => !existingSet.has(String(id)),
      );
      const removedRecipients = existingRecipients.filter(
        (id) => !incomingSet.has(String(id)),
      );
      const unchangedRecipients = (recipientIds as Types.ObjectId[]).filter((id) =>
        existingSet.has(String(id)),
      );

      const updateNotification: Partial<NotificationUpdateBody> = {};

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

      const updatedNotification =
        Object.keys(updateNotification).length > 0
          ? await Notification.updateOne(
              { _id: notificationId },
              { $set: updateNotification },
              { session },
            )
          : { acknowledged: true };

      const employeeNotificationAdded =
        addedRecipientUserIds.length > 0
          ? await User.updateMany(
              { _id: { $in: addedRecipientUserIds } },
              { $push: { notifications: { notificationId } } },
              { session },
            )
          : true;

      const employeeNotificationRemoved =
        removedRecipientUserIds.length > 0
          ? await User.updateMany(
              { _id: { $in: removedRecipientUserIds } },
              { $pull: { notifications: { notificationId } } },
              { session },
            )
          : true;

      const employeeFlagUpdated =
        unchangedRecipientUserIds.length > 0 &&
        typeof message === "string" &&
        notification.message !== message
          ? await User.updateMany(
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
          : true;

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

      app.log.info({
        scope: LOG_SCOPE,
        source: ROUTE_SOURCE,
        action: "update",
        outcome: "success",
        correlationId,
        notificationId,
        recipientCount: recipientIds.length,
        recipientMode: employeesRecipientsIds ? "employees" : "customers",
        notificationType: notificationType ?? undefined,
      });

      return reply.code(200).send({
        message: "Notification and recipients updated successfully",
      });
    } catch (error) {
      await session.abortTransaction();
      app.log.error({
        scope: LOG_SCOPE,
        source: ROUTE_SOURCE,
        action: "update",
        outcome: "failed",
        correlationId,
        notificationId,
        recipientCount: recipientIds.length,
        recipientMode: employeesRecipientsIds ? "employees" : "customers",
        notificationType: notificationType ?? undefined,
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.code(500).send({
        message: "Update notification failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
    },
  );

  // DELETE /notifications/:notificationId - delete (transaction)
  app.delete("/:notificationId", { schema: { params: notificationIdParamsSchema } }, async (req, reply) => {
    const correlationId = req.id;
    const params = req.params as { notificationId?: string };
    const notificationId = params.notificationId;

    if (!notificationId || !isObjectIdValid([notificationId])) {
      return reply.code(400).send({ message: "Invalid notification ID" });
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
      )) as {
        employeesRecipientsIds?: Types.ObjectId[];
        customersRecipientsIds?: Types.ObjectId[];
      } | null;

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

      app.log.info({
        scope: LOG_SCOPE,
        source: ROUTE_SOURCE,
        action: "delete",
        outcome: "success",
        correlationId,
        notificationId,
        recipientCount: recipientUserIds.length,
      });

      return reply
        .code(200)
        .send({ message: "Notification deleted successfully" });
    } catch (error) {
      await session.abortTransaction();
      app.log.error({
        scope: LOG_SCOPE,
        source: ROUTE_SOURCE,
        action: "delete",
        outcome: "failed",
        correlationId,
        notificationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return reply.code(500).send({
        message: "Delete notification failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /notifications/business/:businessId - get by business
  app.get(
    "/business/:businessId",
    { schema: { params: businessIdParamsSchema, querystring: paginationQuerystringSchema } },
    async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || !isObjectIdValid([businessId])) {
      return reply.code(400).send({ message: "Invalid business ID" });
    }

    try {
      const query = (req.query ?? {}) as Record<string, unknown>;
      const { limit, skip } = parsePagination(query);
      const includeRecipients = shouldIncludeRecipients(query);

      let notificationsQuery = Notification.find({ businessId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id notificationType message businessId senderId employeesRecipientsIds customersRecipientsIds createdAt updatedAt"
        );

      if (includeRecipients) {
        notificationsQuery = notificationsQuery
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
          });
      }

      const notifications = await notificationsQuery.lean();

      return reply.code(200).send(notifications);
    } catch (error) {
      return reply.code(500).send({
        message: "Get notifications by business id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
    },
  );

  // GET /notifications/user/:userId - get by user
  app.get(
    "/user/:userId",
    { schema: { params: userIdParamsSchema, querystring: paginationQuerystringSchema } },
    async (req, reply) => {
    const params = req.params as { userId?: string };
    const userId = params.userId;

    if (!userId || !isObjectIdValid([userId])) {
      return reply.code(400).send({ message: "Invalid user ID" });
    }

    try {
      const query = (req.query ?? {}) as Record<string, unknown>;
      const { limit, skip } = parsePagination(query);
      const includeRecipients = shouldIncludeRecipients(query);

      const user = await User.findById(userId)
        .select("notifications.notificationId")
        .lean();
      const notificationIds =
        user?.notifications
          ?.map((n: { notificationId?: Types.ObjectId }) => n.notificationId)
          .filter(Boolean) ?? [];

      if (notificationIds.length === 0) {
        return reply.code(200).send([]);
      }

      let notificationsQuery = Notification.find({ _id: { $in: notificationIds } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id notificationType message businessId senderId employeesRecipientsIds customersRecipientsIds createdAt updatedAt"
        );

      if (includeRecipients) {
        notificationsQuery = notificationsQuery
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
          });
      }

      const notifications = await notificationsQuery.lean();

      return reply.code(200).send(notifications);
    } catch (error) {
      return reply.code(500).send({
        message: "Get notifications by user id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
    },
  );
};
