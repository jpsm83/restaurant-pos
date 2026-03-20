/**
 * Auth Middleware - Request authentication and authorization helpers
 *
 * Provides preValidation hooks for protecting routes and extracting user info.
 */

import type {
  FastifyRequest,
  FastifyReply,
  FastifyInstance,
  preValidationHookHandler,
} from "fastify";
import type { AuthSession, AuthUser } from "./types.ts";
import { hasManagementRole } from "../utils/constants.ts";

declare module "fastify" {
  interface FastifyRequest {
    authSession?: AuthSession;
  }
}

/**
 * Creates an authentication hook that verifies the JWT access token
 * and attaches the decoded user to request.user.
 */
export function createAuthHook(
  app: FastifyInstance
): preValidationHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ message: "Authentication required" });
    }

    const token = authHeader.slice(7);

    try {
      const decoded = app.jwt.verify<AuthSession>(token);
      req.authSession = decoded;
    } catch {
      return reply.code(401).send({ message: "Invalid or expired access token" });
    }
  };
}

/**
 * Creates an optional authentication hook that attempts to verify the JWT
 * but allows the request to proceed even if no token is provided.
 * Sets request.user if a valid token is present.
 */
export function createOptionalAuthHook(
  app: FastifyInstance
): preValidationHookHandler {
  return async (req: FastifyRequest) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return;
    }

    const token = authHeader.slice(7);

    try {
      const decoded = app.jwt.verify<AuthSession>(token);
      req.authSession = decoded;
    } catch {
      // Token invalid, but we allow the request to proceed
    }
  };
}

/**
 * Creates a hook that requires the user to be a business account.
 * Must be used after createAuthHook.
 */
export function requireBusinessHook(): preValidationHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.authSession) {
      return reply.code(401).send({ message: "Authentication required" });
    }

    if (req.authSession.type !== "business") {
      return reply.code(403).send({ message: "Business account required" });
    }
  };
}

/**
 * Creates a hook that requires the user to have management role.
 * Must be used after createAuthHook. Works for both business accounts
 * and employees with management roles.
 */
export function requireManagementHook(): preValidationHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.authSession) {
      return reply.code(401).send({ message: "Authentication required" });
    }

    if (req.authSession.type === "business") {
      return; // Business accounts have full access
    }

    const userSession = req.authSession as AuthUser;
    if (!userSession.canLogAsEmployee) {
      return reply.code(403).send({ message: "Employee access required" });
    }
  };
}

/**
 * Creates a hook that requires the user to be logged in as an employee.
 * Must be used after createAuthHook.
 */
export function requireEmployeeHook(): preValidationHookHandler {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.authSession) {
      return reply.code(401).send({ message: "Authentication required" });
    }

    if (req.authSession.type !== "user") {
      return reply.code(403).send({ message: "User account required" });
    }

    const userSession = req.authSession as AuthUser;
    if (!userSession.employeeId || !userSession.canLogAsEmployee) {
      return reply.code(403).send({ message: "Employee access required" });
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
  businessId: string
): boolean {
  if (!session) return false;

  if (session.type === "business") {
    return session.id === businessId;
  }

  const userSession = session as AuthUser;
  return userSession.businessId === businessId && !!userSession.canLogAsEmployee;
}

/**
 * Helper to get the business ID from the current session.
 * For business accounts, returns their ID.
 * For employees, returns their linked businessId.
 */
export function getSessionBusinessId(session: AuthSession | undefined): string | null {
  if (!session) return null;

  if (session.type === "business") {
    return session.id;
  }

  const userSession = session as AuthUser;
  return userSession.businessId || null;
}
