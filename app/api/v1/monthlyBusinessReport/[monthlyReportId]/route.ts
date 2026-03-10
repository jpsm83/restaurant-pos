import { NextResponse } from "next/server";
import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import MonthlyBusinessReport from "@/lib/db/models/monthlyBusinessReport";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// @desc    Get monthly report by ID
// @route   GET /api/v1/monthlyBusinessReport/:monthlyReportId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { monthlyReportId: Types.ObjectId } }
) => {
  try {
    const monthlyReportId = context.params.monthlyReportId;

    if (isObjectIdValid([monthlyReportId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid monthly report ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const report = await MonthlyBusinessReport.findById(monthlyReportId).lean();

    if (!report) {
      return new NextResponse(
        JSON.stringify({ message: "Monthly report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(JSON.stringify(report), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError(
      "Get monthly business report by id failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};

// @desc    Update monthly report fixed/extra costs (manual entry). Only when isReportOpen.
// @route   PATCH /api/v1/monthlyBusinessReport/:monthlyReportId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { monthlyReportId: Types.ObjectId } }
) => {
  try {
    const monthlyReportId = context.params.monthlyReportId;

    if (isObjectIdValid([monthlyReportId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid monthly report ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let body: { totalFixedOperatingCost?: number; totalExtraCost?: number };
    try {
      body = (await req.json()) as {
        totalFixedOperatingCost?: number;
        totalExtraCost?: number;
      };
    } catch {
      return new NextResponse(
        JSON.stringify({ message: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { totalFixedOperatingCost, totalExtraCost } = body;
    if (
      totalFixedOperatingCost === undefined &&
      totalExtraCost === undefined
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Provide at least one of totalFixedOperatingCost or totalExtraCost.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const report = await MonthlyBusinessReport.findById(monthlyReportId)
      .select("isReportOpen costBreakdown")
      .lean();

    if (!report) {
      return new NextResponse(
        JSON.stringify({ message: "Monthly report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!(report as { isReportOpen?: boolean }).isReportOpen) {
      return new NextResponse(
        JSON.stringify({
          message: "Cannot update a closed monthly report.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const cost = (report as { costBreakdown?: Record<string, unknown> })
      .costBreakdown;
    const totalFoodCost = (cost?.totalFoodCost as number) ?? 0;
    const totalBeverageCost = (cost?.totalBeverageCost as number) ?? 0;
    const totalLaborCost = (cost?.totalLaborCost as number) ?? 0;
    const newFixed =
      totalFixedOperatingCost !== undefined
        ? totalFixedOperatingCost
        : ((cost?.totalFixedOperatingCost as number) ?? 0);
    const newExtra =
      totalExtraCost !== undefined
        ? totalExtraCost
        : ((cost?.totalExtraCost as number) ?? 0);

    const totalOperatingCost =
      totalFoodCost +
      totalBeverageCost +
      totalLaborCost +
      newFixed +
      newExtra;

    const foodCostRatio =
      totalOperatingCost > 0 ? totalFoodCost / totalOperatingCost : 0;
    const beverageCostRatio =
      totalOperatingCost > 0 ? totalBeverageCost / totalOperatingCost : 0;
    const laborCostRatio =
      totalOperatingCost > 0 ? totalLaborCost / totalOperatingCost : 0;
    const fixedCostRatio =
      totalOperatingCost > 0 ? newFixed / totalOperatingCost : 0;

    await MonthlyBusinessReport.updateOne(
      { _id: monthlyReportId },
      {
        $set: {
          "costBreakdown.totalFixedOperatingCost": newFixed,
          "costBreakdown.totalExtraCost": newExtra,
          "costBreakdown.totalOperatingCost": totalOperatingCost,
          "costBreakdown.costPercentages.foodCostRatio": foodCostRatio,
          "costBreakdown.costPercentages.beverageCostRatio": beverageCostRatio,
          "costBreakdown.costPercentages.laborCostRatio": laborCostRatio,
          "costBreakdown.costPercentages.fixedCostRatio": fixedCostRatio,
        },
      }
    );

    const updated = await MonthlyBusinessReport.findById(monthlyReportId).lean();
    return new NextResponse(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError(
      "Update monthly business report fixed/extra costs failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};
