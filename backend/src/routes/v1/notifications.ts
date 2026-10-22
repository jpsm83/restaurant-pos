/**
 * Notifications Routes - manual/admin notification CRUD and read endpoints.
 *
 * Every route declares its body/params/query as a strict zod DTO from
 * `backend/src/schemas/notifications.ts`; validation and sanitization happen at
 * the boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. The employees/customers recipient
 * exclusivity rule stays as a named post-parse check.
 *
 * Route boundary:
 * - Handles manual/admin notification CRUD and read endpoints only.
 * - Must not orchestrate domain-triggered notification workflows.
 * - Domain-triggered flows must enter via communications/dispatchEvent.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";

import Notification from "../../models/notification.ts";
import Employee from "../../models/employee.ts";
import Business from "../../models/business.ts";
import User from "../../models/user.ts";
import notificationService from "../../communications/services/notificationService.ts";
import { runTxnWithTransientRetry } from "../../mongo/runTxnWithTransientRetry.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import { badRequest, conflict, notFound } from "../../errors/appError.ts";
import {
  createNotificationBodySchema,
  notificationIdParamsSchema,
  notificationsIncludeDeletedQuerySchema,
  notificationsByBusinessParamsSchema,
  notificationsByUserParamsSchema,
  notificationsPaginationQuerySchema,
  updateNotificationBodySchema,
  type CreateNotificationBody,
  type NotificationIdParams,
  type NotificationsByBusinessParams,
  type NotificationsIncludeDeletedQuery,
  type NotificationsByUserParams,
  type NotificationsPaginationQuery,
  type UpdateNotificationBody,
} from "../../schemas/notifications.ts";

const LOG_SCOPE = "communications.notifications.route";
const ROUTE_SOURCE = "manual_notifications_route";

const READ_SELECT =
  "_id notificationType message businessId senderId employeesRecipientsIds customersRecipientsIds createdAt updatedAt";

const toIdKeySet = (ids: Array<Types.ObjectId | string>): Set<string> =>
  new Set(ids.map((id) => String(id)));

/**
 * Post-parse recipient exclusivity: exactly one of `employeesRecipientsIds` or
 * `customersRecipientsIds` must be present and non-empty. Returns which mode is
 * in use and the recipient ids.
 */
const resolveRecipientIds = ({
  employeesRecipientsIds,
  customersRecipientsIds,
}: {
  employeesRecipientsIds?: string[];
  customersRecipientsIds?: string[];
}): { useEmployees: boolean; recipientIds: string[] } => {
  const hasEmployees = Array.isArray(employeesRecipientsIds);
  const hasCustomers = Array.isArray(customersRecipientsIds);

  if (hasEmployees === hasCustomers) {
    throw badRequest(
      "EmployeesRecipientsIds or customersRecipientsIds is required!",
    );
  }

  const recipientIds = (hasEmployees
    ? employeesRecipientsIds
    : customersRecipientsIds) as string[];

  if (recipientIds.length === 0) {
    throw badRequest("Recipients must be an array of IDs!");
  }

  return { useEmployees: hasEmployees, recipientIds };
};

type NotificationUpdate = {
  notificationType?: string;
  message?: string;
  senderId?: Types.ObjectId;
  employeesRecipientsIds?: Types.ObjectId[];
  customersRecipientsIds?: Types.ObjectId[];
};

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  // GET /notifications - list all
  app.get<{ Querystring: NotificationsPaginationQuery }>(
    "/",
    { schema: { querystring: notificationsPaginationQuerySchema } },
    async (req, reply) => {
      const { page, limit, includeRecipients } = req.query;
      const { includeDeleted = false } = req.query;
      const skip = (page - 1) * limit;

      let notificationsQuery = Notification.find(
        withSoftDeleteFilter({}, includeDeleted),
      )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(READ_SELECT);

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
    },
  );

  // POST /notifications - create (transaction)
  app.post<{ Body: CreateNotificationBody }>(
    "/",
    { schema: { body: createNotificationBodySchema } },
    async (req, reply) => {
      const correlationId = req.id;
      const {
        notificationType,
        message,
        businessId,
        senderId,
        employeesRecipientsIds,
        customersRecipientsIds,
      } = req.body;

      const { useEmployees, recipientIds } = resolveRecipientIds({
        employeesRecipientsIds,
        customersRecipientsIds,
      });

      const businessObjectId = new Types.ObjectId(businessId);
      const recipientObjectIds = recipientIds.map((id) => new Types.ObjectId(id));
      const senderObjectId = senderId ? new Types.ObjectId(senderId) : undefined;

      try {
        await runTxnWithTransientRetry(async (session) => {
          const business = await Business.exists({
            _id: businessObjectId,
          }).session(session);
          const recipientsCount = useEmployees
            ? await Employee.countDocuments({
                _id: { $in: recipientObjectIds },
              }).session(session)
            : await User.countDocuments({
                _id: { $in: recipientObjectIds },
              }).session(session);

          if (recipientsCount !== recipientObjectIds.length) {
            throw badRequest("One or more recipients do not exist!");
          }

          if (!business) {
            throw notFound("Business not found!");
          }

          await notificationService.createAndDeliver({
            notificationType,
            message,
            businessId: businessObjectId,
            senderId: senderObjectId,
            recipients: useEmployees
              ? { employeeIds: recipientObjectIds }
              : { customerUserIds: recipientObjectIds },
            correlationId,
            session,
          });

          return { type: "commit" as const, value: undefined };
        });

        app.log.info({
          scope: LOG_SCOPE,
          source: ROUTE_SOURCE,
          action: "create",
          outcome: "success",
          correlationId,
          notificationType,
          businessId: String(businessObjectId),
          recipientCount: recipientObjectIds.length,
          recipientMode: useEmployees ? "employees" : "customers",
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
          businessId: String(businessObjectId),
          recipientCount: recipientObjectIds.length,
          recipientMode: useEmployees ? "employees" : "customers",
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  );

  // GET /notifications/:notificationId - get by ID
  app.get<{
    Params: NotificationIdParams;
    Querystring: NotificationsIncludeDeletedQuery;
  }>(
    "/:notificationId",
    {
      schema: {
        params: notificationIdParamsSchema,
        querystring: notificationsIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { notificationId } = req.params;
      const { includeDeleted = false } = req.query;

      const notification = await Notification.findOne(
        withSoftDeleteFilter({ _id: notificationId }, includeDeleted),
      )
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
        throw notFound("Notification not found");
      }
      return reply.code(200).send(notification);
    },
  );

  // PATCH /notifications/:notificationId - update
  app.patch<{ Params: NotificationIdParams; Body: UpdateNotificationBody }>(
    "/:notificationId",
    {
      schema: {
        params: notificationIdParamsSchema,
        body: updateNotificationBodySchema,
      },
    },
    async (req, reply) => {
      const correlationId = req.id;
      const { notificationId } = req.params;
      const {
        notificationType,
        message,
        senderId,
        employeesRecipientsIds,
        customersRecipientsIds,
      } = req.body;

      const { useEmployees, recipientIds } = resolveRecipientIds({
        employeesRecipientsIds,
        customersRecipientsIds,
      });

      const recipientObjectIds = recipientIds.map((id) => new Types.ObjectId(id));
      const senderObjectId = senderId ? new Types.ObjectId(senderId) : undefined;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const RecipientsModel = useEmployees ? Employee : User;
        const notificationField = useEmployees
          ? "employeesRecipientsIds"
          : "customersRecipientsIds";

        const existingNotification = (await Notification.findOne(
          withSoftDeleteFilter({ _id: notificationId }),
        )
          .select(`${notificationField} message`)
          .lean()
          .session(session)) as {
          message?: string;
          employeesRecipientsIds?: Types.ObjectId[];
          customersRecipientsIds?: Types.ObjectId[];
        } | null;

        const recipientsToValidate = [...recipientObjectIds];
        if (senderObjectId) {
          recipientsToValidate.push(senderObjectId);
        }

        const validRecipients = await RecipientsModel.find(
          { _id: { $in: recipientsToValidate } },
          null,
          {
            lean: true,
          },
        ).session(session);

        if (
          !existingNotification ||
          validRecipients.length !== recipientsToValidate.length
        ) {
          throw badRequest(
            !existingNotification
              ? "Notification not found!"
              : "One or more recipients do not exist!",
          );
        }

        const existingRecipients = (existingNotification[notificationField] ||
          []) as Types.ObjectId[];
        const existingSet = toIdKeySet(existingRecipients);
        const incomingSet = toIdKeySet(recipientObjectIds);

        const addedRecipients = recipientObjectIds.filter(
          (id) => !existingSet.has(String(id)),
        );
        const removedRecipients = existingRecipients.filter(
          (id) => !incomingSet.has(String(id)),
        );
        const unchangedRecipients = recipientObjectIds.filter((id) =>
          existingSet.has(String(id)),
        );

        const updateNotification: NotificationUpdate = {};

        if (notificationType)
          updateNotification.notificationType = notificationType;
        if (message) updateNotification.message = message;
        if (useEmployees)
          updateNotification.employeesRecipientsIds = recipientObjectIds;
        else updateNotification.customersRecipientsIds = recipientObjectIds;
        if (senderObjectId) updateNotification.senderId = senderObjectId;

        // Inbox state is centralized on User.notifications only.
        let addedRecipientUserIds = addedRecipients;
        let removedRecipientUserIds = removedRecipients;
        let unchangedRecipientUserIds = unchangedRecipients;

        if (useEmployees) {
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
                withSoftDeleteFilter({ _id: notificationId }),
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
          existingNotification.message !== message
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
          throw badRequest("Failed to update recipients!");
        }

        await session.commitTransaction();

        app.log.info({
          scope: LOG_SCOPE,
          source: ROUTE_SOURCE,
          action: "update",
          outcome: "success",
          correlationId,
          notificationId,
          recipientCount: recipientObjectIds.length,
          recipientMode: useEmployees ? "employees" : "customers",
          notificationType: notificationType ?? undefined,
        });

        return reply.code(200).send({
          message: "Notification and recipients updated successfully",
        });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        app.log.error({
          scope: LOG_SCOPE,
          source: ROUTE_SOURCE,
          action: "update",
          outcome: "failed",
          correlationId,
          notificationId,
          recipientCount: recipientObjectIds.length,
          recipientMode: useEmployees ? "employees" : "customers",
          notificationType: notificationType ?? undefined,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // DELETE /notifications/:notificationId - delete (transaction)
  app.delete<{ Params: NotificationIdParams }>(
    "/:notificationId",
    { schema: { params: notificationIdParamsSchema } },
    async (req, reply) => {
      const correlationId = req.id;
      const { notificationId } = req.params;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const notification = (await Notification.findById(notificationId)
          .select("employeesRecipientsIds customersRecipientsIds deleted")
          .session(session)
          .lean()) as {
          employeesRecipientsIds?: Types.ObjectId[];
          customersRecipientsIds?: Types.ObjectId[];
          deleted?: boolean;
        } | null;

        if (!notification) {
          throw notFound("Notification not found!");
        }
        if (notification.deleted) {
          throw conflict("Notification already deleted!");
        }

        const wasDeleted = await markAsDeletedById(
          Notification as mongoose.Model<{ deleted: boolean }>,
          notificationId,
        );
        if (!wasDeleted) {
          throw conflict("Notification already deleted!");
        }

        const isEmployeeNotification =
          !!notification.employeesRecipientsIds;
        const recipientIds =
          notification[
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
          throw badRequest("Failed to update recipients!");
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
        await session.abortTransaction().catch(() => undefined);
        app.log.error({
          scope: LOG_SCOPE,
          source: ROUTE_SOURCE,
          action: "delete",
          outcome: "failed",
          correlationId,
          notificationId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // GET /notifications/business/:businessId - get by business
  app.get<{
    Params: NotificationsByBusinessParams;
    Querystring: NotificationsPaginationQuery;
  }>(
    "/business/:businessId",
    {
      schema: {
        params: notificationsByBusinessParamsSchema,
        querystring: notificationsPaginationQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { page, limit, includeRecipients, includeDeleted = false } =
        req.query;
      const skip = (page - 1) * limit;

      let notificationsQuery = Notification.find({
        ...withSoftDeleteFilter(
          { businessId: new Types.ObjectId(businessId) },
          includeDeleted,
        ),
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(READ_SELECT);

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
    },
  );

  // GET /notifications/user/:userId - get by user
  app.get<{
    Params: NotificationsByUserParams;
    Querystring: NotificationsPaginationQuery;
  }>(
    "/user/:userId",
    {
      schema: {
        params: notificationsByUserParamsSchema,
        querystring: notificationsPaginationQuerySchema,
      },
    },
    async (req, reply) => {
      const { userId } = req.params;
      const { page, limit, includeRecipients, includeDeleted = false } =
        req.query;
      const skip = (page - 1) * limit;

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

      let notificationsQuery = Notification.find(
        withSoftDeleteFilter({ _id: { $in: notificationIds } }, includeDeleted),
      )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(READ_SELECT);

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
    },
  );
};
