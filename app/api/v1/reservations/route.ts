import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getToken } from "next-auth/jwt";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported interfaces
import { IReservation } from "@shared/interfaces/IReservation";

// imported models
import Reservation from "@/lib/db/models/reservation";
import Employee from "@/lib/db/models/employee";
import { sendReservationPendingFlow } from "@/lib/reservations/sendReservationCustomerFlow";

// @desc    Get all reservations (optional filters)
// @route   GET /reservations?businessId=<id>&startDate=<date>&endDate=<date>&status=<status>
// @access  Private
export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    const query: {
      businessId?: Types.ObjectId;
      reservationStart?: { $gte?: Date; $lte?: Date };
      status?: string;
    } = {};

    if (businessId) {
      if (isObjectIdValid([businessId]) !== true) {
        return new NextResponse(
          JSON.stringify({ message: "Invalid businessId!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      query.businessId = new Types.ObjectId(businessId);
    }

    if (startDate || endDate) {
      query.reservationStart = {};
      if (startDate) query.reservationStart.$gte = new Date(startDate);
      if (endDate) query.reservationStart.$lte = new Date(endDate);
      if (startDate && endDate && startDate > endDate) {
        return new NextResponse(
          JSON.stringify({
            message: "Invalid date range, startDate must be before endDate!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (status) {
      query.status = status;
    }

    await connectDb();

    const reservations = await Reservation.find(query).sort({
      reservationStart: 1,
    });

    return !reservations?.length
      ? new NextResponse(JSON.stringify({ message: "No reservations found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(reservations), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError(
      "Get all reservations failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

// @desc    Create a reservation (customer or staff)
// @route   POST /reservations
// @access  Private
export const POST = async (req: Request) => {
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

  const createdByUserId = new Types.ObjectId(token.id as string);

  const {
    businessId,
    guestCount,
    reservationStart,
    reservationEnd,
    description,
  } = (await req.json()) as Partial<IReservation>;

  if (!businessId || !guestCount || !reservationStart) {
    return new NextResponse(
      JSON.stringify({
        message: "businessId, guestCount and reservationStart are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const idsToValidate = [businessId];
  if (isObjectIdValid(idsToValidate) !== true) {
    return new NextResponse(JSON.stringify({ message: "Invalid IDs!" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Determine whether creator is an on-duty employee for this business.
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
      return new NextResponse(
        JSON.stringify({
          message: "reservationEnd must be after reservationStart!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Conflict detection (avoid overlapping reservations for the same table if later assigned).
    // For now, since overbooking is controlled by managers, we only enforce conflicts when a reservation is created with an explicit salesPointId (not part of current POST body).

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

    // Customer-created reservations trigger pending notifications/email (fire-and-forget).
    if (createdByRole === "customer") {
      const createdReservation = created[0];
      sendReservationPendingFlow({
        userId: createdByUserId,
        businessId,
        reservationId: createdReservation._id,
        reservationStart: createdReservation.reservationStart,
        guestCount: createdReservation.guestCount,
        description: createdReservation.description,
      }).catch(() => {});
    }

    return new NextResponse(JSON.stringify(created[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    await session.abortTransaction();
    return handleApiError(
      "Create reservation failed!",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    session.endSession();
  }
};

