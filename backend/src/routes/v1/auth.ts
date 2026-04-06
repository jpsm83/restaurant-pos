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
import {
  isValidPassword,
  PASSWORD_POLICY_MESSAGE,
} from "../../../../packages/utils/passwordPolicy.ts";
import type {
  AuthSession,
  AuthBusiness,
  AuthUser,
  RefreshTokenPayload,
} from "../../auth/types.ts";
import {
  buildAuthBusinessSessionFromId,
  buildAuthUserSessionFromUserId,
  issueSessionWithRefreshCookie,
  readRefreshSessionVersionForAccount,
  refreshTokenPayloadVersionMatchesDb,
  signAccessToken,
} from "../../auth/issueSession.ts";
import {
  handleConfirmEmail,
  CONFIRM_EMAIL_MISSING_TOKEN_MESSAGE,
  isValidConfirmEmailTokenInput,
} from "../../auth/confirmEmail.ts";
import {
  GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
  handleRequestEmailConfirmation,
  isValidRequestEmailConfirmationInput,
  normalizeRequestEmail,
} from "../../auth/requestEmailConfirmation.ts";
import { handleRequestPasswordReset } from "../../auth/requestPasswordReset.ts";
import { handleResendEmailConfirmationForAuthenticatedAccount } from "../../auth/resendEmailConfirmation.ts";
import {
  handleResetPassword,
  isValidResetPasswordNewPasswordInput,
  isValidResetPasswordTokenInput,
  RESET_PASSWORD_MISSING_NEW_PASSWORD_MESSAGE,
  RESET_PASSWORD_MISSING_TOKEN_MESSAGE,
} from "../../auth/resetPassword.ts";

interface LoginBody {
  email: string;
  password: string;
}

interface SignupBody {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

interface SetModeBody {
  mode: "customer" | "employee";
}

interface RequestEmailConfirmationBody {
  email?: string;
}

interface ConfirmEmailBody {
  token?: string;
}

interface ResetPasswordBody {
  token?: string;
  newPassword?: string;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /auth/signup
   * Create a customer user account and return authenticated session.
   */
  app.post<{ Body: SignupBody }>("/signup", async (req, reply) => {
    const { email, password, username, firstName, lastName } = req.body;

    if (!email || !password) {
      return reply.code(400).send({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(normalizedEmail)) {
      return reply.code(400).send({ message: "Please provide a valid email address" });
    }

    if (!isValidPassword(password)) {
      return reply.code(400).send({ message: PASSWORD_POLICY_MESSAGE });
    }

    const [existingBusiness, existingUser] = await Promise.all([
      Business.findOne({ email: normalizedEmail }).select("_id").lean(),
      User.findOne({ "personalDetails.email": normalizedEmail }).select("_id").lean(),
    ]);

    if (existingBusiness || existingUser) {
      return reply.code(409).send({ message: "Account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailPrefix = normalizedEmail.split("@")[0] || "user";
    const safeUsername = (username?.trim() || emailPrefix).slice(0, 50);
    const safeFirstName = (firstName?.trim() || "New").slice(0, 50);
    const safeLastName = (lastName?.trim() || "User").slice(0, 50);

    const createdUser = await User.create({
      personalDetails: {
        username: safeUsername,
        email: normalizedEmail,
        password: hashedPassword,
        idType: "Passport",
        idNumber: `AUTO-${Date.now()}`,
        address: {
          country: "Unknown",
          state: "Unknown",
          city: "Unknown",
          street: "Unknown",
          buildingNumber: "0",
          postCode: "0000",
        },
        firstName: safeFirstName,
        lastName: safeLastName,
        nationality: "Unknown",
        gender: "Other",
        birthDate: new Date("2000-01-01T00:00:00.000Z"),
        phoneNumber: "0000000000",
      },
    });

    const session: AuthUser = {
      id: String(createdUser._id),
      email: normalizedEmail,
      type: "user",
      emailVerified:
        createdUser.personalDetails?.emailVerified === true ||
        createdUser.emailVerified === true,
    };

    const { accessToken, user } = issueSessionWithRefreshCookie(
      app,
      reply,
      session,
      { refreshSessionVersion: createdUser.refreshSessionVersion ?? 0 },
    );

    // Phase 4.1: issue confirmation email without blocking signup (session unchanged).
    handleRequestEmailConfirmation(normalizedEmail)
      .then((result) => {
        if (result.kind === "server_error_500" || result.kind === "already_verified_400") {
          req.log.error(
            { errHint: "signup_confirmation_send" },
            result.message,
          );
        }
      })
      .catch((err) => {
        req.log.error({ err }, "Signup confirmation email failed");
      });

    return reply.code(201).send({
      accessToken,
      user,
    });
  });

  /**
   * POST /auth/request-email-confirmation
   * Unauthenticated: request a sign-in email verification message (anti-enumeration response).
   */
  app.post<{ Body: RequestEmailConfirmationBody }>(
    "/request-email-confirmation",
    async (req, reply) => {
      const { email } = req.body ?? {};
      if (!isValidRequestEmailConfirmationInput(email)) {
        return reply.code(400).send({
          message: "Please provide a valid email address",
        });
      }

      const normalized = normalizeRequestEmail(email);
      const result = await handleRequestEmailConfirmation(normalized);

      if (result.kind === "already_verified_400") {
        return reply.code(400).send({ message: result.message });
      }
      if (result.kind === "server_error_500") {
        return reply.code(500).send({ message: result.message });
      }

      return reply.code(200).send({
        message: result.message || GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
      });
    },
  );

  /**
   * POST /auth/request-password-reset
   * Unauthenticated: request a password reset email (anti-enumeration response; same generic body as confirmation request).
   */
  app.post<{ Body: RequestEmailConfirmationBody }>(
    "/request-password-reset",
    async (req, reply) => {
      const { email } = req.body ?? {};
      if (!isValidRequestEmailConfirmationInput(email)) {
        return reply.code(400).send({
          message: "Please provide a valid email address",
        });
      }

      const normalized = normalizeRequestEmail(email);
      const result = await handleRequestPasswordReset(normalized);

      if (result.kind === "server_error_500") {
        return reply.code(500).send({ message: result.message });
      }

      return reply.code(200).send({
        message: result.message || GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
      });
    },
  );

  /**
   * POST /auth/confirm-email
   * Unauthenticated: consume email verification token (one-time).
   */
  app.post<{ Body: ConfirmEmailBody }>("/confirm-email", async (req, reply) => {
    const { token } = req.body ?? {};
    if (!isValidConfirmEmailTokenInput(token)) {
      return reply.code(400).send({ message: CONFIRM_EMAIL_MISSING_TOKEN_MESSAGE });
    }

    const result = await handleConfirmEmail(token);

    if (result.kind === "client_error") {
      return reply.code(400).send({ message: result.message });
    }
    if (result.kind === "server_error_500") {
      return reply.code(500).send({ message: result.message });
    }

    return reply.code(200).send({ message: result.message });
  });

  /**
   * POST /auth/reset-password
   * Unauthenticated: consume password-reset token and set a new password (one-time).
   */
  app.post<{ Body: ResetPasswordBody }>(
    "/reset-password",
    async (req, reply) => {
      const { token, newPassword } = req.body ?? {};

      if (!isValidResetPasswordTokenInput(token)) {
        return reply
          .code(400)
          .send({ message: RESET_PASSWORD_MISSING_TOKEN_MESSAGE });
      }

      if (!isValidResetPasswordNewPasswordInput(newPassword)) {
        return reply
          .code(400)
          .send({ message: RESET_PASSWORD_MISSING_NEW_PASSWORD_MESSAGE });
      }

      if (!isValidPassword(newPassword)) {
        return reply.code(400).send({ message: PASSWORD_POLICY_MESSAGE });
      }

      const result = await handleResetPassword(token, newPassword);

      if (result.kind === "client_error") {
        return reply.code(400).send({ message: result.message });
      }
      if (result.kind === "server_error_500") {
        return reply.code(500).send({ message: result.message });
      }

      return reply.code(200).send({ message: result.message });
    },
  );

  /**
   * POST /auth/resend-email-confirmation
   * Authenticated: resend sign-in email confirmation for the current session account (DB email only).
   */
  app.post("/resend-email-confirmation", async (req, reply) => {
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

    const result =
      await handleResendEmailConfirmationForAuthenticatedAccount(session);

    if (result.kind === "account_not_found") {
      return reply.code(401).send({ message: "Account not found." });
    }
    if (result.kind === "already_verified") {
      return reply.code(400).send({ message: result.message });
    }
    if (result.kind === "server_error_500") {
      return reply.code(500).send({ message: result.message });
    }

    return reply.code(200).send({ message: result.message });
  });

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
      .select("_id email password emailVerified refreshSessionVersion")
      .lean()) as {
      _id: unknown;
      email: string;
      password: string;
      emailVerified?: boolean;
      refreshSessionVersion?: number;
    } | null;

    if (business) {
      const passwordMatch = await bcrypt.compare(password, business.password);
      if (!passwordMatch) {
        return reply.code(401).send({ message: "Invalid credentials" });
      }

      const session: AuthBusiness = {
        id: String(business._id),
        email: business.email,
        type: "business",
        emailVerified: business.emailVerified === true,
      };

      const { accessToken, user } = issueSessionWithRefreshCookie(
        app,
        reply,
        session,
        {
          refreshSessionVersion: business.refreshSessionVersion ?? 0,
        },
      );

      return reply.code(200).send({
        accessToken,
        user,
      });
    }

    // 2. Check User collection
    const user = (await User.findOne({
      "personalDetails.email": normalizedEmail,
    })
      .select(
        "_id personalDetails.email personalDetails.password personalDetails.emailVerified employeeDetails emailVerified refreshSessionVersion",
      )
      .lean()) as {
      _id: unknown;
      personalDetails: { email?: string; password?: string; emailVerified?: boolean };
      employeeDetails?: unknown;
      emailVerified?: boolean;
      refreshSessionVersion?: number;
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
      emailVerified:
        user.personalDetails?.emailVerified === true || user.emailVerified === true,
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

    const { accessToken, user: userOut } = issueSessionWithRefreshCookie(
      app,
      reply,
      session,
      { refreshSessionVersion: user.refreshSessionVersion ?? 0 },
    );

    return reply.code(200).send({
      accessToken,
      user: userOut,
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

    const dbVersion = await readRefreshSessionVersionForAccount(
      payload.type,
      payload.id,
    );
    if (dbVersion === null) {
      reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
      return reply.code(401).send({
        message:
          payload.type === "business" ? "Business not found" : "User not found",
      });
    }
    if (!refreshTokenPayloadVersionMatchesDb(payload, dbVersion)) {
      reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
      return reply
        .code(401)
        .send({ message: "Invalid or expired refresh token" });
    }

    let session: AuthSession;

    if (payload.type === "business") {
      const businessSession = await buildAuthBusinessSessionFromId(payload.id);
      if (!businessSession) {
        reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
        return reply.code(401).send({ message: "Business not found" });
      }
      session = businessSession;
    } else {
      const userSession = await buildAuthUserSessionFromUserId(payload.id);
      if (!userSession) {
        reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
        return reply.code(401).send({ message: "User not found" });
      }
      session = userSession;
    }

    const accessToken = signAccessToken(app, session);

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
