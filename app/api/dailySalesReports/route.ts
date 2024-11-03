import { NextResponse } from "next/server";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { addEmployeeToDailySalesReport } from "./utils/addEmployeeToDailySalesReport";
import { createDailySalesReport } from "./utils/createDailySalesReport";
import { updateEmployeesDailySalesReport } from "./utils/updateEmployeeDailySalesReport";

// import models
import Employee from "@/app/lib/models/employee";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Customer from "@/app/lib/models/customer";

// @desc    Get all daily reports
// @route   GET /dailySalesReports
// @access  Private
export const GET = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDb();

    const dailySalesReports = await DailySalesReport.find()
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
    return handleApiError("Get daily sales reports tables failed!", error);
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
