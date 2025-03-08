import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Employee from "@/app/lib/models/employee";

// @desc   Get employee by bussiness ID
// @route  GET /employees/business/:businessId
// @access Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    if (isObjectIdValid([businessId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const employees = await Employee.find({ businessId: businessId })
      .select("-password")
      .lean();

    return !employees.length
      ? new NextResponse(
          JSON.stringify({
            message: "No employees found within the business id!",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(employees), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get employees by business id failed!", error);
  }
};
