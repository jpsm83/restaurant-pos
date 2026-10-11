/**
 * Reservations Routes - Reservation CRUD, listing and seat/check-in flow.
 *
 * Every route declares its body/params/query as a strict zod DTO from
 * `packages/schemas/reservations.ts`; validation and sanitization happen at the
 * boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`. Cross-field and role rules stay as
 * named post-parse checks: `canTransitionReservationStatus`, the
 * `reservationEnd > reservationStart` period rule, and the employee/management
 * guards.
 */
import type { FastifyPluginAsync } from "fastify";
import mongoose, { Types } from "mongoose";
import type { IReservation } from "../../../../packages/interfaces/IReservation.ts";
import type { ISalesInstance } from "../../../../packages/interfaces/ISalesInstance.ts";
import type { IDailySalesReport } from "../../../../packages/interfaces/IDailySalesReport.ts";

import createDailySalesReport from "../../dailySalesReports/createDailySalesReport.ts";
import createSalesInstance from "../../salesInstances/createSalesInstance.ts";
import { pointBusyForEmployee } from "../../salesInstances/salesInstanceConflicts.ts";
import {
  sendReservationPendingFlow,
  sendReservationDecisionFlow,
} from "../../reservations/sendReservationCustomerFlow.ts";
import getEffectiveUserRoleAtTime from "../../auth/getEffectiveUserRoleAtTime.ts";
import Reservation from "../../models/reservation.ts";
import Employee from "../../models/employee.ts";
import SalesPoint from "../../models/salesPoint.ts";
import SalesInstance from "../../models/salesInstance.ts";
import DailySalesReport from "../../models/dailySalesReport.ts";
import { createAuthHook } from "../../auth/middleware.ts";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "../../errors/appError.ts";
import {
  createReservationBodySchema,
  reservationIdParamsSchema,
  reservationsByBusinessParamsSchema,
  reservationsByBusinessQuerySchema,
  reservationsQuerySchema,
  updateReservationBodySchema,
  type CreateReservationBody,
  type ReservationIdParams,
  type ReservationsByBusinessParams,
  type ReservationsByBusinessQuery,
  type ReservationsQuery,
  type UpdateReservationBody,
} from "../../../../packages/schemas/reservations.ts";
import * as enums from "../../../../packages/enums.ts";

const { managementRolesEnums } = enums;

type ReservationStatus = NonNullable<IReservation["status"]>;

/**
 * Allowed status transitions. `Pending` is the implicit starting status; a
 * terminal status can never move again. Kept post-parse because the rule spans
 * the stored status and the requested one.
 */
const canTransitionReservationStatus = (
  currentStatus: string | undefined,
  nextStatus: ReservationStatus,
) => {
  const current = (currentStatus ?? "Pending") as ReservationStatus;

  if (["Cancelled", "NoShow", "Completed"].includes(current)) return false;
  if (current === nextStatus) return true;

  const allowed: Record<ReservationStatus, ReservationStatus[]> = {
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
  app.get<{ Querystring: ReservationsQuery }>(
    "/",
    { schema: { querystring: reservationsQuerySchema } },
    async (req, reply) => {
      const { businessId, startDate, endDate, status } = req.query;

      const filter: {
        businessId?: Types.ObjectId;
        reservationStart?: { $gte?: Date; $lte?: Date };
        status?: string;
      } = {};

      if (businessId) {
        filter.businessId = new Types.ObjectId(businessId);
      }

      if (startDate || endDate) {
        filter.reservationStart = {};
        if (startDate) filter.reservationStart.$gte = startDate;
        if (endDate) filter.reservationStart.$lte = endDate;
        if (startDate && endDate && startDate > endDate) {
          throw badRequest(
            "Invalid date range, startDate must be before endDate!",
          );
        }
      }

      if (status) {
        filter.status = status;
      }

      const reservations = await Reservation.find(filter).sort({
        reservationStart: 1,
      });

      if (!reservations?.length) {
        throw notFound("No reservations found!");
      }
      return reply.code(200).send(reservations);
    },
  );

  // POST /reservations - create (transaction)
  app.post<{ Body: CreateReservationBody }>(
    "/",
    {
      preValidation: [createAuthHook(app)],
      schema: { body: createReservationBodySchema },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }

      const createdByUserId = new Types.ObjectId(req.authSession.id);

      const {
        businessId,
        guestCount,
        reservationStart,
        reservationEnd,
        description,
      } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const createdByRole = await getEffectiveUserRoleAtTime({
          userId: createdByUserId,
          businessId,
          session,
        });

        const effectiveReservationStart = reservationStart;

        const effectiveReservationEnd = reservationEnd
          ? reservationEnd
          : new Date(effectiveReservationStart.getTime() + 120 * 60 * 1000);

        if (effectiveReservationEnd <= effectiveReservationStart) {
          throw badRequest("reservationEnd must be after reservationStart!");
        }

        const newReservation: IReservation = {
          businessId: new Types.ObjectId(businessId),
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
            businessId: new Types.ObjectId(businessId),
            reservationId: created[0]._id as Types.ObjectId,
            reservationStart: effectiveReservationStart,
            guestCount,
            description,
          }).catch((err) => {
            console.error(
              "[reservations] sendReservationPendingFlow failed:",
              err,
            );
          });
        }

        return reply.code(201).send(created[0]);
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // GET /reservations/:reservationId - get by ID
  app.get<{ Params: ReservationIdParams }>(
    "/:reservationId",
    { schema: { params: reservationIdParamsSchema } },
    async (req, reply) => {
      const { reservationId } = req.params;

      const reservation = await Reservation.findById(reservationId).lean();

      if (!reservation) {
        throw notFound("Reservation not found!");
      }
      return reply.code(200).send(reservation);
    },
  );

  // PATCH /reservations/:reservationId - update
  app.patch<{ Params: ReservationIdParams; Body: UpdateReservationBody }>(
    "/:reservationId",
    {
      preValidation: [createAuthHook(app)],
      schema: {
        params: reservationIdParamsSchema,
        body: updateReservationBodySchema,
      },
    },
    async (req, reply) => {
      if (!req.authSession || req.authSession.type !== "user") {
        throw unauthorized("Unauthorized");
      }

      const sessionUserId = new Types.ObjectId(req.authSession.id);
      const { reservationId } = req.params;

      const {
        status,
        salesPointId,
        reservationStart,
        reservationEnd,
        guestCount,
        description,
        employeeResponsableByUserId,
        salesInstanceId,
      } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const reservation = (await Reservation.findById(reservationId)
          .session(session)
          .lean()) as unknown as (IReservation & { status?: string }) | null;

        if (!reservation) {
          throw notFound("Reservation not found!");
        }

        const isStatusOrTableChange =
          typeof status === "string" || typeof salesPointId !== "undefined";

        if (isStatusOrTableChange) {
          const effectiveRole = await getEffectiveUserRoleAtTime({
            userId: sessionUserId,
            businessId: reservation.businessId as Types.ObjectId,
            session,
          });

          if (effectiveRole !== "employee") {
            throw forbidden("Employee access required");
          }

          const employee = (await Employee.findOne({
            userId: sessionUserId,
            businessId: reservation.businessId,
          })
            .select("allEmployeeRoles onDuty")
            .session(session)
            .lean()) as {
            allEmployeeRoles?: string[];
            onDuty?: boolean;
          } | null;

          if (!employee) {
            throw forbidden("Employee not found!");
          }

          const isAllowed =
            (employee.allEmployeeRoles || []).includes("Host") ||
            managementRolesEnums.some((role) =>
              employee.allEmployeeRoles?.includes(role),
            );

          if (!isAllowed) {
            throw forbidden("Forbidden");
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
            throw notFound("SalesPoint not found for this business!");
          }
        }

        const updated: Partial<IReservation> & { status?: string } = {};

        if (typeof guestCount === "number") updated.guestCount = guestCount;
        if (description !== undefined) updated.description = description;
        if (employeeResponsableByUserId)
          updated.employeeResponsableByUserId = new Types.ObjectId(
            employeeResponsableByUserId,
          );

        if (reservationStart) updated.reservationStart = reservationStart;
        if (reservationEnd) updated.reservationEnd = reservationEnd;

        if (salesPointId)
          updated.salesPointId = new Types.ObjectId(salesPointId);
        if (salesInstanceId)
          updated.salesInstanceId = new Types.ObjectId(salesInstanceId);

        if (status) {
          const nextStatus = status as ReservationStatus;

          if (!canTransitionReservationStatus(reservation.status, nextStatus)) {
            throw badRequest(
              `Invalid status transition from ${reservation.status ?? "Pending"} to ${status}!`,
            );
          }

          if (
            status === "Seated" &&
            !salesPointId &&
            !reservation.salesPointId
          ) {
            throw badRequest("salesPointId is required to set status Seated!");
          }

          updated.status = nextStatus;

          if (
            (status === "Confirmed" ||
              status === "Cancelled" ||
              status === "NoShow") &&
            !reservation.employeeResponsableByUserId
          ) {
            updated.employeeResponsableByUserId = sessionUserId;
          }
        }

        if (salesPointId && reservation.salesInstanceId) {
          const existingSalesInstance = (await SalesInstance.findById(
            reservation.salesInstanceId,
          )
            .select(
              "dailyReferenceNumber businessId salesPointId salesInstanceStatus",
            )
            .session(session)
            .lean()) as unknown as ISalesInstance | null;

          if (!existingSalesInstance) {
            throw notFound("Linked SalesInstance not found!");
          }

          if (existingSalesInstance.salesInstanceStatus === "Closed") {
            throw conflict("Cannot move a closed SalesInstance!");
          }

          const openConflict = await pointBusyForEmployee({
            salesPointId: new Types.ObjectId(salesPointId),
            businessId: existingSalesInstance.businessId as Types.ObjectId,
            session,
            excludeSalesInstanceId: existingSalesInstance._id as Types.ObjectId,
          });

          if (openConflict) {
            throw conflict(
              "Cannot move to this salesPoint because it already has an open SalesInstance!",
            );
          }

          const moved = await SalesInstance.updateOne(
            { _id: existingSalesInstance._id },
            { $set: { salesPointId: new Types.ObjectId(salesPointId) } },
            { session },
          );

          if (moved.modifiedCount !== 1) {
            throw badRequest("SalesInstance not moved!");
          }
        }

        if (
          status === "Seated" &&
          !reservation.salesInstanceId &&
          !updated.salesInstanceId
        ) {
          const effectiveSalesPointId = salesPointId
            ? new Types.ObjectId(salesPointId)
            : (reservation.salesPointId as Types.ObjectId | undefined);

          if (!effectiveSalesPointId) {
            throw badRequest("salesPointId is required to seat a reservation!");
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
            : await createDailySalesReport(
                reservation.businessId as Types.ObjectId,
                session,
              );

          if (typeof dailyReferenceNumber === "string") {
            throw badRequest(dailyReferenceNumber);
          }

          const existingOpen = await pointBusyForEmployee({
            salesPointId: effectiveSalesPointId,
            businessId: reservation.businessId as Types.ObjectId,
            session,
          });

          if (existingOpen) {
            throw conflict(
              "SalesInstance already exists for this salesPoint and it is not closed!",
            );
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

          const created = await createSalesInstance(
            newSalesInstanceObj,
            session,
          );
          if (typeof created === "string") {
            throw badRequest(created);
          }

          const createdDoc = Array.isArray(created) ? created[0] : created;
          if (!createdDoc?._id) {
            throw badRequest("Failed to create SalesInstance!");
          }

          updated.salesInstanceId = createdDoc._id as Types.ObjectId;
        }

        const result = await Reservation.updateOne(
          { _id: reservationId },
          { $set: updated },
          { session },
        );

        if (result.modifiedCount !== 1) {
          throw badRequest("Reservation not updated!");
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
            reservationStart:
              updated.reservationStart ??
              reservation.reservationStart ??
              new Date(),
            guestCount: updated.guestCount ?? reservation.guestCount ?? 1,
            description: updated.description ?? reservation.description,
            status,
          }).catch((err) => {
            console.error(
              "[reservations] sendReservationDecisionFlow failed:",
              err,
            );
          });
        }

        return reply.code(200).send({ message: "Reservation updated!" });
      } catch (error) {
        await session.abortTransaction().catch(() => undefined);
        throw error;
      } finally {
        session.endSession();
      }
    },
  );

  // DELETE /reservations/:reservationId - delete
  app.delete<{ Params: ReservationIdParams }>(
    "/:reservationId",
    { schema: { params: reservationIdParamsSchema } },
    async (req, reply) => {
      const { reservationId } = req.params;

      const deleted = await Reservation.deleteOne({ _id: reservationId });

      if (deleted.deletedCount === 0) {
        throw notFound("Reservation not found!");
      }
      return reply.code(200).send({ message: "Reservation deleted!" });
    },
  );

  // GET /reservations/business/:businessId - get by business (with optional filters)
  app.get<{
    Params: ReservationsByBusinessParams;
    Querystring: ReservationsByBusinessQuery;
  }>(
    "/business/:businessId",
    {
      schema: {
        params: reservationsByBusinessParamsSchema,
        querystring: reservationsByBusinessQuerySchema,
      },
    },
    async (req, reply) => {
      const { businessId } = req.params;
      const { startDate, endDate, status } = req.query;

      const filter: {
        businessId: Types.ObjectId;
        reservationStart?: { $gte?: Date; $lte?: Date };
        status?: string;
      } = { businessId: new Types.ObjectId(businessId) };

      if (startDate || endDate) {
        filter.reservationStart = {};
        if (startDate) filter.reservationStart.$gte = startDate;
        if (endDate) filter.reservationStart.$lte = endDate;
        if (startDate && endDate && startDate > endDate) {
          throw badRequest(
            "Invalid date range, startDate must be before endDate!",
          );
        }
      }

      if (status) filter.status = status;

      const reservations = await Reservation.find(filter).sort({
        reservationStart: 1,
      });

      if (!reservations?.length) {
        throw notFound("No reservations found!");
      }
      return reply.code(200).send(reservations);
    },
  );
};
