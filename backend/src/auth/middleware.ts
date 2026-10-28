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
import RefreshSession from "../models/refreshSession.ts";
import User from "../models/user.ts";
import { canAccessBusiness } from "./businessAccess.ts";
import type { AuthMode, AuthSession, AuthUser } from "./types.ts";

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
 * is unexpired, belongs to the same User, and matches the account generation.
 * A token with no session id is refused. This does not apply the
 * deleted-account check; callers that already do keep doing so.
 */
export async function assertAccessTokenRefreshSessionLive(
  session: AuthSession & { sessionId?: string },
): Promise<AuthMode> {
  const sessionId = session.sessionId;
  if (
    session.type !== "user" ||
    !sessionId ||
    !Types.ObjectId.isValid(sessionId)
  ) {
    throw unauthorized("Invalid or expired access token");
  }

  const stored = (await RefreshSession.findById(sessionId).lean()) as {
    accountId: Types.ObjectId;
    accountType: "user";
    refreshSessionVersion: number;
    mode?: AuthMode;
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

  const dbVersion = await accountGenerationIfRowExists(session.id);
  if (dbVersion !== null && stored.refreshSessionVersion !== dbVersion) {
    throw unauthorized("Invalid or expired access token");
  }

  return stored.mode === "business" ? "business" : "customer";
}

/** `null` when no account document exists, including a hard-deleted row. Soft-deleted rows still count. */
async function accountGenerationIfRowExists(
  id: string,
): Promise<number | null> {
  const doc = (await User.findById(id)
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
  const mode = await assertAccessTokenRefreshSessionLive(decoded);
  await assertAccountCanUseSession(decoded);

  const { sessionId, ...session } = decoded;
  if (!sessionId) {
    throw unauthorized("Invalid or expired access token");
  }
  session.mode = mode;
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
 * A soft-deleted User must not keep a live session.
 * Missing accounts stay allowed so a route can answer 404. A soft-deleted User
 * is refused because deletion ends access.
 */
export async function assertAccountCanUseSession(session: AuthSession): Promise<void> {
  const user = await User.findById(session.id)
    .setOptions({ includeDeleted: true })
    .select("deleted")
    .lean();
  if (user?.deleted) {
    throw unauthorized("Invalid or expired access token");
  }
}

/**
 * Creates a hook that requires the user to have management role.
 * Must be used after createAuthHook.
 */
export function requireManagementHook(): preValidationHookHandler {
  return async (req: FastifyRequest) => {
    if (!req.authSession) {
      throw unauthorized("Authentication required");
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

    const userSession = req.authSession as AuthUser;
    if (!userSession.employeeId || !userSession.canLogAsEmployee) {
      throw forbidden("Employee access required");
    }
  };
}

/**
 * The signed-in User must own the `:businessId` venue or hold an active
 * Employee membership there. Must be used after createAuthHook.
 */
export function requireBusinessAccessHook(): preValidationHookHandler {
  return async (req) => {
    if (!req.authSession) {
      throw unauthorized("Authentication required");
    }
    const businessId = (req.params as { businessId?: string }).businessId;
    if (
      !businessId ||
      !(await canAccessBusiness(req.authSession.id, businessId))
    ) {
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
