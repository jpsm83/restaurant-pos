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

export type IssueSessionOptions = {
  /** Must match `User.refreshSessionVersion` / `Business.refreshSessionVersion` in DB. */
  refreshSessionVersion?: number;
};

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
  options?: IssueSessionOptions,
): { accessToken: string; user: AuthSession } {
  const accessToken = signAccessToken(app, session);
  const refreshSessionVersion = options?.refreshSessionVersion ?? 0;
  const refreshPayload: RefreshTokenPayload = {
    id: session.id,
    type: session.type,
    v: refreshSessionVersion,
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

/** `null` if the account document is missing. */
export async function readRefreshSessionVersionForAccount(
  type: "business" | "user",
  id: string,
): Promise<number | null> {
  if (type === "business") {
    const doc = (await Business.findById(id)
      .select("refreshSessionVersion")
      .lean()) as { refreshSessionVersion?: number } | null;
    if (!doc) return null;
    return doc.refreshSessionVersion ?? 0;
  }
  const doc = (await User.findById(id)
    .select("refreshSessionVersion")
    .lean()) as { refreshSessionVersion?: number } | null;
  if (!doc) return null;
  return doc.refreshSessionVersion ?? 0;
}

export function refreshTokenPayloadVersionMatchesDb(
  payload: RefreshTokenPayload,
  dbVersion: number,
): boolean {
  const tokenVersion = payload.v ?? 0;
  return tokenVersion === dbVersion;
}

export async function buildAuthUserSessionFromUserId(
  userId: string,
): Promise<AuthUser | null> {
  const user = (await User.findById(userId)
    .select("_id personalDetails.email employeeDetails emailVerified")
    .lean()) as {
    _id: unknown;
    personalDetails: { email?: string };
    employeeDetails?: unknown;
    emailVerified?: boolean;
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
    emailVerified: user.emailVerified === true,
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
    .select("_id email emailVerified")
    .lean()) as {
    _id: unknown;
    email: string;
    emailVerified?: boolean;
  } | null;
  if (!business) return null;
  return {
    id: String(business._id),
    email: business.email,
    type: "business",
    emailVerified: business.emailVerified === true,
  };
}
