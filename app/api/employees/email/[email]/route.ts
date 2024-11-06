import { NextResponse } from "next/server";
import Employee from "@/app/lib/models/employee";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import connectDb from "@/app/lib/utils/connectDb";

// @desc   Get employee by email
// @route  GET /api/employees/email/:email
// @access Private
export const GET = async (
  req: Request,
  context: { params: { email: string } }
) => {
  try {
    const email = context.params.email;

    // Validate the email
    if (!email) {
      return new NextResponse(
        JSON.stringify({
          message: "Email parameter is required!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Connect to the database
    await connectDb();

    // Find the employee by email
    const employee = await Employee.findOne({ email })
      .select("-password")
      .lean();

    if (!employee) {
      return new NextResponse(
        JSON.stringify({
          message: "No employee found with this email!",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new NextResponse(JSON.stringify(employee), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return handleApiError("Get employee by email failed!", error);
  }
};
