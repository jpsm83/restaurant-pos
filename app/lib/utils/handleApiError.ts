import { NextResponse } from "next/server";

// Centralized error handling
export const handleApiError = (especify: string, error: any) =>
  new NextResponse(JSON.stringify({ Error: error }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
