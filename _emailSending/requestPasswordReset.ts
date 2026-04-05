'use server';

import { sendPasswordResetEmail } from "@/lib/services/auth";

export interface RequestPasswordResetResult {
  success: boolean;
  message: string;
  resetLink?: string;
  error?: string;
}

export default async function requestPasswordResetAction(
  email: string
): Promise<RequestPasswordResetResult> {
  try {
    const result = await sendPasswordResetEmail(email);
    return result;
  } catch (error) {
    console.error('Request password reset action failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to process password reset request",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
