/**
 * Schedules Routes - Schedule CRUD and employee-shift management.
 *
 * Every route declares its body/params/query as a strict zod DTO from
 * `packages/schemas/schedules.ts`; validation and sanitization happen at the
 * boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. Cross-field and database-dependent
 * rules stay as named post-parse checks: `employeesValidation` and the
 * `isScheduleOverlapping` overlap rule.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type {
  ISchedule,
  IEmployeeSchedule,
} from "restaurant-pos-packages/interfaces/ISchedule";
import type {
  IEmployee,
  ISalary,
} from "restaurant-pos-packages/interfaces/IEmployee";

import findActiveEmployeeMembership from "../../auth/employeeMembership.ts";
import getWeekNumber from "../../schedules/getWeekNumber.ts";
import employeesValidation from "../../schedules/employeesValidation.ts";
import isScheduleOverlapping from "../../schedules/isScheduleOverlapping.ts";
import getWeekdaysInMonth from "../../schedules/getWeekdaysInMonth.ts";
import calculateEmployeeCost from "../../schedules/calculateEmployeeCost.ts";
import Schedule from "../../models/schedule.ts";
import Employee from "../../models/employee.ts";
import { markAsDeletedById, withSoftDeleteFilter } from "../../models/softDelete.ts";
import { createAuthHook, createOptionalAuthHook } from "../../auth/middleware.ts";
import type { AuthUser } from "../../auth/types.ts";
import {
  badRequest,
  conflict,
  forbidden,
  internal,
  notFound,
} from "../../errors/appError.ts";
import {
  addEmployeeBodySchema,
  createScheduleBodySchema,
  dailyScheduleQuerySchema,
  deleteEmployeeBodySchema,
  scheduleBusinessParamsSchema,
  scheduleIdParamsSchema,
  schedulesIncludeDeletedQuerySchema,
  scheduleUserParamsSchema,
  updateEmployeeBodySchema,
  updateScheduleBodySchema,
  type AddEmployeeBody,
  type CreateScheduleBody,
  type DailyScheduleQuery,
  type DeleteEmployeeBody,
  type ScheduleBusinessParams,
  type ScheduleIdParams,
  type SchedulesIncludeDeletedQuery,
  type ScheduleUserParams,
  type UpdateEmployeeBody,
  type UpdateScheduleBody,
} from "restaurant-pos-packages/schemas/schedules";

/** A shift time range used by the overlap post-parse check. */
interface ShiftTimeRange {
  startTime: Date;
  endTime: Date;
}

/**
 * Cross-field post-parse check: the proposed shift must not overlap any of the
 * employee's existing shifts for the same day.
 */
const assertNoScheduleOverlap = (
  newStartTime: Date,
  newEndTime: Date,
  existingTimeRanges: ShiftTimeRange[],
): void => {
  if (existingTimeRanges.length === 0) return;
  if (isScheduleOverlapping(newStartTime, newEndTime, existingTimeRanges)) {
    throw badRequest("Employee scheduled overlaps existing one!");
  }
};

/** A shift's duration in milliseconds. */
const getShiftDurationMs = (startTime: Date, endTime: Date): number =>
  endTime.getTime() - startTime.getTime();

/**
 * The employee cost for a shift, from the salary's pay frequency and the
 * weekdays in the current month. Zero when the employee has no salary on file.
 */
const calculateShiftEmployeeCost = (
  salary: ISalary | undefined,
  durationMs: number,
): number => {
  if (!salary) return 0;
  const weekdaysInMonth = getWeekdaysInMonth(
    new Date().getFullYear(),
    new Date().getMonth(),
  );
  return calculateEmployeeCost(salary, durationMs, weekdaysInMonth);
};

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

  // POST /schedules - create
  app.post<{ Body: CreateScheduleBody }>(
    "/",
    { schema: { body: createScheduleBodySchema } },
    async (req, reply) => {
      const { date, businessId, comments } = req.body;

      const weekNumber = getWeekNumber(new Date(date));

      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();

      const duplicateSchedule = await Schedule.exists(withSoftDeleteFilter({
        businessId,
        $expr: {
          $and: [
            { $eq: [{ $year: "$date" }, year] },
            { $eq: [{ $month: "$date" }, month] },
            { $eq: [{ $dayOfMonth: "$date" }, day] },
          ],
        },
      }));

      if (duplicateSchedule) {
        throw conflict(
          `Schedule for ${year}/${
            month > 9 ? month : "0" + month
          }/${day} already exists for business ${businessId}`,
        );
      }

      const newSchedule = {
        date,
        weekNumber,
        businessId,
        comments: comments || undefined,
      };

      await Schedule.create(newSchedule);

      return reply
        .code(201)
        .send({ message: `Schedule ${newSchedule.date} created!` });
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

  // PATCH /schedules/:scheduleId - update
  app.patch<{ Params: ScheduleIdParams; Body: UpdateScheduleBody }>(
    "/:scheduleId",
    {
      schema: {
        params: scheduleIdParamsSchema,
        body: updateScheduleBodySchema,
      },
    },
    async (req, reply) => {
      const { scheduleId } = req.params;
      const { comments } = req.body;

      const updateSchedule: Partial<ISchedule> = {};
      if (comments) {
        updateSchedule.comments = comments;
      }

      const updatedSchedule = await Schedule.findOneAndUpdate(
        withSoftDeleteFilter({ _id: scheduleId }),
        { $set: updateSchedule },
        { returnDocument: "after", lean: true },
      );

      if (!updatedSchedule) {
        throw notFound("Schedule not found!");
      }

      return reply.code(200).send({ message: "Schedule updated" });
    },
  );

  // DELETE /schedules/:scheduleId - delete
  app.delete<{ Params: ScheduleIdParams }>(
    "/:scheduleId",
    {
      preValidation: [createOptionalAuthHook(app)],
      schema: { params: scheduleIdParamsSchema },
    },
    async (req, reply) => {
      const { scheduleId } = req.params;

      const schedule = (await Schedule.findById(scheduleId)
        .setOptions({ includeDeleted: true })
        .lean()) as
        | (ISchedule & { deleted?: boolean })
        | null;
      if (!schedule) {
        throw notFound("Schedule not found!");
      }
      if (schedule.deleted) {
        throw conflict("Schedule already deleted!");
      }

      const scheduleDate = new Date(schedule.date);
      const currentDate = new Date();

      scheduleDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);

      if (scheduleDate <= currentDate) {
        throw badRequest("Cannot delete past or current schedules!");
      }

      const wasDeleted = await markAsDeletedById(
        Schedule as mongoose.Model<ISchedule & { deleted: boolean }>,
        scheduleId,
        { deletedBy: req.authSession?.id },
      );
      if (!wasDeleted) {
        throw conflict("Schedule already deleted!");
      }

      return reply.code(200).send({ message: `Schedule ${scheduleId} deleted` });
    },
  );

  // PATCH /schedules/:scheduleId/addEmployee - add employee (transaction)
  app.patch<{ Params: ScheduleIdParams; Body: AddEmployeeBody }>(
    "/:scheduleId/addEmployee",
    {
      schema: {
        params: scheduleIdParamsSchema,
        body: addEmployeeBodySchema,
      },
    },
    async (req, reply) => {
      const { scheduleId } = req.params;
      const { employeeSchedule } = req.body;

      const validEmployees = employeesValidation(employeeSchedule);
      if (validEmployees !== true) {
        throw notFound(validEmployees);
      }

      const { employeeId, role, timeRange, vacation } = employeeSchedule;
      const startTime = new Date(timeRange.startTime);
      const endTime = new Date(timeRange.endTime);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const schedule = (await Schedule.findOne(
          withSoftDeleteFilter({ _id: scheduleId }),
        )
          .select(
            "employeesSchedules.employeeId employeesSchedules.vacation employeesSchedules.timeRange",
          )
          .session(session)
          .lean()) as unknown as ISchedule | null;

        if (!schedule) {
          throw notFound("Schedule not found!");
        }

        const employeeAlreadyScheduled = (
          schedule.employeesSchedules || []
        ).filter((emp) => emp.employeeId.toString() === employeeId.toString());

        // Check if employee is already on vacation for this day
        if (
          employeeAlreadyScheduled.length > 0 &&
          employeeAlreadyScheduled.some((el) => el.vacation)
        ) {
          throw badRequest("Employee on vacation!");
        }

        // If trying to add vacation, check if employee already has schedules
        if (vacation && employeeAlreadyScheduled.length > 0) {
          if (employeeAlreadyScheduled.some((el) => el.vacation)) {
            throw badRequest("Employee already on vacation!");
          }
          throw badRequest("Employee already scheduled!");
        }

        const timeRangeArr = employeeAlreadyScheduled.map((el) => ({
          startTime: new Date(el.timeRange.startTime),
          endTime: new Date(el.timeRange.endTime),
        }));

        assertNoScheduleOverlap(startTime, endTime, timeRangeArr);

        const employeeDoc = (await Employee.findById(employeeId)
          .select("salary.grossSalary salary.payFrequency")
          .session(session)
          .lean()) as unknown as IEmployee | null;

        if (!employeeDoc) {
          throw notFound("Employee not found!");
        }

        const shiftDurationMs = getShiftDurationMs(startTime, endTime);
        const employeeCost = calculateShiftEmployeeCost(
          employeeDoc.salary,
          shiftDurationMs,
        );

        const addEmployeeSchedule = {
          employeeId,
          role,
          timeRange: { startTime, endTime },
          vacation: vacation !== undefined ? vacation : false,
          shiftHours: shiftDurationMs,
          employeeCost,
        };

        // Only increment total if this is the first schedule entry for this employee
        const totalEmployeesScheduledIncrement =
          employeeAlreadyScheduled.length > 0 ? 0 : 1;

        const updatedSchedule = await Schedule.findOneAndUpdate(
          withSoftDeleteFilter({ _id: scheduleId }),
          {
            $push: { employeesSchedules: addEmployeeSchedule },
            $inc: {
              totalDayEmployeesCost: employeeCost,
              totalEmployeesScheduled: vacation
                ? 0
                : totalEmployeesScheduledIncrement,
              totalEmployeesVacation: vacation ? 1 : 0,
            },
          },
          { returnDocument: "after", lean: true, session },
        );

        if (updatedSchedule && vacation) {
          const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            { $inc: { vacationDaysLeft: -1 } },
            { returnDocument: "after", lean: true, session },
          );

          if (!updatedEmployee) {
            throw internal(
              "Update employee vacation days left failed upon adding employee to schedule!",
            );
          }
        }

        await session.commitTransaction();

        return reply.code(201).send({ message: "Employee added to schedule!" });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // PATCH /schedules/:scheduleId/deleteEmployee - remove employee
  app.patch<{ Params: ScheduleIdParams; Body: DeleteEmployeeBody }>(
    "/:scheduleId/deleteEmployee",
    {
      schema: {
        params: scheduleIdParamsSchema,
        body: deleteEmployeeBodySchema,
      },
    },
    async (req, reply) => {
      const { scheduleId } = req.params;
      const { employeeId, employeeScheduleId } = req.body;

      const schedule = (await Schedule.findOne({
        ...withSoftDeleteFilter({ _id: scheduleId }),
        employeeSchedules: { $elemMatch: { employeeId } },
      })
        .select("_id employeeSchedules")
        .lean()) as unknown as ISchedule | null;

      if (!schedule) {
        throw notFound("Schedule not found!");
      }

      const employeeSchedule: IEmployeeSchedule | null =
        (schedule.employeesSchedules || []).find(
          (emp) =>
            emp._id?.toString() === employeeScheduleId &&
            emp.employeeId.toString() === employeeId,
        ) || null;

      if (!employeeSchedule) {
        throw notFound("Employee not found in schedule!");
      }

      const scheduleToDelete = (schedule.employeesSchedules || []).find(
        (s) => s._id?.toString() === employeeScheduleId,
      );

      const scheduleEmployeesLen = (schedule.employeesSchedules || []).length;

      const updatedSchedule = await Schedule.findOneAndUpdate(
        withSoftDeleteFilter({ _id: scheduleId }),
        {
          $pull: { employeesSchedules: { _id: employeeScheduleId } },
          $inc: {
            totalEmployeesScheduled: -(scheduleEmployeesLen > 0 ? 0 : 1),
            totalEmployeesVacation: -(scheduleToDelete?.vacation === true
              ? 1
              : 0),
            totalDayEmployeesCost: -(scheduleToDelete?.employeeCost ?? 0),
          },
        },
        { returnDocument: "after", lean: true },
      );

      if (updatedSchedule && scheduleToDelete?.vacation === true) {
        const updatedEmployee = await Employee.findByIdAndUpdate(
          employeeId,
          { $inc: { vacationDaysLeft: 1 } },
          { returnDocument: "after", lean: true },
        );

        if (!updatedEmployee) {
          throw internal(
            "Update employee vacation days left failed upon employee schedule deletation!",
          );
        }
      }

      return reply
        .code(200)
        .send({ message: "Employee deleted from schedule!" });
    },
  );

  // PATCH /schedules/:scheduleId/updateEmployee - update employee (transaction)
  app.patch<{ Params: ScheduleIdParams; Body: UpdateEmployeeBody }>(
    "/:scheduleId/updateEmployee",
    {
      schema: {
        params: scheduleIdParamsSchema,
        body: updateEmployeeBodySchema,
      },
    },
    async (req, reply) => {
      const { scheduleId } = req.params;
      const { employeeSchedule, employeeScheduleId } = req.body;

      const validEmployees = employeesValidation(employeeSchedule);
      if (validEmployees !== true) {
        throw badRequest(validEmployees);
      }

      const { employeeId, role, timeRange, vacation } = employeeSchedule;
      const startTime = new Date(timeRange.startTime);
      const endTime = new Date(timeRange.endTime);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const schedule = await Schedule.findOne(
          withSoftDeleteFilter({ _id: scheduleId }),
        )
          .select(
            "employeesSchedules._id employeesSchedules.employeeId employeesSchedules.vacation employeesSchedules.timeRange employeesSchedules.employeeCost",
          )
          .session(session)
          .lean<ISchedule | null>();

        const employee = await Employee.findById(employeeId)
          .select("salary.grossSalary salary.payFrequency")
          .session(session)
          .lean<IEmployee | null>();

        if (!schedule) {
          throw notFound("Schedule not found!");
        }

        if (!employee) {
          throw notFound("Employee not found!");
        }

        const employeeScheduleToUpdate = (schedule.employeesSchedules || []).find(
          (empSch) => empSch._id?.toString() === employeeScheduleId,
        );

        if (!employeeScheduleToUpdate) {
          throw notFound("Employee schedule not found!");
        }

        const employeeAlreadyScheduled = (
          schedule.employeesSchedules || []
        ).filter(
          (emp) =>
            emp.employeeId.toString() === employeeId.toString() &&
            emp._id?.toString() !== employeeScheduleId,
        );

        if (employeeAlreadyScheduled.length > 0 && vacation) {
          throw badRequest(
            "Employee has multiple schedules, can't be on vacation!",
          );
        }

        const timeRangeArr = employeeAlreadyScheduled.map((el) => ({
          startTime: new Date(el.timeRange.startTime),
          endTime: new Date(el.timeRange.endTime),
        }));

        assertNoScheduleOverlap(startTime, endTime, timeRangeArr);

        const shiftDurationMs = getShiftDurationMs(startTime, endTime);
        const employeeCost = calculateShiftEmployeeCost(
          employee?.salary,
          shiftDurationMs,
        );

        // Calculate cost difference (subtract old cost, add new cost)
        const oldEmployeeCost = employeeScheduleToUpdate.employeeCost ?? 0;
        const costDifference = employeeCost - oldEmployeeCost;

        // Update individual fields to avoid timestamps conflict
        const updatedSchedule = await Schedule.findOneAndUpdate(
          {
            ...withSoftDeleteFilter({ _id: scheduleId }),
            "employeesSchedules._id": employeeScheduleId,
          },
          {
            $set: {
              "employeesSchedules.$.employeeId": new Types.ObjectId(
                employeeId.toString(),
              ),
              "employeesSchedules.$.role": role,
              "employeesSchedules.$.timeRange": { startTime, endTime },
              "employeesSchedules.$.vacation":
                vacation !== undefined ? vacation : false,
              "employeesSchedules.$.shiftHours": shiftDurationMs,
              "employeesSchedules.$.employeeCost": employeeCost,
            },
            $inc: {
              totalDayEmployeesCost: costDifference,
              totalEmployeesScheduled:
                employeeScheduleToUpdate?.vacation && !vacation
                  ? 1
                  : employeeScheduleToUpdate?.vacation === false && vacation
                    ? -1
                    : 0,
              totalEmployeesVacation:
                employeeScheduleToUpdate?.vacation && !vacation
                  ? -1
                  : employeeScheduleToUpdate?.vacation === false && vacation
                    ? 1
                    : 0,
            },
          },
          { returnDocument: "after", lean: true, session },
        );

        if (updatedSchedule) {
          const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            {
              $inc: {
                vacationDaysLeft:
                  employeeScheduleToUpdate?.vacation && !vacation
                    ? 1
                    : !employeeScheduleToUpdate?.vacation && vacation
                      ? -1
                      : 0,
              },
            },
            { returnDocument: "after", lean: true, session },
          );

          if (!updatedEmployee) {
            throw internal(
              "Update employee vacation days left failed upon adding employee to schedule!",
            );
          }
        }

        await session.commitTransaction();

        return reply.code(201).send({ message: "Employee schedule updated" });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
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
