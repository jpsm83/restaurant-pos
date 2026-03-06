/**
 * handleApiError — Centralized API error response helper
 *
 * Builds a consistent 500 JSON error response for API routes. Keeps error
 * format and status codes uniform across the app and avoids duplicating
 * NextResponse setup in every catch block. Necessary for predictable
 * client error handling and easier logging/monitoring.
 */

import { NextResponse } from "next/server";

/**
 * Returns a NextResponse with status 500 and a JSON body containing especify and Error.
 * @param especify — Context for what failed (e.g. "Create order failed!"). Sent in the response body.
 * @param error — Message string to send in the response body.
 */
export const handleApiError = (especify: string, error: string) =>
  new NextResponse(JSON.stringify({ especify, Error: error }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
