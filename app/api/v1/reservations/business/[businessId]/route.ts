import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported models
import Reservation from "@/lib/db/models/reservation";

// @desc    Get reservations by businessId (optional filters)
// @route   GET /reservations/business/:businessId?startDate=<date>&endDate=<date>&status=<status>
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  try {
    const { businessId } = await context.params;

    if (!businessId || isObjectIdValid([businessId]) !== true) {
      return new NextResponse(JSON.stringify({ message: "Invalid businessId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    const query: {
      businessId: Types.ObjectId;
      reservationStart?: { $gte?: Date; $lte?: Date };
      status?: string;
    } = { businessId };

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

    if (status) query.status = status;

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
      "Get reservations by businessId failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

