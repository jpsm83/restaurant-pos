'use server';

import { getBaseUrl } from "@/lib/utils/getBaseUrl";

// Note: This action calls the API route because the route handles
// email sending after the service generates the token.

export interface RequestEmailConfirmationResult {
  success: boolean;
  message: string;
  error?: string;
}

export default async function requestEmailConfirmation(
  email: string
): Promise<RequestEmailConfirmationResult> {
  try {
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/auth/request-email-confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.message || "Failed to process email confirmation request",
        error: result.error || "Unknown error",
      };
    }

    return result;
  } catch (error) {
    console.error('Request email confirmation action failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to process email confirmation request",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
