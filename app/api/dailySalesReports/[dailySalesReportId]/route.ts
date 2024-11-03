import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Employee from "@/app/lib/models/employee";
import Customer from "@/app/lib/models/customer";

// @desc    Get daily report by ID
// @route   GET /dailySalesReports/:dailySalesReportId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { dailySalesReportId: Types.ObjectId } }
) => {
  try {
    const dailySalesReportId = context.params.dailySalesReportId;

    // check if the ID is valid
    if (isObjectIdValid([dailySalesReportId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid daily report ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    const dailySalesReport = await DailySalesReport.findById(dailySalesReportId)
    .populate({
      path: "employeesDailySalesReport.employeeId",
      select: "employeeName",
      model: Employee,
    })
    .populate({
      path: "selfOrderingSalesReport.customerId",
      select: "customerName",
      model: Customer,
    })
    .lean();

    return !dailySalesReport
      ? new NextResponse(
          JSON.stringify({ message: "Daily report not found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(dailySalesReport), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get daily sales report by its id failed!", error);
  }
};

// delete daily report shouldnt be allowed for data integrity and historical purtablees
// the only case where daily report should be deleted is if the business itself is deleted or report is empty
// @desc    Delete daily report
// @route   DELETE /dailySalesReports/:dailySalesReportId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { dailySalesReportId: Types.ObjectId } }
) => {
  try {
    const dailySalesReportId = context.params.dailySalesReportId;

    // check if the ID is valid
    if (isObjectIdValid([dailySalesReportId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid daily report ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // delete daily report and check if it existed
    const result = await DailySalesReport.deleteOne({
      _id: dailySalesReportId,
    });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Daily report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(`Daily report ${dailySalesReportId} deleted`, {
      status: 200,
    });
  } catch (error) {
    return handleApiError("Delete daily sales report failed!", error);
  }
};
