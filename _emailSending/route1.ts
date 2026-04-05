import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/app/api/utils/handleApiError";
import { confirmEmailService } from "@/lib/services/auth";

// @desc    Confirm email with verification token
// @route   POST /api/v1/auth/confirm-email
// @access  Public
export const POST = async (req: NextRequest) => {
  try {
    const { token } = await req.json();

    // Validate required fields
    if (!token || token.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          message: "Verification token is required",
          error: "Missing token"
        },
        { status: 400 }
      );
    }

    try {
      await confirmEmailService(token);

      return NextResponse.json(
        {
          success: true,
          message: "Email confirmed successfully! You can now sign in to your account."
        },
        { status: 200 }
      );
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : "Unknown error";
      
      if (errorMessage.includes("Invalid verification token") || errorMessage.includes("Invalid token")) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid verification token. Please request a new confirmation link.",
            error: "Invalid token"
          },
          { status: 400 }
        );
      }
      
      if (errorMessage.includes("already verified")) {
        return NextResponse.json(
          {
            success: false,
            message: "Email is already verified.",
            error: "Email already verified"
          },
          { status: 400 }
        );
      }
      
      throw serviceError;
    }
  } catch (error) {
    console.error('Confirm email failed:', error);
    return handleApiError("Email confirmation failed!", error as string);
  }
};
