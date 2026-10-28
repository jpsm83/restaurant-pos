/**
 * Auth Middleware - Request authentication and authorization helpers
 *
 * Provides preValidation hooks for protecting routes and extracting user info.
 */

import type {
  FastifyRequest,
  FastifyInstance,
  preValidationHookHandler,
} from "fastify";
import { Types } from "mongoose";
import { AppError, forbidden, unauthorized } from "../errors/appError.ts";
import Business from "../models/business.ts";
import RefreshSession from "../models/refreshSession.ts";
import User from "../models/user.ts";
import type { AuthSession, AuthUser } from "./types.ts";

declare module "fastify" {
  interface FastifyRequest {
    authSession?: AuthSession;
  }
}

/** JWT and deleted-account refusals. Database and other failures must not look like a bad token. */
export function isRejectedCredential(error: unknown): boolean {
  if (error instanceof AppError && error.statusCode === 401) {
    return true;
  }
  if (error instanceof Error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError" ||
      error.name === "TokenError"
    ) {
      return true;
    }
  }
  const candidate = error as { statusCode?: unknown; code?: unknown } | null;
  if (candidate?.statusCode === 401) {
    return true;
  }
  return (
    typeof candidate?.code === "string" &&
    (candidate.code.startsWith("FST_JWT") ||
      candidate.code.startsWith("FAST_JWT"))
  );
}

/**
 * Creates an authentication hook that verifies the JWT access token
 * and attaches the decoded user to request.user.
 */
export function createAuthHook(app: FastifyInstance): preValidationHookHandler {
  return async (req: FastifyRequest) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw unauthorized("Authentication required");
    }

    const token = authHeader.slice(7);

    try {
      req.authSession = await requireLiveAccessSession(app, token);
    } catch (error) {
      if (isRejectedCredential(error)) {
        throw unauthorized("Invalid or expired access token");
      }
      throw error;
    }
  };
}

/**
 * Creates an optional authentication hook that attempts to verify the JWT
 * but allows the request to proceed even if no token is provided.
 * Sets request.user if a valid token is present.
 */
export function createOptionalAuthHook(
  app: FastifyInstance,
): preValidationHookHandler {
  return async (req: FastifyRequest) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return;
    }

    const token = authHeader.slice(7);

    try {
      req.authSession = await requireLiveAccessSession(app, token);
    } catch (error) {
      if (isRejectedCredential(error)) {
        return;
      }
      throw error;
    }
  };
}

/**
 * An access token is live only when its refresh session exists, is unrevoked,
 * is unexpired, and — when that account row exists — matches the account
 * generation. A token with no session id is refused. This does not apply the
 * deleted-account check; callers that already do keep doing so.
 */
export async function assertAccessTokenRefreshSessionLive(
  session: AuthSession & { sessionId?: string },
): Promise<void> {
  const sessionId = session.sessionId;
  if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
    throw unauthorized("Invalid or expired access token");
  }

  const stored = (await RefreshSession.findById(sessionId).lean()) as {
    accountId: Types.ObjectId;
    accountType: "user" | "business";
    refreshSessionVersion: number;
    expiresAt: Date;
    revoked?: boolean;
  } | null;
  if (
    !stored ||
    stored.revoked === true ||
    stored.expiresAt.getTime() <= Date.now() ||
    stored.accountType !== session.type ||
    String(stored.accountId) !== session.id
  ) {
    throw unauthorized("Invalid or expired access token");
  }

  const dbVersion = await accountGenerationIfRowExists(
    session.type,
    session.id,
  );
  if (dbVersion !== null && stored.refreshSessionVersion !== dbVersion) {
    throw unauthorized("Invalid or expired access token");
  }
}

/** `null` when no account document exists, including a hard-deleted row. Soft-deleted rows still count. */
async function accountGenerationIfRowExists(
  type: "user" | "business",
  id: string,
): Promise<number | null> {
  const query = type === "business" ? Business.findById(id) : User.findById(id);
  const doc = (await query
    .setOptions({ includeDeleted: true })
    .select("refreshSessionVersion")
    .lean()) as { refreshSessionVersion?: number } | null;
  if (!doc) return null;
  return doc.refreshSessionVersion ?? 0;
}

/**
 * Verify an access token, require its refresh session to be live, and refuse
 * a soft-deleted User or deleted Business. Database failures propagate.
 */
export interface LiveAccessSession {
  session: AuthSession;
  /** The stored refresh session the access token was issued against. */
  sessionId: string;
}

/**
 * Verify an access token and return the live refresh session id with it.
 *
 * Most routes only need the stripped session and use `requireLiveAccessSession`.
 * The live-ticket endpoint needs the id so the socket can re-check the session
 * at consume time without carrying a long-lived token in the URL.
 */
export async function requireLiveAccessSessionWithRefreshId(
  app: FastifyInstance,
  token: string,
): Promise<LiveAccessSession> {
  let decoded: AuthSession & { sessionId?: string };
  try {
    decoded = app.jwt.verify<AuthSession & { sessionId?: string }>(token);
  } catch (error) {
    if (isRejectedCredential(error)) {
      throw unauthorized("Invalid or expired access token");
    }
    throw error;
  }
  await assertAccessTokenRefreshSessionLive(decoded);
  await assertAccountCanUseSession(decoded);

  const { sessionId, ...session } = decoded;
  if (!sessionId) {
    throw unauthorized("Invalid or expired access token");
  }
  return { session, sessionId };
}

export async function requireLiveAccessSession(
  app: FastifyInstance,
  token: string,
): Promise<AuthSession> {
  const { session } = await requireLiveAccessSessionWithRefreshId(app, token);
  return session;
}

/**
 * A soft-deleted User or Business must not keep a live session.
 * Missing accounts stay allowed so a route can answer 404. A closed
 * Business or a soft-deleted User is refused because closure ends access.
 */
export async function assertAccountCanUseSession(session: AuthSession): Promise<void> {
  if (session.type === "user") {
    const user = await User.findById(session.id)
      .setOptions({ includeDeleted: true })
      .select("deleted")
      .lean();
    if (user?.deleted) {
      throw unauthorized("Invalid or expired access token");
    }
    return;
  }

  const business = await Business.findById(session.id)
    .setOptions({ includeDeleted: true })
    .select("deleted")
    .lean();
  if (business?.deleted) {
    throw unauthorized("Invalid or expired access token");
  }
}

/**
 * Creates a hook that requires the user to be a business account.
 * Must be used after createAuthHook.
 */
export function requireBusinessHook(): preValidationHookHandler {
  return async (req: FastifyRequest) => {
    if (!req.authSession) {
      throw unauthorized("Authentication required");
    }

    if (req.authSession.type !== "business") {
      throw forbidden("Business account required");
    }
  };
}

/**
 * Creates a hook that requires the user to have management role.
 * Must be used after createAuthHook. Works for both business accounts
 * and employees with management roles.
 */
export function requireManagementHook(): preValidationHookHandler {
  return async (req: FastifyRequest) => {
    if (!req.authSession) {
      throw unauthorized("Authentication required");
    }

    if (req.authSession.type === "business") {
      return; // Business accounts have full access
    }

    const userSession = req.authSession as AuthUser;
    if (!userSession.canLogAsEmployee) {
      throw forbidden("Employee access required");
    }
  };
}

/**
 * Creates a hook that requires the user to be logged in as an employee.
 * Must be used after createAuthHook.
 */
export function requireEmployeeHook(): preValidationHookHandler {
  return async (req: FastifyRequest) => {
    if (!req.authSession) {
      throw unauthorized("Authentication required");
    }

    if (req.authSession.type !== "user") {
      throw forbidden("User account required");
    }

    const userSession = req.authSession as AuthUser;
    if (!userSession.employeeId || !userSession.canLogAsEmployee) {
      throw forbidden("Employee access required");
    }
  };
}

/**
 * Helper to check if the current user has access to a specific business.
 * Returns true if:
 * - User is a business account with matching ID
 * - User is an employee of the business
 */
export function hasBusinessAccess(
  session: AuthSession | undefined,
  businessId: string,
): boolean {
  if (!session) return false;

  if (session.type === "business") {
    return session.id === businessId;
  }

  const userSession = session as AuthUser;
  return (
    userSession.businessId === businessId && !!userSession.canLogAsEmployee
  );
}

/**
 * Helper to get the business ID from the current session.
 * For business accounts, returns their ID.
 * For employees, returns their linked businessId.
 */
export function getSessionBusinessId(
  session: AuthSession | undefined,
): string | null {
  if (!session) return null;

  if (session.type === "business") {
    return session.id;
  }

  const userSession = session as AuthUser;
  return userSession.businessId || null;
}

/** Business JWT must match `:businessId` in the URL. */
export function requireBusinessIdMatchesSessionHook(): preValidationHookHandler {
  return async (req) => {
    if (!req.authSession) {
      throw unauthorized("Authentication required");
    }
    if (req.authSession.type !== "business") {
      throw forbidden("Business account required");
    }
    const businessId = (req.params as { businessId?: string }).businessId;
    if (!businessId || req.authSession.id !== businessId) {
      throw forbidden("Forbidden");
    }
  };
}

/** User JWT must match `:userId` in the URL (self-service updates). */
export function requireUserIdMatchesSessionHook(): preValidationHookHandler {
  return async (req) => {
    if (!req.authSession) {
      throw unauthorized("Authentication required");
    }
    if (req.authSession.type !== "user") {
      throw forbidden("User account required");
    }
    const userId = (req.params as { userId?: string }).userId;
    if (!userId || req.authSession.id !== userId) {
      throw forbidden("Forbidden");
    }
  };
}
