/**
 * Mint access + refresh JWTs and set refresh cookie — shared by login, signup,
 * business create/update, and user self PATCH.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import type { Types } from "mongoose";

import Business from "../models/business.ts";
import Employee from "../models/employee.ts";
import User from "../models/user.ts";
import canLogAsEmployee from "./canLogAsEmployee.ts";
import { AUTH_CONFIG } from "./config.ts";
import type {
  AuthBusiness,
  AuthSession,
  AuthUser,
  RefreshTokenPayload,
} from "./types.ts";

export function signAccessToken(
  app: FastifyInstance,
  session: AuthSession,
): string {
  return app.jwt.sign(session, {
    expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRES_IN,
  });
}

export function issueSessionWithRefreshCookie(
  app: FastifyInstance,
  reply: FastifyReply,
  session: AuthSession,
): { accessToken: string; user: AuthSession } {
  const accessToken = signAccessToken(app, session);
  const refreshPayload: RefreshTokenPayload = {
    id: session.id,
    type: session.type,
  };
  const refreshToken = app.jwt.sign(refreshPayload, {
    expiresIn: AUTH_CONFIG.REFRESH_TOKEN_EXPIRES_IN,
    key: AUTH_CONFIG.REFRESH_SECRET,
  });
  reply.setCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_CONFIG.COOKIE_MAX_AGE_SECONDS,
  });
  return { accessToken, user: session };
}

export async function buildAuthUserSessionFromUserId(
  userId: string,
): Promise<AuthUser | null> {
  const user = (await User.findById(userId)
    .select("_id personalDetails.email employeeDetails")
    .lean()) as {
    _id: unknown;
    personalDetails: { email?: string };
    employeeDetails?: unknown;
  } | null;

  if (!user) return null;

  const userEmail =
    typeof user.personalDetails.email === "string"
      ? user.personalDetails.email
      : String(user.personalDetails.email ?? "");

  const userSession: AuthUser = {
    id: String(user._id),
    email: userEmail,
    type: "user",
  };

  if (user.employeeDetails) {
    const employee = (await Employee.findById(user.employeeDetails)
      .select("businessId active terminatedDate")
      .lean()) as {
      businessId: unknown;
      active?: boolean;
      terminatedDate?: unknown;
    } | null;

    if (employee && employee.active && !employee.terminatedDate) {
      const { canLogAsEmployee: canLog } = await canLogAsEmployee(
        user.employeeDetails as Types.ObjectId,
      );
      userSession.employeeId = String(user.employeeDetails);
      userSession.businessId = String(employee.businessId);
      userSession.canLogAsEmployee = canLog;
    }
  }

  return userSession;
}

export async function buildAuthBusinessSessionFromId(
  businessId: string,
): Promise<AuthBusiness | null> {
  const business = (await Business.findById(businessId)
    .select("_id email")
    .lean()) as { _id: unknown; email: string } | null;
  if (!business) return null;
  return {
    id: String(business._id),
    email: business.email,
    type: "business",
  };
}
