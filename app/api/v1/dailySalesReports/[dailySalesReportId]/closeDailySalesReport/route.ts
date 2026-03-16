import { Types } from "mongoose";
import { getToken } from "next-auth/jwt";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { MANAGEMENT_ROLES } from "@/lib/constants";

// imported models
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import Employee from "@/lib/db/models/employee";
import Order from "@/lib/db/models/order";
import { IEmployee } from "@/lib/interface/IEmployee";
import { IDailySalesReport } from "@/lib/interface/IDailySalesReport";
import { NextResponse } from "next/server";

// this is called by manager or admin after the calculateBusinessDailySalesReport been executed
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

    const token = await getToken({
      req: req as Parameters<typeof getToken>[0]["req"],
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token?.id || token.type !== "user") {
      return new NextResponse(
        JSON.stringify({ message: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    const userId = new Types.ObjectId(token.id as string);

    if (isObjectIdValid([dailySalesReportId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid dailySalesReport ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const dailyReport = (await DailySalesReport.findById(dailySalesReportId)
      .select("dailyReferenceNumber businessId")
      .lean()) as IDailySalesReport | null;

    if (!dailyReport) {
      return new NextResponse(
        JSON.stringify({ message: "Daily sales report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const businessId =
      typeof dailyReport.businessId === "object" && dailyReport.businessId !== null && "_id" in dailyReport.businessId
        ? (dailyReport.businessId as { _id: Types.ObjectId })._id
        : (dailyReport.businessId as Types.ObjectId);

    const employeeDoc = (await Employee.findOne({
      userId,
      businessId,
    })
      .select("currentShiftRole businessId")
      .lean()) as IEmployee | null;

    if (
      !employeeDoc ||
      !MANAGEMENT_ROLES.includes(employeeDoc.currentShiftRole ?? "")
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "You are not allowed to close the daily sales report!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const openOrdersExist = await Order.exists({
      businessId: employeeDoc.businessId,
      billingStatus: "Open",
      dailyReferenceNumber: dailyReport.dailyReferenceNumber,
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

    const updatedReport = await DailySalesReport.updateOne(
      { _id: dailySalesReportId },
      { $set: { isDailyReportOpen: false } }
    );

    if (updatedReport.modifiedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Failed to close the daily sales report!" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "Daily sales report closed successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Failed to close daily sales report!", error instanceof Error ? error.message : String(error));
  }
};
