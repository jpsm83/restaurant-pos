import { NextResponse } from "next/server";

// import utils
import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";

// import models
import User from "@/lib/db/models/user";
import DailySalesReport from "@/lib/db/models/dailySalesReport";

// @desc    Get all daily reports
// @route   GET /dailySalesReports
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const dailySalesReports = await DailySalesReport.find()
      .populate({
        path: "employeesDailySalesReport.userId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({
        path: "selfOrderingSalesReport.userId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
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
    return handleApiError("Get daily sales reports tables failed!", error instanceof Error ? error.message : String(error));
  }
};

// // POST request for helper funtions
// export const POST = async (req: Request) => {
//   try {
//     const employeeId = "66e92e066a5cfcc2a707696b";
//     const dailyReferenceNumber = 1726831208559;
//     const businessId = "66e169a709901431386c97cb";

//     // // @ts-ignore
//     // const result = await addEmployeeToDailySalesReport(employeeId, businessId, session);

//     // @ts-ignore
//     const result = await createDailySalesReport(businessId, session);

//     // // @ts-ignore
//     // const result = await updateEmployeesDailySalesReport([employeeId], dailyReferenceNumber);

//     return new NextResponse(JSON.stringify({ message: result }), {
//       status: 201,
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return handleApiError("Create daily sales report failed!", error);
//   }
// };
