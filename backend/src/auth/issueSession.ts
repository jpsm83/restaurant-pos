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
  AuthMode,
  AuthSession,
  AuthUser,
  RefreshTokenPayload,
} from "./types.ts";

export type IssueSessionOptions = {
  /** Must match `User.refreshSessionVersion` / `Business.refreshSessionVersion` in DB. */
  refreshSessionVersion?: number;
  /** Active Customer | Business mode to store on this refresh session. */
  mode?: AuthMode;
};

export type RefreshExchange =
  | { kind: "issued"; session: AuthSession; sessionId: string }
  | { kind: "invalid" }
  | { kind: "account_missing"; accountType: "user" | "business" };

type StoredRefreshSession = {
  accountId: Types.ObjectId;
  accountType: "user" | "business";
  refreshSessionVersion: number;
  mode?: AuthMode;
  expiresAt: Date;
  revoked?: boolean;
};

function normalizeMode(mode: unknown): AuthMode {
  return mode === "business" ? "business" : "customer";
}

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
  const mode = normalizeMode(
    options?.mode ?? (session.type === "user" ? session.mode : undefined),
  );
  const expiresAt = new Date(
    Date.now() + AUTH_CONFIG.COOKIE_MAX_AGE_SECONDS * 1000,
  );
  const stored = await RefreshSession.create({
    accountId: session.id,
    accountType: session.type,
    refreshSessionVersion,
    mode,
    expiresAt,
    revoked: false,
  });
  const sessionId = String(stored._id);
  const issuedSession: AuthSession =
    session.type === "user" ? { ...session, mode } : session;
  const accessToken = signAccessToken(app, issuedSession, sessionId);
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
  return { accessToken, user: issuedSession };
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
      : await buildAuthUserSessionFromUserId(
          accountId,
          normalizeMode(stored.mode),
        );
  if (!session) {
    return { kind: "account_missing", accountType: stored.accountType };
  }

  return { kind: "issued", session, sessionId: payload.sid };
}

/** Update the stored mode on one live refresh session; false when the row is gone. */
export async function setRefreshSessionMode(
  sessionId: string,
  mode: AuthMode,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(sessionId)) return false;
  const result = await RefreshSession.updateOne(
    { _id: sessionId, revoked: { $ne: true } },
    { $set: { mode } },
  );
  return result.matchedCount === 1;
}

/** Read the stored mode of one refresh session; missing rows read as Customer. */
export async function readRefreshSessionMode(
  sessionId: string,
): Promise<AuthMode> {
  if (!Types.ObjectId.isValid(sessionId)) return "customer";
  const stored = (await RefreshSession.findById(sessionId)
    .select("mode")
    .lean()) as { mode?: unknown } | null;
  return normalizeMode(stored?.mode);
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
  mode: AuthMode = "customer",
): Promise<AuthUser | null> {
  const user = (await User.findOne(
    withSoftDeleteFilter({ _id: userId }),
  )
    .select(
      "_id personalDetails.email personalDetails.emailVerified languagePreference",
    )
    .lean()) as {
    _id: unknown;
    personalDetails: { email?: string; emailVerified?: boolean };
    languagePreference?: "en" | "es";
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
    languagePreference: user.languagePreference,
    mode,
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
