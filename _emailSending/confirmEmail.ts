'use server';

import { confirmEmailService } from "@/lib/services/auth";

export interface ConfirmEmailResult {
  success: boolean;
  message: string;
  error?: string;
}

export default async function confirmEmailAction(
  token: string
): Promise<ConfirmEmailResult> {
  try {
    // Validate token
    if (!token || token.trim() === '') {
      return {
        success: false,
        message: "Verification token is required",
        error: "Missing token"
      };
    }

    await confirmEmailService(token);

    return {
      success: true,
      message: "Email confirmed successfully! You can now sign in to your account.",
    };
  } catch (error) {
    console.error('Confirm email action failed:', error);
    const errorMessage = error instanceof Error ? error.message : "Email confirmation failed";
    
    if (errorMessage.includes("Invalid verification token") || errorMessage.includes("Invalid token")) {
      return {
        success: false,
        message: "Invalid verification token. Please request a new confirmation link.",
        error: "Invalid token"
      };
    }
    
    if (errorMessage.includes("already verified")) {
      return {
        success: false,
        message: "Email is already verified.",
        error: "Email already verified"
      };
    }
    
    return {
      success: false,
      message: errorMessage,
      error: errorMessage
    };
  }
}
