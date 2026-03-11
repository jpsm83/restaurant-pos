import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_MODE_COOKIE = "auth_mode";

/**
 * Protects /admin: allows business sessions or user sessions with mode=employee (cookie).
 * Redirects unauthenticated to signin with callbackUrl=/auth/post-login.
 * Redirects user (type=user) without employee mode to /auth/choose-mode or /.
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const signInUrl = new URL("/api/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", "/auth/post-login");
    return NextResponse.redirect(signInUrl);
  }

  const type = token.type as string | undefined;

  if (type === "business") {
    return NextResponse.next();
  }

  if (type === "user") {
    const mode = req.cookies.get(AUTH_MODE_COOKIE)?.value;
    if (mode === "employee") {
      return NextResponse.next();
    }
    // User signed in but not in employee mode — send to choose-mode or home
    return NextResponse.redirect(new URL("/auth/choose-mode", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin"],
};
