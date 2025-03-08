import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Employee from "@/app/lib/models/employee";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { NextResponse } from "next/server";
import Order from "@/app/lib/models/order";
import { IEmployee } from "@/app/lib/interface/IEmployee";
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// this is called by mananger or admin after the calculateBusinessDailySalesReport been executed
// the purpose of this function is to close the daily sales report
// @desc    Close the daily sales report
// @route   PATCH /dailySalesReports/:dailySalesReportId/closeDailySalesReport
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { dailySalesReportId: Types.ObjectId } }
) => {
  try {
    const dailySalesReportId = context.params.dailySalesReportId;

    const { employeeId } = (await req.json()) as {
      employeeId: Types.ObjectId;
    };

    // check if the ID is valid
    if (isObjectIdValid([dailySalesReportId, employeeId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid dailySalesReport or employee ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Fetch the employee and daily report details in parallel to save time
    const [employee, dailySalesReport] = await Promise.all([
      Employee.findById(employeeId)
        .select("currentShiftRole onDuty businessId")
        .lean() as Promise<IEmployee>,
      DailySalesReport.findById(dailySalesReportId)
        .select("dailyReferenceNumber")
        .lean() as Promise<IDailySalesReport>,
    ]);

    // Validate the employee's role and whether they are on duty
    if (
      !employee ||
      ![
        "General Manager",
        "Manager",
        "Assistant Manager",
        "MoD",
        "Admin",
      ].includes(employee.currentShiftRole ?? "") ||
      !employee.onDuty
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "You are not allowed to close the daily sales report!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the daily sales report exists
    if (!dailySalesReport) {
      return new NextResponse(
        JSON.stringify({ message: "Daily sales report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use a single query to check if there are open orders tied to the same business and reference number
    const openOrdersExist = await Order.exists({
      businessId: employee.businessId,
      billingStatus: "Open",
      dailyReferenceNumber: dailySalesReport?.dailyReferenceNumber,
    });

    if (openOrdersExist) {
      return new NextResponse(
        JSON.stringify({
          message:
            "You can't close the daily sales because there are open orders!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Close the daily sales report in a single operation
    const updatedReport = await DailySalesReport.updateOne(dailySalesReportId, {
      $set: { isDailyReportOpen: false },
    });

    if (updatedReport.modifiedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Failed to close the daily sales report!" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Respond with success
    return new NextResponse(
      JSON.stringify({ message: "Daily sales report closed successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Failed to close daily sales report!", error);
  }
};
