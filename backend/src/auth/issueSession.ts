/**
 * Issue, exchange, and revoke one stored refresh session.
 * Issuance mints the access token and sets the refresh cookie — shared by
 * login, signup, business create/update, and user self PATCH.
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { Types } from "mongoose";

import Business from "../models/business.ts";
import RefreshSession from "../models/refreshSession.ts";
import User from "../models/user.ts";
import { withSoftDeleteFilter } from "../models/softDelete.ts";
import canLogAsEmployee from "./canLogAsEmployee.ts";
import findActiveEmployeeMembership from "./employeeMembership.ts";
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

export type RefreshExchange =
  | { kind: "issued"; session: AuthSession; sessionId: string }
  | { kind: "invalid" }
  | { kind: "account_missing"; accountType: "user" | "business" };

type StoredRefreshSession = {
  accountId: Types.ObjectId;
  accountType: "user" | "business";
  refreshSessionVersion: number;
  expiresAt: Date;
  revoked?: boolean;
};

export function signAccessToken(
  app: FastifyInstance,
  session: AuthSession,
  sessionId: string,
): string {
  return app.jwt.sign(
    { ...session, sessionId },
    { expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRES_IN },
  );
}

export async function issueSessionWithRefreshCookie(
  app: FastifyInstance,
  reply: FastifyReply,
  session: AuthSession,
  options?: IssueSessionOptions,
): Promise<{ accessToken: string; user: AuthSession }> {
  const refreshSessionVersion = options?.refreshSessionVersion ?? 0;
  const expiresAt = new Date(
    Date.now() + AUTH_CONFIG.COOKIE_MAX_AGE_SECONDS * 1000,
  );
  const stored = await RefreshSession.create({
    accountId: session.id,
    accountType: session.type,
    refreshSessionVersion,
    expiresAt,
    revoked: false,
  });
  const sessionId = String(stored._id);
  const accessToken = signAccessToken(app, session, sessionId);
  const refreshPayload: RefreshTokenPayload = { sid: sessionId };
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

/**
 * Mint a new access token for a live refresh session.
 * A missing row, a bad cookie, revocation, expiry, or a generation mismatch
 * is `invalid`. A gone account is `account_missing`.
 */
export async function exchangeRefreshSession(
  app: FastifyInstance,
  refreshToken: string,
): Promise<RefreshExchange> {
  let payload: RefreshTokenPayload;
  try {
    payload = app.jwt.verify<RefreshTokenPayload>(refreshToken, {
      key: AUTH_CONFIG.REFRESH_SECRET,
    });
  } catch {
    return { kind: "invalid" };
  }

  if (!payload.sid || !Types.ObjectId.isValid(payload.sid)) {
    return { kind: "invalid" };
  }

  const stored = (await RefreshSession.findById(payload.sid).lean()) as
    | StoredRefreshSession
    | null;
  if (
    !stored ||
    stored.revoked === true ||
    stored.expiresAt.getTime() <= Date.now()
  ) {
    return { kind: "invalid" };
  }

  const accountId = String(stored.accountId);
  const dbVersion = await readRefreshSessionVersionForAccount(
    stored.accountType,
    accountId,
  );
  if (dbVersion === null) {
    return { kind: "account_missing", accountType: stored.accountType };
  }
  if (stored.refreshSessionVersion !== dbVersion) {
    return { kind: "invalid" };
  }

  const session =
    stored.accountType === "business"
      ? await buildAuthBusinessSessionFromId(accountId)
      : await buildAuthUserSessionFromUserId(accountId);
  if (!session) {
    return { kind: "account_missing", accountType: stored.accountType };
  }

  return { kind: "issued", session, sessionId: payload.sid };
}

/**
 * Revoke the one refresh session the cookie identifies.
 * A missing or unreadable cookie leaves every session as it is.
 */
export async function revokePresentedRefreshSession(
  app: FastifyInstance,
  refreshToken: string | undefined,
): Promise<void> {
  if (!refreshToken) return;

  let payload: RefreshTokenPayload;
  try {
    payload = app.jwt.verify<RefreshTokenPayload>(refreshToken, {
      key: AUTH_CONFIG.REFRESH_SECRET,
    });
  } catch {
    return;
  }

  if (!payload.sid || !Types.ObjectId.isValid(payload.sid)) return;

  await RefreshSession.updateOne(
    { _id: payload.sid },
    { $set: { revoked: true } },
  );
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
  const doc = (await User.findOne(
    withSoftDeleteFilter({ _id: id }),
  )
    .select("refreshSessionVersion")
    .lean()) as { refreshSessionVersion?: number } | null;
  if (!doc) return null;
  return doc.refreshSessionVersion ?? 0;
}

export async function buildAuthUserSessionFromUserId(
  userId: string,
): Promise<AuthUser | null> {
  const user = (await User.findOne(
    withSoftDeleteFilter({ _id: userId }),
  )
    .select("_id personalDetails.email personalDetails.emailVerified")
    .lean()) as {
    _id: unknown;
    personalDetails: { email?: string; emailVerified?: boolean };
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
    emailVerified: user.personalDetails?.emailVerified === true,
    role: "Customer",
  };

  const employee = await findActiveEmployeeMembership({ userId });
  if (employee) {
    const { canLogAsEmployee: canLog } = await canLogAsEmployee(employee._id);
    userSession.employeeId = String(employee._id);
    userSession.businessId = String(employee.businessId);
    userSession.canLogAsEmployee = canLog;
    const primaryRole = employee.allEmployeeRoles?.[0];
    userSession.role =
      typeof primaryRole === "string" && primaryRole.trim()
        ? primaryRole
        : "Employee";
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
    role: "Tenant",
  };
}
