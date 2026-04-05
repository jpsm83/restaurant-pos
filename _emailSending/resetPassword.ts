'use server';

import { resetPasswordService } from "@/lib/services/auth";

export interface ResetPasswordResult {
  success: boolean;
  message: string;
  error?: string;
}

export default async function resetPassword(
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  try {
    await resetPasswordService(token, newPassword);

    return {
      success: true,
      message: "Password reset successfully! You can now sign in with your new password.",
    };
  } catch (error) {
    console.error('Reset password action failed:', error);
    const errorMessage = error instanceof Error ? error.message : "Password reset failed";
    
    if (errorMessage.includes("Invalid or expired") || errorMessage.includes("Invalid token")) {
      return {
        success: false,
        message: "Invalid or expired reset token. Please request a new password reset link.",
        error: "Invalid or expired token"
      };
    }
    
    if (errorMessage.includes("at least 6 characters") || errorMessage.includes("Password too short")) {
      return {
        success: false,
        message: "New password must be at least 6 characters long",
        error: "Password too short"
      };
    }
    
    return {
      success: false,
      message: errorMessage,
      error: errorMessage
    };
  }
}
