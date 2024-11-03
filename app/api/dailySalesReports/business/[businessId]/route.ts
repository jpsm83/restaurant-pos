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

// @desc    Get daily reports by business ID, startDate and endDate
// @route   GET /dailySalesReports/business/:businessId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    // check if the ID is valid
    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // date and time will como from the front as ex: "2023-04-01T15:00:00", you can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

    // Parse query parameters for optional date range
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Convert date string to date object at the start of the day in UTC
    const startOfDay = startDate
      ? new Date(startDate.split("T")[0] + "T00:00:00.000Z")
      : null;

    const endOfDay = endDate
      ? new Date(endDate.split("T")[0] + "T23:59:59.999Z")
      : null;

    // Build query based on the presence of startDate and endDate
    let query: {
      businessId: Types.ObjectId;
      createdAt?: { $gte?: Date | null; $lte?: Date | null };
    } = { businessId: businessId };

    if (startDate && endDate) {
      if (startDate > endDate) {
        return new NextResponse(
          JSON.stringify({
            message: "Invalid date range, start date must be before end date!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      query.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    // connect before first call to DB
    await connectDb();

    // fetch daily reports with the given business ID and date
    const dailySalesReports = await DailySalesReport.find(query)
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

    return !dailySalesReports.length
      ? new NextResponse(
          JSON.stringify({ message: "No daily reports found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(dailySalesReports), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError(
      "Get daily sales report by business id failed!",
      error
    );
  }
};
