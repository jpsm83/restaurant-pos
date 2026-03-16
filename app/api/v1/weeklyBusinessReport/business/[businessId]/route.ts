import { NextResponse } from "next/server";
import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import WeeklyBusinessReport from "@/lib/db/models/weeklyBusinessReport";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

function parseWeekStart(dateStr: string): Date | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

// @desc    Get weekly reports by business ID, optional startWeek and endWeek (YYYY-MM-DD)
// @route   GET /api/v1/weeklyBusinessReport/business/:businessId?startWeek=YYYY-MM-DD&endWeek=YYYY-MM-DD
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  try {
    const businessId = context.params.businessId;

    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { searchParams } = new URL(req.url);
    const startWeek = searchParams.get("startWeek");
    const endWeek = searchParams.get("endWeek");

    const query: {
      businessId: Types.ObjectId;
      weekReference?: { $gte: Date; $lte: Date };
    } = {
      businessId,
    };

    if (startWeek && endWeek) {
      const start = parseWeekStart(startWeek);
      const end = parseWeekStart(endWeek);
      if (!start || !end) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Invalid week range. Use startWeek and endWeek as YYYY-MM-DD.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (start > weekEnd(end)) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Invalid week range, startWeek must be before or equal to endWeek.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      query.weekReference = {
        $gte: start,
        $lte: weekEnd(end),
      };
    }

    await connectDb();

    const reports = await WeeklyBusinessReport.find(query)
      .sort({ weekReference: 1 })
      .lean();

    if (!reports.length) {
      return new NextResponse(
        JSON.stringify({ message: "No weekly reports found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(JSON.stringify(reports), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError(
      "Get weekly business reports by business id failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

