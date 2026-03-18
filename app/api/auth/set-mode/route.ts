import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const AUTH_MODE_COOKIE = "auth_mode";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * POST /api/auth/set-mode
 * Body: { mode: "customer" | "employee" }
 * Sets secure cookie and redirects: customer → /, employee → /admin.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  if (!token || token.type !== "user") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  let mode: "customer" | "employee" = "customer";
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      mode = body.mode === "employee" ? "employee" : "customer";
    } catch {
      return NextResponse.redirect(new URL("/auth/choose-mode", req.url));
    }
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
    mode = formData.get("mode") === "employee" ? "employee" : "customer";
  }
  const redirectUrl = mode === "employee" ? "/admin" : "/";

  const res = NextResponse.redirect(new URL(redirectUrl, req.url));
  res.cookies.set(AUTH_MODE_COOKIE, mode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
