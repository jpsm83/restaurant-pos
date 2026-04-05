import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/app/api/utils/handleApiError";
import { resetPasswordService } from "@/lib/services/auth";

// @desc    Reset password with token (forgot password flow)
// @route   POST /api/v1/auth/reset-password
// @access  Public
export const POST = async (req: NextRequest) => {
  try {
    const { token, newPassword } = await req.json();

    // Validate required fields
    if (!token || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Reset token and new password are required",
          error: "Missing required fields"
        },
        { status: 400 }
      );
    }

    try {
      await resetPasswordService(token, newPassword);

      return NextResponse.json(
        {
          success: true,
          message: "Password reset successfully! You can now sign in with your new password."
        },
        { status: 200 }
      );
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : "Unknown error";
      
      if (errorMessage.includes("Invalid or expired") || errorMessage.includes("Invalid token")) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid or expired reset token. Please request a new password reset link.",
            error: "Invalid or expired token"
          },
          { status: 400 }
        );
      }
      
      if (errorMessage.includes("at least 6 characters") || errorMessage.includes("Password too short")) {
        return NextResponse.json(
          {
            success: false,
            message: "New password must be at least 6 characters long",
            error: "Password too short"
          },
          { status: 400 }
        );
      }
      
      throw serviceError;
    }
  } catch (error) {
    console.error('Reset password failed:', error);
    return handleApiError("Password reset failed!", error as string);
  }
};
