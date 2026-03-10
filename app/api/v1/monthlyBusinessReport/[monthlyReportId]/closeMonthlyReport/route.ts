import { NextResponse } from "next/server";
import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import Employee from "@/lib/db/models/employee";
import MonthlyBusinessReport from "@/lib/db/models/monthlyBusinessReport";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { IEmployee } from "@/lib/interface/IEmployee";

const ALLOWED_CLOSE_ROLES = [
  "General Manager",
  "Manager",
  "Assistant Manager",
  "MoD",
  "Admin",
];

function getMonthEnd(monthStart: Date): Date {
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

// @desc    Close the monthly business report
// @route   PATCH /api/v1/monthlyBusinessReport/:monthlyReportId/closeMonthlyReport
// @access  Private (manager only)
export const PATCH = async (
  req: Request,
  context: { params: { monthlyReportId: Types.ObjectId } }
) => {
  try {
    const monthlyReportId = context.params.monthlyReportId;

    let body: { employeeId: Types.ObjectId };
    try {
      body = (await req.json()) as { employeeId: Types.ObjectId };
    } catch {
      return new NextResponse(
        JSON.stringify({ message: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { employeeId } = body;
    if (!monthlyReportId || !employeeId) {
      return new NextResponse(
        JSON.stringify({
          message: "monthlyReportId and employeeId are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (isObjectIdValid([monthlyReportId, employeeId]) !== true) {
      return new NextResponse(
        JSON.stringify({
          message: "Invalid monthly report or employee ID!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const [employee, report] = await Promise.all([
      Employee.findById(employeeId)
        .select("currentShiftRole onDuty businessId")
        .lean() as Promise<IEmployee | null>,
      MonthlyBusinessReport.findById(monthlyReportId)
        .select("businessId monthReference isReportOpen")
        .lean(),
    ]);

    if (!employee) {
      return new NextResponse(
        JSON.stringify({ message: "Employee not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      !ALLOWED_CLOSE_ROLES.includes(employee.currentShiftRole ?? "") ||
      !employee.onDuty
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "You are not allowed to close the monthly business report!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!report) {
      return new NextResponse(
        JSON.stringify({ message: "Monthly report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const reportDoc = report as unknown as {
      businessId: Types.ObjectId;
      monthReference: Date;
      isReportOpen?: boolean;
    };
    const reportBusinessId = reportDoc.businessId;
    if (
      employee.businessId?.toString() !== reportBusinessId?.toString?.()
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "Monthly report does not belong to your business!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!reportDoc.isReportOpen) {
      return new NextResponse(
        JSON.stringify({ message: "Monthly report is already closed!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const monthStart =
      reportDoc.monthReference instanceof Date
        ? reportDoc.monthReference
        : new Date(reportDoc.monthReference);
    const monthEnd = getMonthEnd(monthStart);

    const openDailyInMonth = await DailySalesReport.exists({
      businessId: reportBusinessId,
      createdAt: { $gte: monthStart, $lte: monthEnd },
      isDailyReportOpen: true,
    });

    if (openDailyInMonth) {
      return new NextResponse(
        JSON.stringify({
          message:
            "You cannot close the monthly report while there are open daily reports in this month. Close all daily reports for this month first.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const updated = await MonthlyBusinessReport.updateOne(
      { _id: monthlyReportId },
      { $set: { isReportOpen: false } }
    );

    if (updated.modifiedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Failed to close the monthly report!" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "Monthly business report closed successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Failed to close monthly business report!",
      error instanceof Error ? error.message : String(error)
    );
  }
};
