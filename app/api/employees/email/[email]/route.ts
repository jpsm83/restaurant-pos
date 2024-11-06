import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Employee from "@/app/lib/models/employee";

// @desc   Get employee by bussiness ID
// @route  GET /employees/email/:email
// @access Private
export const GET = async (
  req: Request,
  context: {
    params: { email: string };
  }
) => {
  try {
    const email = context.params.email;

    // validate the email

    // connect before first call to DB
    await connectDb();

    const employees = await Employee.find({ email: email })
      .select("-password")
      .lean();

    return !employees.length
      ? new NextResponse(
          JSON.stringify({
            message: "No employee found with this email!",
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
    return handleApiError("Get employee by email failed!", error);
  }
};
