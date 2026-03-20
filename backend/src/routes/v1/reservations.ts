import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IReservation } from "@shared/interfaces/IReservation";
import type { ISalesInstance } from "@shared/interfaces/ISalesInstance";
import type { IDailySalesReport } from "@shared/interfaces/IDailySalesReport";

import { isObjectIdValid } from "../../utils/isObjectIdValid.ts";
import { managementRolesEnums } from "../../../lib/enums.ts";
import { createDailySalesReport } from "../../dailySalesReports/createDailySalesReport.ts";
import { createSalesInstance } from "../../salesInstances/createSalesInstance.ts";
import {
  sendReservationPendingFlow,
  sendReservationDecisionFlow,
} from "../../reservations/sendReservationCustomerFlow.ts";
import Reservation from "../../models/reservation.ts";
import Employee from "../../models/employee.ts";
import SalesPoint from "../../models/salesPoint.ts";
import SalesInstance from "../../models/salesInstance.ts";
import DailySalesReport from "../../models/dailySalesReport.ts";
import { createAuthHook } from "../../auth/middleware.ts";

const RESERVATION_STATUS_VALUES = [
  "Pending",
  "Confirmed",
  "Arrived",
  "Seated",
  "Cancelled",
  "NoShow",
  "Completed",
] as const;

const isReservationStatus = (
  value: unknown
): value is (typeof RESERVATION_STATUS_VALUES)[number] =>
  typeof value === "string" &&
  (RESERVATION_STATUS_VALUES as readonly string[]).includes(value);

const canTransitionReservationStatus = (
  currentStatus: string | undefined,
  nextStatus: (typeof RESERVATION_STATUS_VALUES)[number]
) => {
  const current = (currentStatus ?? "Pending") as (typeof RESERVATION_STATUS_VALUES)[number];

  if (["Cancelled", "NoShow", "Completed"].includes(current)) return false;
  if (current === nextStatus) return true;

  const allowed: Record<
    (typeof RESERVATION_STATUS_VALUES)[number],
    (typeof RESERVATION_STATUS_VALUES)[number][]
  > = {
    Pending: ["Confirmed", "Cancelled"],
    Confirmed: ["Arrived", "Cancelled", "NoShow"],
    Arrived: ["Seated", "Cancelled", "NoShow"],
    Seated: [],
    Cancelled: [],
    NoShow: [],
    Completed: [],
  };

  return allowed[current]?.includes(nextStatus) ?? false;
};

export const reservationsRoutes: FastifyPluginAsync = async (app) => {
  // GET /reservations - list all (with optional filters)
  app.get("/", async (req, reply) => {
    try {
      const query = req.query as {
        businessId?: string;
        startDate?: string;
        endDate?: string;
        status?: string;
      };

      const filter: {
        businessId?: Types.ObjectId;
        reservationStart?: { $gte?: Date; $lte?: Date };
        status?: string;
      } = {};

      if (query.businessId) {
        if (isObjectIdValid([query.businessId]) !== true) {
          return reply.code(400).send({ message: "Invalid businessId!" });
        }
        filter.businessId = new Types.ObjectId(query.businessId);
      }

      if (query.startDate || query.endDate) {
        filter.reservationStart = {};
        if (query.startDate) filter.reservationStart.$gte = new Date(query.startDate);
        if (query.endDate) filter.reservationStart.$lte = new Date(query.endDate);
        if (query.startDate && query.endDate && query.startDate > query.endDate) {
          return reply.code(400).send({
            message: "Invalid date range, startDate must be before endDate!",
          });
        }
      }

      if (query.status) {
        filter.status = query.status;
      }

      const reservations = await Reservation.find(filter).sort({
        reservationStart: 1,
      });

      if (!reservations?.length) {
        return reply.code(404).send({ message: "No reservations found!" });
      }
      return reply.code(200).send(reservations);
    } catch (error) {
      return reply.code(500).send({
        message: "Get all reservations failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // POST /reservations - create (transaction)
  app.post("/", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    if (!req.authSession || req.authSession.type !== "user") {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const createdByUserId = new Types.ObjectId(req.authSession.id);

    const {
      businessId,
      guestCount,
      reservationStart,
      reservationEnd,
      description,
    } = req.body as Partial<IReservation>;

    if (!businessId || !guestCount || !reservationStart) {
      return reply.code(400).send({
        message: "businessId, guestCount and reservationStart are required!",
      });
    }

    const idsToValidate = [businessId];
    if (isObjectIdValid(idsToValidate as Types.ObjectId[]) !== true) {
      return reply.code(400).send({ message: "Invalid IDs!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const employee = (await Employee.findOne({
        userId: createdByUserId,
        businessId,
      })
        .select("onDuty")
        .session(session)
        .lean()) as { onDuty?: boolean } | null;

      const createdByRole: IReservation["createdByRole"] =
        employee?.onDuty === true ? "employee" : "customer";

      const effectiveReservationStart = new Date(reservationStart);

      const effectiveReservationEnd = reservationEnd
        ? new Date(reservationEnd)
        : new Date(effectiveReservationStart.getTime() + 120 * 60 * 1000);

      if (effectiveReservationEnd <= effectiveReservationStart) {
        await session.abortTransaction();
        return reply.code(400).send({
          message: "reservationEnd must be after reservationStart!",
        });
      }

      const newReservation: IReservation = {
        businessId,
        createdByUserId,
        createdByRole,
        employeeResponsableByUserId:
          createdByRole === "employee" ? createdByUserId : undefined,
        guestCount,
        reservationStart: effectiveReservationStart,
        reservationEnd: effectiveReservationEnd,
        description,
        status: createdByRole === "employee" ? "Confirmed" : "Pending",
      };

      const created = await Reservation.create([newReservation], { session });

      await session.commitTransaction();

      if (createdByRole === "customer" && created[0]?._id) {
        sendReservationPendingFlow({
          userId: createdByUserId,
          businessId,
          reservationId: created[0]._id as Types.ObjectId,
          reservationStart: effectiveReservationStart,
          guestCount,
          description,
        }).catch((err) => {
          console.error("[reservations] sendReservationPendingFlow failed:", err);
        });
      }

      return reply.code(201).send(created[0]);
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Create reservation failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // GET /reservations/:reservationId - get by ID
  app.get("/:reservationId", async (req, reply) => {
    try {
      const params = req.params as { reservationId?: string };
      const reservationId = params.reservationId;

      if (!reservationId || isObjectIdValid([reservationId]) !== true) {
        return reply.code(400).send({ message: "Invalid reservationId!" });
      }

      const reservation = await Reservation.findById(reservationId).lean();

      if (!reservation) {
        return reply.code(404).send({ message: "Reservation not found!" });
      }
      return reply.code(200).send(reservation);
    } catch (error) {
      return reply.code(500).send({
        message: "Get reservation by id failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // PATCH /reservations/:reservationId - update
  app.patch("/:reservationId", { preValidation: [createAuthHook(app)] }, async (req, reply) => {
    if (!req.authSession || req.authSession.type !== "user") {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const sessionUserId = new Types.ObjectId(req.authSession.id);
    const params = req.params as { reservationId?: string };
    const reservationId = params.reservationId;

    const {
      status,
      salesPointId,
      reservationStart,
      reservationEnd,
      guestCount,
      description,
      employeeResponsableByUserId,
      salesInstanceId,
    } = req.body as Partial<IReservation>;

    const idsToValidate: (Types.ObjectId | string)[] = [reservationId as string];
    if (salesPointId) idsToValidate.push(salesPointId as unknown as string);
    if (employeeResponsableByUserId) idsToValidate.push(employeeResponsableByUserId as unknown as string);
    if (salesInstanceId) idsToValidate.push(salesInstanceId as unknown as string);

    if (isObjectIdValid(idsToValidate as Types.ObjectId[]) !== true) {
      return reply.code(400).send({ message: "Invalid IDs!" });
    }

    if (status && !isReservationStatus(status)) {
      return reply.code(400).send({ message: "Invalid status value!" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const reservation = (await Reservation.findById(reservationId)
        .session(session)
        .lean()) as unknown as (IReservation & { status?: string }) | null;

      if (!reservation) {
        await session.abortTransaction();
        return reply.code(404).send({ message: "Reservation not found!" });
      }

      const previousStatus = reservation.status ?? "Pending";

      const isStatusOrTableChange =
        typeof status === "string" || typeof salesPointId !== "undefined";

      if (isStatusOrTableChange) {
        const employee = (await Employee.findOne({
          userId: sessionUserId,
          businessId: reservation.businessId,
        })
          .select("allEmployeeRoles onDuty")
          .session(session)
          .lean()) as { allEmployeeRoles?: string[]; onDuty?: boolean } | null;

        if (!employee) {
          await session.abortTransaction();
          return reply.code(403).send({ message: "Employee not found!" });
        }

        const isAllowed =
          (employee.allEmployeeRoles || []).includes("Host") ||
          managementRolesEnums.some((role) => employee.allEmployeeRoles?.includes(role));

        if (!isAllowed) {
          await session.abortTransaction();
          return reply.code(403).send({ message: "Forbidden" });
        }
      }

      if (salesPointId) {
        const sp = await SalesPoint.findOne({
          _id: salesPointId,
          businessId: reservation.businessId,
        })
          .select("_id")
          .session(session)
          .lean();
        if (!sp) {
          await session.abortTransaction();
          return reply.code(404).send({
            message: "SalesPoint not found for this business!",
          });
        }
      }

      const updated: Partial<IReservation> & { status?: string } = {};

      if (typeof guestCount === "number") updated.guestCount = guestCount;
      if (typeof description === "string") updated.description = description;
      if (employeeResponsableByUserId)
        updated.employeeResponsableByUserId = employeeResponsableByUserId;

      if (reservationStart) updated.reservationStart = new Date(reservationStart);
      if (reservationEnd) updated.reservationEnd = new Date(reservationEnd);

      if (salesPointId) updated.salesPointId = salesPointId;
      if (salesInstanceId) updated.salesInstanceId = salesInstanceId;

      if (status) {
        if (!canTransitionReservationStatus(reservation.status, status)) {
          await session.abortTransaction();
          return reply.code(400).send({
            message: `Invalid status transition from ${reservation.status ?? "Pending"} to ${status}!`,
          });
        }

        if (status === "Seated" && !salesPointId && !reservation.salesPointId) {
          await session.abortTransaction();
          return reply.code(400).send({
            message: "salesPointId is required to set status Seated!",
          });
        }

        updated.status = status;

        if (
          (status === "Confirmed" || status === "Cancelled" || status === "NoShow") &&
          !reservation.employeeResponsableByUserId
        ) {
          updated.employeeResponsableByUserId = sessionUserId;
        }
      }

      if (salesPointId && reservation.salesInstanceId) {
        const existingSalesInstance = (await SalesInstance.findById(
          reservation.salesInstanceId
        )
          .select("dailyReferenceNumber businessId salesPointId salesInstanceStatus")
          .session(session)
          .lean()) as unknown as ISalesInstance | null;

        if (!existingSalesInstance) {
          await session.abortTransaction();
          return reply.code(404).send({ message: "Linked SalesInstance not found!" });
        }

        if (existingSalesInstance.salesInstanceStatus === "Closed") {
          await session.abortTransaction();
          return reply.code(409).send({ message: "Cannot move a closed SalesInstance!" });
        }

        const openConflict = await SalesInstance.exists({
          _id: { $ne: existingSalesInstance._id },
          dailyReferenceNumber: existingSalesInstance.dailyReferenceNumber,
          businessId: existingSalesInstance.businessId,
          salesPointId,
          salesInstanceStatus: { $ne: "Closed" },
        }).session(session);

        if (openConflict) {
          await session.abortTransaction();
          return reply.code(409).send({
            message:
              "Cannot move to this salesPoint because it already has an open SalesInstance!",
          });
        }

        const moved = await SalesInstance.updateOne(
          { _id: existingSalesInstance._id },
          { $set: { salesPointId } },
          { session }
        );

        if (moved.modifiedCount !== 1) {
          await session.abortTransaction();
          return reply.code(400).send({ message: "SalesInstance not moved!" });
        }
      }

      if (
        status === "Seated" &&
        !reservation.salesInstanceId &&
        !updated.salesInstanceId
      ) {
        const effectiveSalesPointId =
          salesPointId ?? (reservation.salesPointId as Types.ObjectId | undefined);

        if (!effectiveSalesPointId) {
          await session.abortTransaction();
          return reply.code(400).send({
            message: "salesPointId is required to seat a reservation!",
          });
        }

        const dailySalesReport = (await DailySalesReport.findOne({
          isDailyReportOpen: true,
          businessId: reservation.businessId,
        })
          .select("dailyReferenceNumber")
          .session(session)
          .lean()) as unknown as IDailySalesReport | null;

        const dailyReferenceNumber = dailySalesReport
          ? dailySalesReport.dailyReferenceNumber
          : await createDailySalesReport(reservation.businessId as Types.ObjectId, session);

        if (typeof dailyReferenceNumber === "string") {
          await session.abortTransaction();
          return reply.code(400).send({ message: dailyReferenceNumber });
        }

        const existingOpen = await SalesInstance.exists({
          dailyReferenceNumber,
          businessId: reservation.businessId,
          salesPointId: effectiveSalesPointId,
          salesInstanceStatus: { $ne: "Closed" },
        }).session(session);

        if (existingOpen) {
          await session.abortTransaction();
          return reply.code(409).send({
            message:
              "SalesInstance already exists for this salesPoint and it is not closed!",
          });
        }

        const newSalesInstanceObj: ISalesInstance = {
          dailyReferenceNumber,
          salesPointId: effectiveSalesPointId,
          guests: reservation.guestCount,
          salesInstanceStatus: "Reserved",
          openedByUserId: sessionUserId,
          openedAsRole: "employee",
          businessId: reservation.businessId as Types.ObjectId,
          clientName: reservation.description,
        };

        const created = await createSalesInstance(newSalesInstanceObj, session);
        if (typeof created === "string") {
          await session.abortTransaction();
          return reply.code(400).send({ message: created });
        }

        const createdDoc = Array.isArray(created) ? created[0] : created;
        if (!createdDoc?._id) {
          await session.abortTransaction();
          return reply.code(400).send({ message: "Failed to create SalesInstance!" });
        }

        updated.salesInstanceId = createdDoc._id as Types.ObjectId;
      }

      const result = await Reservation.updateOne(
        { _id: reservationId },
        { $set: updated },
        { session }
      );

      if (result.modifiedCount !== 1) {
        await session.abortTransaction();
        return reply.code(400).send({ message: "Reservation not updated!" });
      }

      await session.commitTransaction();

      if (
        reservation.createdByRole === "customer" &&
        reservation.createdByUserId &&
        (status === "Confirmed" || status === "Cancelled")
      ) {
        const customerUserId =
          typeof reservation.createdByUserId === "object"
            ? (reservation.createdByUserId as Types.ObjectId)
            : new Types.ObjectId(String(reservation.createdByUserId));
        const reservationBusinessId =
          typeof reservation.businessId === "object"
            ? (reservation.businessId as Types.ObjectId)
            : new Types.ObjectId(String(reservation.businessId));

        sendReservationDecisionFlow({
          userId: customerUserId,
          businessId: reservationBusinessId,
          reservationId: new Types.ObjectId(reservationId as string),
          reservationStart: updated.reservationStart ?? reservation.reservationStart ?? new Date(),
          guestCount: updated.guestCount ?? reservation.guestCount ?? 1,
          description: updated.description ?? reservation.description,
          status,
        }).catch((err) => {
          console.error("[reservations] sendReservationDecisionFlow failed:", err);
        });
      }

      return reply.code(200).send({ message: "Reservation updated!" });
    } catch (error) {
      await session.abortTransaction();
      return reply.code(500).send({
        message: "Update reservation failed!",
        error: error instanceof Error ? error.message : error,
      });
    } finally {
      session.endSession();
    }
  });

  // DELETE /reservations/:reservationId - delete
  app.delete("/:reservationId", async (req, reply) => {
    try {
      const params = req.params as { reservationId?: string };
      const reservationId = params.reservationId;

      if (!reservationId || isObjectIdValid([reservationId]) !== true) {
        return reply.code(400).send({ message: "Invalid reservationId!" });
      }

      const deleted = await Reservation.deleteOne({ _id: reservationId });

      if (deleted.deletedCount === 0) {
        return reply.code(404).send({ message: "Reservation not found!" });
      }
      return reply.code(200).send({ message: "Reservation deleted!" });
    } catch (error) {
      return reply.code(500).send({
        message: "Delete reservation failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });

  // GET /reservations/business/:businessId - get by business (with optional filters)
  app.get("/business/:businessId", async (req, reply) => {
    try {
      const params = req.params as { businessId?: string };
      const businessId = params.businessId;

      if (!businessId || isObjectIdValid([businessId]) !== true) {
        return reply.code(400).send({ message: "Invalid businessId!" });
      }

      const query = req.query as {
        startDate?: string;
        endDate?: string;
        status?: string;
      };

      const filter: {
        businessId: Types.ObjectId;
        reservationStart?: { $gte?: Date; $lte?: Date };
        status?: string;
      } = { businessId: new Types.ObjectId(businessId) };

      if (query.startDate || query.endDate) {
        filter.reservationStart = {};
        if (query.startDate) filter.reservationStart.$gte = new Date(query.startDate);
        if (query.endDate) filter.reservationStart.$lte = new Date(query.endDate);
        if (query.startDate && query.endDate && query.startDate > query.endDate) {
          return reply.code(400).send({
            message: "Invalid date range, startDate must be before endDate!",
          });
        }
      }

      if (query.status) filter.status = query.status;

      const reservations = await Reservation.find(filter).sort({
        reservationStart: 1,
      });

      if (!reservations?.length) {
        return reply.code(404).send({ message: "No reservations found!" });
      }
      return reply.code(200).send(reservations);
    } catch (error) {
      return reply.code(500).send({
        message: "Get reservations by businessId failed!",
        error: error instanceof Error ? error.message : error,
      });
    }
  });
};
