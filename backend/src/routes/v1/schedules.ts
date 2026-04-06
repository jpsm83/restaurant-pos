import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type {
  ISchedule,
  IEmployeeSchedule,
} from "../../../../packages/interfaces/ISchedule.ts";
import type { IEmployee } from "../../../../packages/interfaces/IEmployee.ts";

import isObjectIdValid from "../../utils/isObjectIdValid.ts";
import getWeekNumber from "../../schedules/getWeekNumber.ts";
import employeesValidation from "../../schedules/employeesValidation.ts";
import isScheduleOverlapping from "../../schedules/isScheduleOverlapping.ts";
import getWeekdaysInMonth from "../../schedules/getWeekdaysInMonth.ts";
import calculateEmployeeCost from "../../schedules/calculateEmployeeCost.ts";
import Schedule from "../../models/schedule.ts";
import Employee from "../../models/employee.ts";
import User from "../../models/user.ts";
import {
  createAuthHook,
  requireValidObjectIdParamHook,
} from "../../auth/middleware.ts";
import type { AuthUser } from "../../auth/types.ts";

export const schedulesRoutes: FastifyPluginAsync = async (app) => {
  const authHook = createAuthHook(app);

  /**
   * Today's shift rows for the **authenticated** user's linked employee at this business.
   * Must be registered before `GET /:scheduleId` so `business` is not parsed as an id.
   *
   * Query: `dayKey=YYYY-MM-DD` (optional; server-local calendar day when omitted).
   */
  app.get(
    "/business/:businessId/daily",
    {
      preValidation: [requireValidObjectIdParamHook("businessId"), authHook],
    },
    async (req, reply) => {
      const businessId = (req.params as { businessId: string }).businessId;
      const session = req.authSession;
      if (!session || session.type !== "user") {
        return reply.code(403).send({ message: "Forbidden" });
      }
      const u = session as AuthUser;
      if (!u.employeeId || u.businessId !== businessId) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const rawDay = (req.query as { dayKey?: string }).dayKey;
      let startOfDay: Date;
      let endOfDay: Date;
      if (typeof rawDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDay)) {
        const [y, m, d] = rawDay.split("-").map(Number);
        startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0);
        endOfDay = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
      } else {
        const effectiveNow = new Date();
        startOfDay = new Date(effectiveNow);
        startOfDay.setHours(0, 0, 0, 0);
        endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
      }

      const schedule = (await Schedule.findOne({
        businessId,
        date: { $gte: startOfDay, $lt: endOfDay },
      })
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
  app.get("/", async (_req, reply) => {
    const schedules = await Schedule.find()
      .populate({
        path: "employeesSchedules.employeeId",
        select: "employeeName allEmployeeRoles",
        model: Employee,
      })
      .lean();

    if (!schedules.length) {
      return reply.code(404).send({ message: "No schedules found!" });
    }
    return reply.code(200).send(schedules);
  });

  // POST /schedules - create
  app.post("/", async (req, reply) => {
    try {
      const { date, businessId, comments } = req.body as ISchedule;

      if (!businessId || isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid business ID!" });
      }

      if (!date) {
        return reply.code(400).send({ message: "Date is required!" });
      }

      const weekNumber = getWeekNumber(new Date(date));

      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();

      const duplicateSchedule = await Schedule.exists({
        businessId,
        $expr: {
          $and: [
            { $eq: [{ $year: "$date" }, year] },
            { $eq: [{ $month: "$date" }, month] },
            { $eq: [{ $dayOfMonth: "$date" }, day] },
          ],
        },
      });

      if (duplicateSchedule) {
        return reply.code(409).send({
          message: `Schedule for ${year}/${
            month > 9 ? month : "0" + month
          }/${day} already exists for business ${businessId}`,
        });
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
    } catch (error) {
      return reply.code(500).send({
        message: "Create schedule failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /schedules/:scheduleId - get by ID
  app.get("/:scheduleId", async (req, reply) => {
    const params = req.params as { scheduleId?: string };
    const scheduleId = params.scheduleId;

    if (!scheduleId || isObjectIdValid([scheduleId]) !== true) {
      return reply.code(400).send({ message: "Invalid schedule ID!" });
    }

    const schedule = await Schedule.findById(scheduleId)
      .populate({
        path: "employeesSchedules.employeeId",
        select: "employeeName allEmployeeRoles",
        model: Employee,
      })
      .lean();

    if (!schedule) {
      return reply.code(404).send({ message: "No schedule found!" });
    }
    return reply.code(200).send(schedule);
  });

  // PATCH /schedules/:scheduleId - update
  app.patch("/:scheduleId", async (req, reply) => {
    const params = req.params as { scheduleId?: string };
    const scheduleId = params.scheduleId;

    if (!scheduleId || isObjectIdValid([scheduleId]) !== true) {
      return reply.code(400).send({ message: "Invalid schedule ID!" });
    }

    const { comments } = req.body as ISchedule;

    const updateSchedule: Partial<ISchedule> = {};
    if (comments) {
      updateSchedule.comments = comments;
    }

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      scheduleId,
      { $set: updateSchedule },
      { returnDocument: 'after', lean: true },
    );

    if (!updatedSchedule) {
      return reply.code(404).send({ message: "Schedule not found!" });
    }

    return reply.code(200).send({ message: "Schedule updated" });
  });

  // DELETE /schedules/:scheduleId - delete
  app.delete("/:scheduleId", async (req, reply) => {
    const params = req.params as { scheduleId?: string };
    const scheduleId = params.scheduleId;

    if (!scheduleId || isObjectIdValid([scheduleId]) !== true) {
      return reply.code(400).send({ message: "Invalid schedule ID!" });
    }

    const schedule = (await Schedule.findById(
      scheduleId,
    ).lean()) as unknown as ISchedule | null;
    if (!schedule) {
      return reply.code(404).send({ message: "Schedule not found!" });
    }

    const scheduleDate = new Date(schedule.date);
    const currentDate = new Date();

    scheduleDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    if (scheduleDate <= currentDate) {
      return reply
        .code(400)
        .send({ message: "Cannot delete past or current schedules!" });
    }

    const result = await Schedule.deleteOne({ _id: scheduleId });

    if (result.deletedCount === 0) {
      return reply.code(404).send({ message: "Schedule not found!" });
    }

    return reply.code(200).send({ message: `Schedule ${scheduleId} deleted` });
  });

  // PATCH /schedules/:scheduleId/addEmployee - add employee (transaction)
  app.patch("/:scheduleId/addEmployee", async (req, reply) => {
    const params = req.params as { scheduleId?: string };
    const scheduleId = params.scheduleId;
    const { employeeSchedule } = req.body as {
      employeeSchedule: IEmployeeSchedule;
    };

    const { employeeId, role, timeRange, vacation } = employeeSchedule;
    const startTime = new Date(timeRange.startTime);
    const endTime = new Date(timeRange.endTime);

    if (!scheduleId || isObjectIdValid([scheduleId]) !== true) {
      return reply.code(400).send({ message: "Invalid schedule Id!" });
    }

    const validEmployees = employeesValidation(employeeSchedule);
    if (validEmployees !== true) {
      return reply.code(404).send({ message: validEmployees });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const schedule = (await Schedule.findById(scheduleId)
        .select(
          "employeesSchedules.employeeId employeesSchedules.vacation employeesSchedules.timeRange",
        )
        .session(session)
        .lean()) as unknown as ISchedule | null;

      if (!schedule) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Schedule not found!" });
      }

      const employeeAlreadyScheduled = (
        schedule.employeesSchedules || []
      ).filter((emp) => emp.employeeId.toString() === employeeId.toString());

      // Check if employee is already on vacation for this day
      if (
        employeeAlreadyScheduled.length > 0 &&
        employeeAlreadyScheduled.some((el) => el.vacation)
      ) {
        await session.abortTransaction();
        return reply.code(400).send({ message: "Employee on vacation!" });
      }

      // If trying to add vacation, check if employee already has schedules
      if (vacation && employeeAlreadyScheduled.length > 0) {
        if (employeeAlreadyScheduled.some((el) => el.vacation)) {
          await session.abortTransaction();
          return reply
            .code(400)
            .send({ message: "Employee already on vacation!" });
        }
        await session.abortTransaction();
        return reply.code(400).send({ message: "Employee already scheduled!" });
      }

      const timeRangeArr = employeeAlreadyScheduled.map((el) => ({
        startTime: new Date(el.timeRange.startTime),
        endTime: new Date(el.timeRange.endTime),
      }));

      if (timeRangeArr.length > 0) {
        if (isScheduleOverlapping(startTime, endTime, timeRangeArr) === true) {
          await session.abortTransaction();
          return reply.code(400).send({
            message: "Employee scheduled overlaps existing one!",
          });
        }
      }

      const employeeEmployee = (await Employee.findById(employeeId)
        .select("salary.grossSalary salary.payFrequency")
        .session(session)
        .lean()) as unknown as IEmployee | null;

      if (!employeeEmployee) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Employee not found!" });
      }

      const shiftDurationMs = endTime.getTime() - startTime.getTime();
      const weekdaysInMonth = getWeekdaysInMonth(
        new Date().getFullYear(),
        new Date().getMonth(),
      );
      let employeeCost = 0;

      if (employeeEmployee?.salary) {
        employeeCost = calculateEmployeeCost(
          employeeEmployee.salary,
          shiftDurationMs,
          weekdaysInMonth,
        );
      }

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

      const updatedSchedule = await Schedule.findByIdAndUpdate(
        scheduleId,
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
        { returnDocument: 'after', lean: true, session },
      );

      if (updatedSchedule && vacation) {
        const updatedEmployee = await Employee.findByIdAndUpdate(
          employeeId,
          { $inc: { vacationDaysLeft: -1 } },
          { returnDocument: 'after', lean: true, session },
        );

        if (!updatedEmployee) {
          await session.abortTransaction();
          return reply.code(500).send({
            message:
              "Update employee vacation days left failed upon adding employee to schedule!",
          });
        }
      }

      await session.commitTransaction();

      return reply.code(201).send({ message: "Employee added to schedule!" });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Adding employee to schedule failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // PATCH /schedules/:scheduleId/deleteEmployee - remove employee
  app.patch("/:scheduleId/deleteEmployee", async (req, reply) => {
    try {
      const params = req.params as { scheduleId?: string };
      const scheduleId = params.scheduleId;

      const { employeeId, employeeScheduleId } = req.body as {
        employeeId?: string;
        employeeScheduleId?: string;
      };

      if (
        !scheduleId ||
        !employeeId ||
        !employeeScheduleId ||
        isObjectIdValid([scheduleId, employeeId, employeeScheduleId]) !== true
      ) {
        return reply.code(400).send({
          message: "Invalid schedule, employee or employeeSchedule Id!",
        });
      }

      const schedule = (await Schedule.findById({
        _id: scheduleId,
        employeeSchedules: { $elemMatch: { employeeId } },
      })
        .select("_id employeeSchedules")
        .lean()) as unknown as ISchedule | null;

      if (!schedule) {
        return reply.code(404).send({ message: "Schedule not found!" });
      }

      const employeeSchedule: IEmployeeSchedule | null =
        (schedule.employeesSchedules || []).find(
          (emp) =>
            emp._id?.toString() === employeeScheduleId &&
            emp.employeeId.toString() === employeeId,
        ) || null;

      if (!employeeSchedule) {
        return reply
          .code(404)
          .send({ message: "Employee not found in schedule!" });
      }

      const scheduleToDelete = (schedule.employeesSchedules || []).find(
        (s) => s._id?.toString() === employeeScheduleId,
      );

      const scheduleEmployeesLen = (schedule.employeesSchedules || []).length;

      const updatedSchedule = await Schedule.findByIdAndUpdate(
        scheduleId,
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
        { returnDocument: 'after', lean: true },
      );

      if (updatedSchedule && scheduleToDelete?.vacation === true) {
        const updatedEmployee = await Employee.findByIdAndUpdate(
          employeeId,
          { $inc: { vacationDaysLeft: 1 } },
          { returnDocument: 'after', lean: true },
        );

        if (!updatedEmployee) {
          return reply.code(500).send({
            message:
              "Update employee vacation days left failed upon employee schedule deletation!",
          });
        }
      }

      return reply
        .code(200)
        .send({ message: "Employee deleted from schedule!" });
    } catch (error) {
      return reply.code(500).send({
        message: "Delete employee from schedule failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // PATCH /schedules/:scheduleId/updateEmployee - update employee (transaction)
  app.patch("/:scheduleId/updateEmployee", async (req, reply) => {
    const params = req.params as { scheduleId?: string };
    const scheduleId = params.scheduleId;

    const { employeeSchedule, employeeScheduleId } = req.body as {
      employeeSchedule: IEmployeeSchedule;
      employeeScheduleId?: string;
    };

    if (!scheduleId || isObjectIdValid([scheduleId]) !== true) {
      return reply.code(400).send({ message: "Invalid schedule Id!" });
    }

    if (!employeeScheduleId || isObjectIdValid([employeeScheduleId]) !== true) {
      return reply.code(400).send({ message: "Invalid employee schedule Id!" });
    }

    const validEmployees = employeesValidation(employeeSchedule);
    if (validEmployees !== true) {
      return reply.code(400).send({ message: validEmployees });
    }

    const { employeeId, role, timeRange, vacation } = employeeSchedule;
    const startTime = new Date(timeRange.startTime);
    const endTime = new Date(timeRange.endTime);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const schedule = await Schedule.findById(scheduleId)
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
        await session.abortTransaction();
        return reply.code(404).send({ message: "Schedule not found!" });
      }

      if (!employee) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Employee not found!" });
      }

      const employeeScheduleToUpdate = (schedule.employeesSchedules || []).find(
        (empSch) => empSch._id?.toString() === employeeScheduleId,
      );

      if (!employeeScheduleToUpdate) {
        await session.abortTransaction();
        return reply
          .code(404)
          .send({ message: "Employee schedule not found!" });
      }

      const employeeAlreadyScheduled = (
        schedule.employeesSchedules || []
      ).filter(
        (emp) =>
          emp.employeeId.toString() === employeeId.toString() &&
          emp._id?.toString() !== employeeScheduleId,
      );

      if (employeeAlreadyScheduled.length > 0 && vacation) {
        await session.abortTransaction();
        return reply.code(400).send({
          message: "Employee has multiple schedules, can't be on vacation!",
        });
      }

      const timeRangeArr = employeeAlreadyScheduled.map((el) => ({
        startTime: new Date(el.timeRange.startTime),
        endTime: new Date(el.timeRange.endTime),
      }));

      if (timeRangeArr.length > 0) {
        if (isScheduleOverlapping(startTime, endTime, timeRangeArr)) {
          await session.abortTransaction();
          return reply.code(400).send({
            message: "Employee scheduled overlaps existing one!",
          });
        }
      }

      const shiftDurationMs = endTime.getTime() - startTime.getTime();
      const weekdaysInMonth = getWeekdaysInMonth(
        new Date().getFullYear(),
        new Date().getMonth(),
      );
      let employeeCost = 0;

      if (employee?.salary) {
        employeeCost = calculateEmployeeCost(
          employee.salary,
          shiftDurationMs,
          weekdaysInMonth,
        );
      }

      // Calculate cost difference (subtract old cost, add new cost)
      const oldEmployeeCost = employeeScheduleToUpdate.employeeCost ?? 0;
      const costDifference = employeeCost - oldEmployeeCost;

      // Update individual fields to avoid timestamps conflict
      const updatedSchedule = await Schedule.findOneAndUpdate(
        {
          _id: scheduleId,
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
        { returnDocument: 'after', lean: true, session },
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
          { returnDocument: 'after', lean: true, session },
        );

        if (!updatedEmployee) {
          await session.abortTransaction();
          return reply.code(500).send({
            message:
              "Update employee vacation days left failed upon adding employee to schedule!",
          });
        }
      }

      await session.commitTransaction();

      return reply.code(201).send({ message: "Employee schedule updated" });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Updating employee to schedule failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /schedules/business/:businessId - get by business
  app.get("/business/:businessId", async (req, reply) => {
    const params = req.params as { businessId?: string };
    const businessId = params.businessId;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return reply.code(400).send({ message: "Invalid business Id!" });
    }

    const schedules = await Schedule.find({
      businessId: new Types.ObjectId(businessId),
    })
      .populate({
        path: "employeesSchedules.employeeId",
        select: "employeeName allEmployeeRoles",
        model: Employee,
      })
      .lean();

    if (!schedules.length) {
      return reply.code(404).send({ message: "No schedules found!" });
    }
    return reply.code(200).send(schedules);
  });

  // GET /schedules/user/:userId - get by user
  app.get("/user/:userId", async (req, reply) => {
    const params = req.params as { userId?: string };
    const userId = params.userId;

    if (!userId || isObjectIdValid([userId]) !== true) {
      return reply.code(400).send({ message: "Invalid user Id!" });
    }

    try {
      const user = (await User.findById(userId)
        .select("employeeDetails")
        .lean()) as {
        employeeDetails?: unknown;
      } | null;
      if (!user?.employeeDetails) {
        return reply.code(404).send({
          message: "User not found or not linked to an employee!",
        });
      }

      const employeeId = user.employeeDetails as Types.ObjectId;

      const schedules = await Schedule.find({
        "employeesSchedules.employeeId": employeeId,
      })
        .populate({
          path: "employeesSchedules.employeeId",
          select: "employeeName allEmployeeRoles",
          model: Employee,
        })
        .lean();

      if (!schedules.length) {
        return reply.code(404).send({ message: "No schedules found!" });
      }
      return reply.code(200).send(schedules);
    } catch (error) {
      return reply.code(500).send({
        message: "Get schedule by employee id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};
