/**
 * Notifications Routes — the signed-in User's own inbox.
 *
 * Only the inbox read and its read/hide actions are registered here. The
 * generic manual notification CRUD routes are retired: the internal
 * `notificationService` is the only notification write path, and domain events
 * enter through `communications/dispatchEvent`.
 *
 * Every route declares its params/query as a strict zod DTO from
 * `backend/src/schemas/notifications.ts`; every error is raised as an
 * `AppError` so the global handler emits RFC 9457
 * `application/problem+json`.
 */
import type { FastifyPluginAsync } from "fastify";

import notificationInbox from "../../communications/inbox/notificationInbox.ts";
import { createAuthHook } from "../../auth/middleware.ts";
import { unauthorized } from "../../errors/appError.ts";
import {
  notificationIdParamsSchema,
  notificationInboxQuerySchema,
  type NotificationIdParams,
  type NotificationInboxQuery,
} from "../../schemas/notifications.ts";

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  // GET /notifications/inbox - the signed-in caller's own visible entries
  app.get<{ Querystring: NotificationInboxQuery }>(
    "/inbox",
    {
      preValidation: [createAuthHook(app)],
      schema: { querystring: notificationInboxQuerySchema },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }

      const inbox = await notificationInbox.listInbox({
        userId: req.authSession.id,
        page: req.query.page,
        limit: req.query.limit,
      });

      return reply.code(200).send(inbox);
    },
  );

  // PATCH /notifications/inbox/read-all - mark every visible entry read
  app.patch(
    "/inbox/read-all",
    { preValidation: [createAuthHook(app)] },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }

      const result = await notificationInbox.markAllRead(req.authSession.id);

      return reply.code(200).send(result);
    },
  );

  // PATCH /notifications/inbox/:notificationId/read - mark one entry read
  app.patch<{ Params: NotificationIdParams }>(
    "/inbox/:notificationId/read",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: notificationIdParamsSchema },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }

      const result = await notificationInbox.markRead({
        userId: req.authSession.id,
        notificationId: req.params.notificationId,
      });

      return reply.code(200).send(result);
    },
  );

  // DELETE /notifications/inbox/:notificationId - hide one entry
  app.delete<{ Params: NotificationIdParams }>(
    "/inbox/:notificationId",
    {
      preValidation: [createAuthHook(app)],
      schema: { params: notificationIdParamsSchema },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }

      const result = await notificationInbox.hide({
        userId: req.authSession.id,
        notificationId: req.params.notificationId,
      });

      return reply.code(200).send(result);
    },
  );
};
