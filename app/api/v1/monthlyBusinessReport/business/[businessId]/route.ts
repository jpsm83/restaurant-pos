import { NextResponse } from "next/server";
import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import MonthlyBusinessReport from "@/lib/db/models/monthlyBusinessReport";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

/**
 * Parse YYYY-MM into first day of month 00:00:00 (local).
 */
function parseMonthStart(ym: string): Date | null {
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12)
    return null;
  return new Date(y, m - 1, 1, 0, 0, 0, 0);
}

/**
 * Last day of month 23:59:59.999 for a given month start.
 */
function monthEnd(monthStart: Date): Date {
  return new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
}

// @desc    Get monthly reports by business ID, optional startMonth and endMonth (YYYY-MM)
// @route   GET /api/v1/monthlyBusinessReport/business/:businessId?startMonth=YYYY-MM&endMonth=YYYY-MM
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
    const startMonth = searchParams.get("startMonth");
    const endMonth = searchParams.get("endMonth");

    const query: { businessId: Types.ObjectId; monthReference?: { $gte: Date; $lte: Date } } = {
      businessId,
    };

    if (startMonth && endMonth) {
      const start = parseMonthStart(startMonth);
      const end = parseMonthStart(endMonth);
      if (!start || !end) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Invalid month range. Use startMonth and endMonth as YYYY-MM.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (start > monthEnd(end)) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Invalid month range, startMonth must be before or equal to endMonth.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      query.monthReference = {
        $gte: start,
        $lte: monthEnd(end),
      };
    }

    await connectDb();

    const reports = await MonthlyBusinessReport.find(query)
      .sort({ monthReference: 1 })
      .lean();

    if (!reports.length) {
      return new NextResponse(
        JSON.stringify({ message: "No monthly reports found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(JSON.stringify(reports), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError(
      "Get monthly business reports by business id failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};
