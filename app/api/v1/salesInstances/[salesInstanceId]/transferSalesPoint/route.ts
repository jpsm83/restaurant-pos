import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getToken } from "next-auth/jwt";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported models
import SalesInstance from "@/lib/db/models/salesInstance";
import SalesPoint from "@/lib/db/models/salesPoint";
import Reservation from "@/lib/db/models/reservation";
import Employee from "@/lib/db/models/employee";
import { hasManagementRole } from "@/lib/constants";

// @desc    Transfer a salesInstance to another salesPoint (table move)
// @route   PATCH /salesInstances/:salesInstanceId/transferSalesPoint
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { salesInstanceId: Types.ObjectId } }
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

  const { salesInstanceId } = await context.params;
  const { salesPointId } = (await req.json()) as { salesPointId: Types.ObjectId };

  if (!salesPointId) {
    return new NextResponse(
      JSON.stringify({ message: "salesPointId is required!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (isObjectIdValid([salesInstanceId, salesPointId]) !== true) {
    return new NextResponse(JSON.stringify({ message: "Invalid IDs!" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const salesInstance = (await SalesInstance.findById(salesInstanceId)
      .select(
        "businessId dailyReferenceNumber salesInstanceStatus salesPointId reservationId"
      )
      .session(session)
      .lean()) as unknown as {
      _id: Types.ObjectId;
      businessId: Types.ObjectId;
      dailyReferenceNumber: number;
      salesInstanceStatus: string;
      salesPointId: Types.ObjectId;
      reservationId?: Types.ObjectId;
    } | null;

    if (!salesInstance) {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: "SalesInstance not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (salesInstance.salesInstanceStatus === "Closed") {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: "SalesInstance is closed!" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Permission: allow Host or management.
    const employee = (await Employee.findOne({
      userId: sessionUserId,
      businessId: salesInstance.businessId,
    })
      .select("allEmployeeRoles")
      .session(session)
      .lean()) as unknown as { allEmployeeRoles?: string[] } | null;

    const isAllowed =
      (employee?.allEmployeeRoles || []).includes("Host") ||
      hasManagementRole(employee?.allEmployeeRoles);

    if (!isAllowed) {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate target salesPoint belongs to same business
    const sp = await SalesPoint.exists({
      _id: salesPointId,
      businessId: salesInstance.businessId,
    }).session(session);
    if (!sp) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "SalesPoint not found for this business!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure target doesn't already have an open instance
    const openConflict = await SalesInstance.exists({
      _id: { $ne: salesInstanceId },
      dailyReferenceNumber: salesInstance.dailyReferenceNumber,
      businessId: salesInstance.businessId,
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
      { _id: salesInstanceId },
      { $set: { salesPointId } },
      { session }
    );

    if (moved.modifiedCount !== 1) {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: "SalesInstance not moved!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If there's a reservation linked (via reservationId OR via reservation.salesInstanceId),
    // keep reservation.salesPointId in sync.
    const reservation =
      (await Reservation.findOne({
        $or: [
          { salesInstanceId: salesInstanceId },
          { _id: salesInstance.reservationId },
        ],
      })
        .select("_id status")
        .session(session)
        .lean()) as { _id: Types.ObjectId; status?: string } | null;

    if (reservation) {
      await Reservation.updateOne(
        { _id: reservation._id },
        { $set: { salesPointId } },
        { session }
      );
    }

    await session.commitTransaction();
    return new NextResponse(
      JSON.stringify({ message: "SalesInstance transferred successfully!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError(
      "Transfer SalesInstance salesPoint failed!",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    session.endSession();
  }
};

