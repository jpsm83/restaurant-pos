import { NextResponse } from "next/server";
import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import WeeklyBusinessReport from "@/lib/db/models/weeklyBusinessReport";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// @desc    Get one weekly report by ID
// @route   GET /api/v1/weeklyBusinessReport/:weeklyReportId
// @access  Private
export const GET = async (
  _req: Request,
  context: { params: { weeklyReportId: Types.ObjectId } }
) => {
  try {
    const weeklyReportId = context.params.weeklyReportId;

    if (isObjectIdValid([weeklyReportId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid weekly report ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const report = await WeeklyBusinessReport.findById(weeklyReportId).lean();

    if (!report) {
      return new NextResponse(
        JSON.stringify({ message: "Weekly report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(JSON.stringify(report), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError(
      "Get weekly business report by id failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

