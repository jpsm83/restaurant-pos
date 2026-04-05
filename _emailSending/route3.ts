import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/app/api/utils/handleApiError";
import { sendPasswordResetEmail } from "@/lib/services/auth";

// @desc    Send forgot password email
// @route   POST /api/v1/auth/request-password-reset
// @access  Public
export const POST = async (req: NextRequest) => {
  try {
    const { email } = await req.json();

    // Validate required fields
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email address",
          error: "Invalid email format"
        },
        { status: 400 }
      );
    }

    try {
      const result = await sendPasswordResetEmail(email);
      return NextResponse.json(result, { status: 200 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send password reset email";
      
      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
          error: errorMessage
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Request password reset failed:', error);
    return handleApiError("Request password reset failed!", error as string);
  }
};
