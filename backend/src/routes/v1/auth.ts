/**
 * Auth Routes - Authentication endpoints for the Fastify backend
 *
 * Implements JWT-based authentication with access/refresh token strategy.
 * Matches legacy NextAuth session structure for full parity.
 */

import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcrypt";
import Business from "../../models/business.ts";
import User from "../../models/user.ts";
import Employee from "../../models/employee.ts";
import canLogAsEmployee from "../../auth/canLogAsEmployee.ts";
import { AUTH_CONFIG } from "../../auth/config.ts";
import type {
  AuthSession,
  AuthBusiness,
  AuthUser,
  RefreshTokenPayload,
} from "../../auth/types.ts";

interface LoginBody {
  email: string;
  password: string;
}

interface SetModeBody {
  mode: "customer" | "employee";
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /auth/login
   * Authenticate with email/password, returns access token and sets refresh cookie.
   *
   * Flow:
   * 1. Check Business collection by email
   * 2. If not found, check User collection by personalDetails.email
   * 3. If user has employeeDetails, check canLogAsEmployee
   * 4. Return access token + user session data
   */
  app.post<{ Body: LoginBody }>("/login", async (req, reply) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return reply
        .code(400)
        .send({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check Business collection first
    const business = (await Business.findOne({ email: normalizedEmail })
      .select("_id email password")
      .lean()) as { _id: unknown; email: string; password: string } | null;

    if (business) {
      const passwordMatch = await bcrypt.compare(password, business.password);
      if (!passwordMatch) {
        return reply.code(401).send({ message: "Invalid credentials" });
      }

      const session: AuthBusiness = {
        id: String(business._id),
        email: business.email,
        type: "business",
      };

      const accessToken = app.jwt.sign(session, {
        expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRES_IN,
      });

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

      return reply.code(200).send({
        accessToken,
        user: session,
      });
    }

    // 2. Check User collection
    const user = (await User.findOne({
      "personalDetails.email": normalizedEmail,
    })
      .select(
        "_id personalDetails.email personalDetails.password employeeDetails",
      )
      .lean()) as {
      _id: unknown;
      personalDetails: { email?: string; password?: string };
      employeeDetails?: unknown;
    } | null;

    if (!user?.personalDetails?.password) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.personalDetails.password,
    );
    if (!passwordMatch) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const userEmail =
      typeof user.personalDetails.email === "string"
        ? user.personalDetails.email
        : String(user.personalDetails.email);

    const session: AuthUser = {
      id: String(user._id),
      email: userEmail,
      type: "user",
    };

    // 3. Check employee link if present
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
          user.employeeDetails as import("mongoose").Types.ObjectId,
        );

        session.employeeId = String(user.employeeDetails);
        session.businessId = String(employee.businessId);
        session.canLogAsEmployee = canLog;
      }
    }

    const accessToken = app.jwt.sign(session, {
      expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRES_IN,
    });

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

    return reply.code(200).send({
      accessToken,
      user: session,
    });
  });

  /**
   * POST /auth/refresh
   * Exchange refresh token for new access token.
   * Re-checks canLogAsEmployee for users with employee link.
   */
  app.post("/refresh", async (req, reply) => {
    const refreshToken = req.cookies[AUTH_CONFIG.REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return reply.code(401).send({ message: "No refresh token provided" });
    }

    let payload: RefreshTokenPayload;
    try {
      payload = app.jwt.verify<RefreshTokenPayload>(refreshToken, {
        key: AUTH_CONFIG.REFRESH_SECRET,
      });
    } catch {
      reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
      return reply
        .code(401)
        .send({ message: "Invalid or expired refresh token" });
    }

    let session: AuthSession;

    if (payload.type === "business") {
      const business = (await Business.findById(payload.id)
        .select("_id email")
        .lean()) as { _id: unknown; email: string } | null;

      if (!business) {
        reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
        return reply.code(401).send({ message: "Business not found" });
      }

      session = {
        id: String(business._id),
        email: business.email,
        type: "business",
      };
    } else {
      const user = (await User.findById(payload.id)
        .select("_id personalDetails.email employeeDetails")
        .lean()) as {
        _id: unknown;
        personalDetails: { email?: string };
        employeeDetails?: unknown;
      } | null;

      if (!user) {
        reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
        return reply.code(401).send({ message: "User not found" });
      }

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
            user.employeeDetails as import("mongoose").Types.ObjectId,
          );

          userSession.employeeId = String(user.employeeDetails);
          userSession.businessId = String(employee.businessId);
          userSession.canLogAsEmployee = canLog;
        }
      }

      session = userSession;
    }

    const accessToken = app.jwt.sign(session, {
      expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRES_IN,
    });

    return reply.code(200).send({
      accessToken,
      user: session,
    });
  });

  /**
   * POST /auth/logout
   * Clear refresh token cookie.
   */
  app.post("/logout", async (_req, reply) => {
    reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
    reply.clearCookie(AUTH_CONFIG.AUTH_MODE_COOKIE_NAME, { path: "/" });
    return reply.code(200).send({ message: "Logged out successfully" });
  });

  /**
   * GET /auth/me
   * Get current session from access token.
   * Requires valid Authorization: Bearer <token> header.
   */
  app.get("/me", async (req, reply) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ message: "No access token provided" });
    }

    const token = authHeader.slice(7);

    try {
      const session = app.jwt.verify<AuthSession>(token);
      return reply.code(200).send({ user: session });
    } catch {
      return reply
        .code(401)
        .send({ message: "Invalid or expired access token" });
    }
  });

  /**
   * POST /auth/set-mode
   * Set auth mode cookie (customer/employee) for users with employee access.
   * Requires valid access token.
   */
  app.post<{ Body: SetModeBody }>("/set-mode", async (req, reply) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ message: "No access token provided" });
    }

    const token = authHeader.slice(7);

    let session: AuthSession;
    try {
      session = app.jwt.verify<AuthSession>(token);
    } catch {
      return reply
        .code(401)
        .send({ message: "Invalid or expired access token" });
    }

    if (session.type !== "user") {
      return reply.code(400).send({ message: "Only users can set auth mode" });
    }

    const { mode } = req.body;
    if (mode !== "customer" && mode !== "employee") {
      return reply
        .code(400)
        .send({ message: "Mode must be 'customer' or 'employee'" });
    }

    if (mode === "employee" && !session.canLogAsEmployee) {
      return reply
        .code(403)
        .send({ message: "Not authorized to log in as employee" });
    }

    reply.setCookie(AUTH_CONFIG.AUTH_MODE_COOKIE_NAME, mode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_CONFIG.COOKIE_MAX_AGE_SECONDS,
    });

    return reply.code(200).send({
      message: "Auth mode set successfully",
      mode,
    });
  });

  /**
   * GET /auth/mode
   * Get current auth mode from cookie.
   */
  app.get("/mode", async (req, reply) => {
    const mode = req.cookies[AUTH_CONFIG.AUTH_MODE_COOKIE_NAME] || "customer";
    return reply.code(200).send({ mode });
  });
};
