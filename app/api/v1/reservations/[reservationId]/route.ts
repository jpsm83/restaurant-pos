import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getToken } from "next-auth/jwt";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { hasManagementRole } from "@/lib/constants";
import { createDailySalesReport } from "../../dailySalesReports/utils/createDailySalesReport";
import { createSalesInstance } from "../../salesInstances/utils/createSalesInstance";

// imported interfaces
import { IReservation } from "@shared/interfaces/IReservation";
import { ISalesInstance } from "@shared/interfaces/ISalesInstance";
import { IDailySalesReport } from "@shared/interfaces/IDailySalesReport";

// imported models
import Reservation from "@/lib/db/models/reservation";
import Employee from "@/lib/db/models/employee";
import SalesPoint from "@/lib/db/models/salesPoint";
import SalesInstance from "@/lib/db/models/salesInstance";
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import { sendReservationDecisionFlow } from "@/lib/reservations/sendReservationCustomerFlow";

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

  // terminal states
  if (["Cancelled", "NoShow", "Completed"].includes(current)) return false;

  if (current === nextStatus) return true;

  const allowed: Record<
    (typeof RESERVATION_STATUS_VALUES)[number],
    (typeof RESERVATION_STATUS_VALUES)[number][]
  > = {
    Pending: ["Confirmed", "Cancelled"],
    Confirmed: ["Arrived", "Cancelled", "NoShow"],
    Arrived: ["Seated", "Cancelled", "NoShow"],
    Seated: [], // becomes Completed via SalesInstance close
    Cancelled: [],
    NoShow: [],
    Completed: [],
  };

  return allowed[current]?.includes(nextStatus) ?? false;
};

// @desc    Get reservation by id
// @route   GET /reservations/:reservationId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { reservationId: Types.ObjectId } }
) => {
  try {
    const { reservationId } = await context.params;

    if (!reservationId || isObjectIdValid([reservationId]) !== true) {
      return new NextResponse(JSON.stringify({ message: "Invalid reservationId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDb();
    const reservation = await Reservation.findById(reservationId).lean();

    return !reservation
      ? new NextResponse(JSON.stringify({ message: "Reservation not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(reservation), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError(
      "Get reservation by id failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

// @desc    Update reservation fields / lifecycle
// @route   PATCH /reservations/:reservationId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { reservationId: Types.ObjectId } }
) => {
  const token = await getToken({
    req: req as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.id || token.type !== "user") {
    return new NextResponse(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionUserId = new Types.ObjectId(token.id as string);
  const { reservationId } = await context.params;

  const {
    status,
    salesPointId,
    reservationStart,
    reservationEnd,
    guestCount,
    description,
    employeeResponsableByUserId,
    salesInstanceId,
  } = (await req.json()) as Partial<IReservation>;

  const idsToValidate: (Types.ObjectId | string)[] = [reservationId];
  if (salesPointId) idsToValidate.push(salesPointId);
  if (employeeResponsableByUserId) idsToValidate.push(employeeResponsableByUserId);
  if (salesInstanceId) idsToValidate.push(salesInstanceId);

  if (isObjectIdValid(idsToValidate as Types.ObjectId[]) !== true) {
    return new NextResponse(JSON.stringify({ message: "Invalid IDs!" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (status && !isReservationStatus(status)) {
    return new NextResponse(JSON.stringify({ message: "Invalid status value!" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const reservation = (await Reservation.findById(reservationId)
      .session(session)
      .lean()) as unknown as (IReservation & { status?: string }) | null;

    if (!reservation) {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: "Reservation not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const previousStatus = reservation.status ?? "Pending";

    // Permissions: status changes and salesPoint assignment are staff-only (management or host).
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
        return new NextResponse(JSON.stringify({ message: "Employee not found!" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const isAllowed =
        (employee.allEmployeeRoles || []).includes("Host") ||
        hasManagementRole(employee.allEmployeeRoles || []);

      if (!isAllowed) {
        await session.abortTransaction();
        return new NextResponse(JSON.stringify({ message: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Validate salesPoint (same business) if provided.
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
        return new NextResponse(JSON.stringify({ message: "SalesPoint not found for this business!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
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
        return new NextResponse(
          JSON.stringify({
            message: `Invalid status transition from ${reservation.status ?? "Pending"} to ${status}!`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (status === "Seated" && !salesPointId && !reservation.salesPointId) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message: "salesPointId is required to set status Seated!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      updated.status = status;

      // When staff makes a decision, record handler if not set.
      if (
        (status === "Confirmed" || status === "Cancelled" || status === "NoShow") &&
        !reservation.employeeResponsableByUserId
      ) {
        updated.employeeResponsableByUserId = sessionUserId;
      }
    }

    // If staff assigns/moves the reservation salesPoint and we already have a salesInstance,
    // keep the salesInstance in sync (simple, atomic).
    if (salesPointId && reservation.salesInstanceId) {
      const existingSalesInstance = (await SalesInstance.findById(
        reservation.salesInstanceId
      )
        .select("dailyReferenceNumber businessId salesPointId salesInstanceStatus")
        .session(session)
        .lean()) as unknown as ISalesInstance | null;

      if (!existingSalesInstance) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Linked SalesInstance not found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      if (existingSalesInstance.salesInstanceStatus === "Closed") {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Cannot move a closed SalesInstance!" }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
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
        return new NextResponse(
          JSON.stringify({
            message:
              "Cannot move to this salesPoint because it already has an open SalesInstance!",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      const moved = await SalesInstance.updateOne(
        { _id: existingSalesInstance._id },
        { $set: { salesPointId } },
        { session }
      );

      if (moved.modifiedCount !== 1) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "SalesInstance not moved!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Seating flow: if status is being set to Seated and no salesInstance exists yet,
    // create a SalesInstance and store it on the reservation (reservationId on SalesInstance is set on first order).
    if (
      status === "Seated" &&
      !reservation.salesInstanceId &&
      !updated.salesInstanceId
    ) {
      const effectiveSalesPointId =
        salesPointId ?? (reservation.salesPointId as Types.ObjectId | undefined);

      if (!effectiveSalesPointId) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "salesPointId is required to seat a reservation!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
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
        : await createDailySalesReport(reservation.businessId, session);

      if (typeof dailyReferenceNumber === "string") {
        await session.abortTransaction();
        return new NextResponse(JSON.stringify({ message: dailyReferenceNumber }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const existingOpen = await SalesInstance.exists({
        dailyReferenceNumber,
        businessId: reservation.businessId,
        salesPointId: effectiveSalesPointId,
        salesInstanceStatus: { $ne: "Closed" },
      }).session(session);

      if (existingOpen) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message:
              "SalesInstance already exists for this salesPoint and it is not closed!",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      const newSalesInstanceObj: ISalesInstance = {
        dailyReferenceNumber,
        salesPointId: effectiveSalesPointId,
        guests: reservation.guestCount,
        salesInstanceStatus: "Reserved",
        openedByUserId: sessionUserId,
        openedAsRole: "employee",
        businessId: reservation.businessId,
        clientName: reservation.description,
      };

      const created = await createSalesInstance(newSalesInstanceObj, session);
      if (typeof created === "string") {
        await session.abortTransaction();
        return new NextResponse(JSON.stringify({ message: created }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const createdDoc = Array.isArray(created) ? created[0] : created;
      if (!createdDoc?._id) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Failed to create SalesInstance!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
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
      return new NextResponse(JSON.stringify({ message: "Reservation not updated!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await session.commitTransaction();

    // Decision notification/email for customer-created reservations (fire-and-forget).
    if (
      reservation.createdByRole === "customer" &&
      previousStatus === "Pending" &&
      (updated.status === "Confirmed" || updated.status === "Cancelled")
    ) {
      sendReservationDecisionFlow({
        userId: reservation.createdByUserId,
        businessId: reservation.businessId,
        reservationId: reservationId as unknown as Types.ObjectId,
        reservationStart: reservation.reservationStart,
        guestCount: reservation.guestCount,
        description: reservation.description,
        status: updated.status,
      }).catch(() => {});
    }

    return new NextResponse(JSON.stringify({ message: "Reservation updated!" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    await session.abortTransaction();
    return handleApiError(
      "Update reservation failed!",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    session.endSession();
  }
};

// @desc    Delete reservation (or cancel)
// @route   DELETE /reservations/:reservationId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { reservationId: Types.ObjectId } }
) => {
  try {
    const { reservationId } = await context.params;

    if (!reservationId || isObjectIdValid([reservationId]) !== true) {
      return new NextResponse(JSON.stringify({ message: "Invalid reservationId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDb();
    const deleted = await Reservation.deleteOne({ _id: reservationId });

    return deleted.deletedCount === 0
      ? new NextResponse(JSON.stringify({ message: "Reservation not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify({ message: "Reservation deleted!" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError(
      "Delete reservation failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

