/**
 * Schedules Routes — schedule reads and employee shift views.
 *
 * The unsafe legacy mutations are retired until the schedules build-order row
 * lands; every route here still requires a live User session at the v1 gate.
 */
import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";

import findActiveEmployeeMembership from "../../auth/employeeMembership.ts";
import Schedule from "../../models/schedule.ts";
import Employee from "../../models/employee.ts";
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import { createAuthHook } from "../../auth/middleware.ts";
import type { AuthUser } from "../../auth/types.ts";
import { forbidden, notFound } from "../../errors/appError.ts";
import {
  dailyScheduleQuerySchema,
  scheduleBusinessParamsSchema,
  scheduleIdParamsSchema,
  schedulesIncludeDeletedQuerySchema,
  scheduleUserParamsSchema,
  type DailyScheduleQuery,
  type ScheduleBusinessParams,
  type ScheduleIdParams,
  type SchedulesIncludeDeletedQuery,
  type ScheduleUserParams,
} from "restaurant-pos-packages/schemas/schedules";

export const schedulesRoutes: FastifyPluginAsync = async (app) => {
  const authHook = createAuthHook(app);

  /**
   * Today's shift rows for the **authenticated** user's linked employee at this business.
   * Must be registered before `GET /:scheduleId` so `business` is not parsed as an id.
   *
   * Query: `dayKey=YYYY-MM-DD` (optional; server-local calendar day when omitted).
   */
  app.get<{ Params: ScheduleBusinessParams; Querystring: DailyScheduleQuery }>(
    "/business/:businessId/daily",
    {
      preValidation: [authHook],
      schema: {
        params: scheduleBusinessParamsSchema,
        querystring: dailyScheduleQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const session = req.authSession;
      if (!session || session.type !== "user") {
        throw forbidden();
      }
      const u = session as AuthUser;
      if (!u.employeeId || u.businessId !== businessId) {
        throw forbidden();
      }

      const { dayKey } = req.query;
      let startOfDay: Date;
      let endOfDay: Date;
      if (dayKey) {
        const [y, m, d] = dayKey.split("-").map(Number);
        startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0);
        endOfDay = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
      } else {
        const effectiveNow = new Date();
        startOfDay = new Date(effectiveNow);
        startOfDay.setHours(0, 0, 0, 0);
        endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
      }

      const schedule = (await Schedule.findOne(
        withSoftDeleteFilter({
          businessId,
          date: { $gte: startOfDay, $lt: endOfDay },
        }),
      )
        .select("employeesSchedules")
        .lean()) as {
        employeesSchedules?: Array<{
          employeeId: unknown;
          vacation?: boolean;
          timeRange: { startTime: Date; endTime: Date };
        }>;
      } | null;

      const employeeIdStr = u.employeeId;
      const rawEntries = schedule?.employeesSchedules ?? [];
      const entries = rawEntries.filter((entry) => {
        const eid =
          typeof entry.employeeId === "object" && entry.employeeId !== null
            ? ((entry.employeeId as { toString?: () => string }).toString?.() ??
              String(entry.employeeId))
            : String(entry.employeeId);
        return eid === employeeIdStr;
      });

      return reply.code(200).send({
        entries: entries.map((e) => ({
          vacation: Boolean(e.vacation),
          startTime: new Date(e.timeRange.startTime).toISOString(),
          endTime: new Date(e.timeRange.endTime).toISOString(),
        })),
      });
    },
  );

  // GET /schedules - list all
  app.get<{ Querystring: SchedulesIncludeDeletedQuery }>(
    "/",
    { schema: { querystring: schedulesIncludeDeletedQuerySchema } },
    async (req, reply) => {
      const { includeDeleted = false } = req.query;
      const schedules = await Schedule.find(
        withSoftDeleteFilter({}, includeDeleted),
      )
        .populate({
          path: "employeesSchedules.employeeId",
          select: "employeeName allEmployeeRoles",
          model: Employee,
        })
        .lean();

      if (!schedules.length) {
        throw notFound("No schedules found!");
      }
      return reply.code(200).send(schedules);
    },
  );

  // GET /schedules/:scheduleId - get by ID
  app.get<{
    Params: ScheduleIdParams;
    Querystring: SchedulesIncludeDeletedQuery;
  }>(
    "/:scheduleId",
    {
      schema: {
        params: scheduleIdParamsSchema,
        querystring: schedulesIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { scheduleId } = req.params;
      const { includeDeleted = false } = req.query;

      const schedule = await Schedule.findOne(
        withSoftDeleteFilter({ _id: scheduleId }, includeDeleted),
      )
        .populate({
          path: "employeesSchedules.employeeId",
          select: "employeeName allEmployeeRoles",
          model: Employee,
        })
        .lean();

      if (!schedule) {
        throw notFound("No schedule found!");
      }
      return reply.code(200).send(schedule);
    },
  );

  // GET /schedules/business/:businessId - get by business
  app.get<{
    Params: ScheduleBusinessParams;
    Querystring: SchedulesIncludeDeletedQuery;
  }>(
    "/business/:businessId",
    {
      schema: {
        params: scheduleBusinessParamsSchema,
        querystring: schedulesIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { includeDeleted = false } = req.query;

      const schedules = await Schedule.find(
        withSoftDeleteFilter(
          { businessId: new Types.ObjectId(businessId) },
          includeDeleted,
        ),
      )
        .populate({
          path: "employeesSchedules.employeeId",
          select: "employeeName allEmployeeRoles",
          model: Employee,
        })
        .lean();

      if (!schedules.length) {
        throw notFound("No schedules found!");
      }
      return reply.code(200).send(schedules);
    },
  );

  // GET /schedules/user/:userId - get by user
  app.get<{
    Params: ScheduleUserParams;
    Querystring: SchedulesIncludeDeletedQuery;
  }>(
    "/user/:userId",
    {
      schema: {
        params: scheduleUserParamsSchema,
        querystring: schedulesIncludeDeletedQuerySchema,
      },
    },
    async (req, reply) => {
      const { userId } = req.params;
      const { includeDeleted = false } = req.query;

      const employee = await findActiveEmployeeMembership({ userId });
      if (!employee) {
        throw notFound("User not found or has no active employee membership!");
      }

      const employeeId = employee._id;

      const schedules = await Schedule.find(
        withSoftDeleteFilter(
          { "employeesSchedules.employeeId": employeeId },
          includeDeleted,
        ),
      )
        .populate({
          path: "employeesSchedules.employeeId",
          select: "employeeName allEmployeeRoles",
          model: Employee,
        })
        .lean();

      if (!schedules.length) {
        throw notFound("No schedules found!");
      }
      return reply.code(200).send(schedules);
    },
  );
};
