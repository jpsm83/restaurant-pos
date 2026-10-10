/**
 * Auth Routes - Authentication endpoints for the Fastify backend
 *
 * Implements JWT-based authentication with access/refresh token strategy.
 * Matches legacy NextAuth session structure for full parity.
 *
 * Routes that accept input declare their request body as a strict zod DTO from
 * `packages/schemas/auth.ts`; validation and sanitization happen at the
 * boundary and every error is raised as an `AppError` so the global handler
 * emits RFC 9457 `application/problem+json`.
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
} from "../../auth/confirmEmail.ts";
import {
  GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
  handleRequestEmailConfirmation,
} from "../../auth/requestEmailConfirmation.ts";
import { handleRequestPasswordReset } from "../../auth/requestPasswordReset.ts";
import { handleResendEmailConfirmationForAuthenticatedAccount } from "../../auth/resendEmailConfirmation.ts";
import { handleResetPassword } from "../../auth/resetPassword.ts";
import {
  badRequest,
  conflict,
  forbidden,
  internal,
  unauthorized,
} from "../../errors/appError.ts";
import {
  confirmEmailBodySchema,
  loginBodySchema,
  requestEmailConfirmationBodySchema,
  requestPasswordResetBodySchema,
  resetPasswordBodySchema,
  setModeBodySchema,
  signupBodySchema,
  type ConfirmEmailBody,
  type LoginBody,
  type RequestEmailConfirmationBody,
  type RequestPasswordResetBody,
  type ResetPasswordBody,
  type SetModeBody,
  type SignupBody,
} from "../../../../packages/schemas/auth.ts";

export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /auth/signup
   * Create a customer user account and return authenticated session.
   */
  app.post<{ Body: SignupBody }>(
    "/signup",
    { schema: { body: signupBodySchema } },
    async (req, reply) => {
      const { email, password, username, firstName, lastName } = req.body;

      const [existingBusiness, existingUser] = await Promise.all([
        Business.findOne({ email }).select("_id").lean(),
        User.findOne({ "personalDetails.email": email }).select("_id").lean(),
      ]);

      if (existingBusiness || existingUser) {
        throw conflict("Account with this email already exists");
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const emailPrefix = email.split("@")[0] || "user";
      const safeUsername = (username?.trim() || emailPrefix).slice(0, 50);
      const safeFirstName = (firstName?.trim() || "New").slice(0, 50);
      const safeLastName = (lastName?.trim() || "User").slice(0, 50);

      const createdUser = await User.create({
        personalDetails: {
          username: safeUsername,
          email,
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
        email,
        type: "user",
        emailVerified:
          createdUser.personalDetails?.emailVerified === true ||
          createdUser.emailVerified === true,
        role: "Customer",
      };

      const { accessToken, user } = issueSessionWithRefreshCookie(
        app,
        reply,
        session,
        { refreshSessionVersion: createdUser.refreshSessionVersion ?? 0 },
      );

      // Phase 4.1: issue confirmation email without blocking signup (session unchanged).
      handleRequestEmailConfirmation(email)
        .then((result) => {
          if (
            result.kind === "server_error_500" ||
            result.kind === "already_verified_400"
          ) {
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
    },
  );

  /**
   * POST /auth/request-email-confirmation
   * Unauthenticated: request a sign-in email verification message (anti-enumeration response).
   */
  app.post<{ Body: RequestEmailConfirmationBody }>(
    "/request-email-confirmation",
    { schema: { body: requestEmailConfirmationBodySchema } },
    async (req, reply) => {
      const { email } = req.body;
      const result = await handleRequestEmailConfirmation(email);

      if (result.kind === "already_verified_400") {
        throw badRequest(result.message);
      }
      if (result.kind === "server_error_500") {
        throw internal(result.message);
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
  app.post<{ Body: RequestPasswordResetBody }>(
    "/request-password-reset",
    { schema: { body: requestPasswordResetBodySchema } },
    async (req, reply) => {
      const { email } = req.body;
      const result = await handleRequestPasswordReset(email);

      if (result.kind === "server_error_500") {
        throw internal(result.message);
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
  app.post<{ Body: ConfirmEmailBody }>(
    "/confirm-email",
    { schema: { body: confirmEmailBodySchema } },
    async (req, reply) => {
      const { token } = req.body;
      const result = await handleConfirmEmail(token);

      if (result.kind === "client_error") {
        throw badRequest(result.message);
      }
      if (result.kind === "server_error_500") {
        throw internal(result.message);
      }

      return reply.code(200).send({ message: result.message });
    },
  );

  /**
   * POST /auth/reset-password
   * Unauthenticated: consume password-reset token and set a new password (one-time).
   */
  app.post<{ Body: ResetPasswordBody }>(
    "/reset-password",
    { schema: { body: resetPasswordBodySchema } },
    async (req, reply) => {
      const { token, newPassword } = req.body;
      const result = await handleResetPassword(token, newPassword);

      if (result.kind === "client_error") {
        throw badRequest(result.message);
      }
      if (result.kind === "server_error_500") {
        throw internal(result.message);
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
      throw unauthorized("No access token provided");
    }

    const token = authHeader.slice(7);

    let session: AuthSession;
    try {
      session = app.jwt.verify<AuthSession>(token);
    } catch {
      throw unauthorized("Invalid or expired access token");
    }

    const result =
      await handleResendEmailConfirmationForAuthenticatedAccount(session);

    if (result.kind === "account_not_found") {
      throw unauthorized("Account not found.");
    }
    if (result.kind === "already_verified") {
      throw badRequest(result.message);
    }
    if (result.kind === "server_error_500") {
      throw internal(result.message);
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
  app.post<{ Body: LoginBody }>(
    "/login",
    { schema: { body: loginBodySchema } },
    async (req, reply) => {
      const { email, password } = req.body;

      // 1. Check Business collection first
      const business = (await Business.findOne({ email })
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
          throw unauthorized("Invalid credentials");
        }

        const session: AuthBusiness = {
          id: String(business._id),
          email: business.email,
          type: "business",
          emailVerified: business.emailVerified === true,
          role: "Tenant",
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
        "personalDetails.email": email,
      })
        .select(
          "_id personalDetails.email personalDetails.password personalDetails.emailVerified employeeDetails emailVerified refreshSessionVersion",
        )
        .lean()) as {
        _id: unknown;
        personalDetails: {
          email?: string;
          password?: string;
          emailVerified?: boolean;
        };
        employeeDetails?: unknown;
        emailVerified?: boolean;
        refreshSessionVersion?: number;
      } | null;

      if (!user?.personalDetails?.password) {
        throw unauthorized("Invalid credentials");
      }

      const passwordMatch = await bcrypt.compare(
        password,
        user.personalDetails.password,
      );
      if (!passwordMatch) {
        throw unauthorized("Invalid credentials");
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
          user.personalDetails?.emailVerified === true ||
          user.emailVerified === true,
        role: "Customer",
      };

      // 3. Check employee link if present
      if (user.employeeDetails) {
        const employee = (await Employee.findById(user.employeeDetails)
          .select("businessId active terminatedDate allEmployeeRoles")
          .lean()) as {
          businessId: unknown;
          active?: boolean;
          terminatedDate?: unknown;
          allEmployeeRoles?: string[];
        } | null;

        if (employee && employee.active && !employee.terminatedDate) {
          const { canLogAsEmployee: canLog } = await canLogAsEmployee(
            user.employeeDetails as import("mongoose").Types.ObjectId,
          );

          session.employeeId = String(user.employeeDetails);
          session.businessId = String(employee.businessId);
          session.canLogAsEmployee = canLog;
          const primaryRole = employee.allEmployeeRoles?.[0];
          session.role =
            typeof primaryRole === "string" && primaryRole.trim()
              ? primaryRole
              : "Employee";
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
    },
  );

  /**
   * POST /auth/refresh
   * Exchange refresh token for new access token.
   * Re-checks canLogAsEmployee for users with employee link.
   */
  app.post("/refresh", async (req, reply) => {
    const refreshToken = req.cookies[AUTH_CONFIG.REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      throw unauthorized("No refresh token provided");
    }

    let payload: RefreshTokenPayload;
    try {
      payload = app.jwt.verify<RefreshTokenPayload>(refreshToken, {
        key: AUTH_CONFIG.REFRESH_SECRET,
      });
    } catch {
      reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
      throw unauthorized("Invalid or expired refresh token");
    }

    const dbVersion = await readRefreshSessionVersionForAccount(
      payload.type,
      payload.id,
    );
    if (dbVersion === null) {
      reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
      throw unauthorized(
        payload.type === "business" ? "Business not found" : "User not found",
      );
    }
    if (!refreshTokenPayloadVersionMatchesDb(payload, dbVersion)) {
      reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
      throw unauthorized("Invalid or expired refresh token");
    }

    let session: AuthSession;

    if (payload.type === "business") {
      const businessSession = await buildAuthBusinessSessionFromId(payload.id);
      if (!businessSession) {
        reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
        throw unauthorized("Business not found");
      }
      session = businessSession;
    } else {
      const userSession = await buildAuthUserSessionFromUserId(payload.id);
      if (!userSession) {
        reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
        throw unauthorized("User not found");
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
      throw unauthorized("No access token provided");
    }

    const token = authHeader.slice(7);

    try {
      const session = app.jwt.verify<AuthSession>(token);
      return reply.code(200).send({ user: session });
    } catch {
      throw unauthorized("Invalid or expired access token");
    }
  });

  /**
   * POST /auth/set-mode
   * Set auth mode cookie (customer/employee) for users with employee access.
   * Requires valid access token.
   */
  app.post<{ Body: SetModeBody }>(
    "/set-mode",
    { schema: { body: setModeBodySchema } },
    async (req, reply) => {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith("Bearer ")) {
        throw unauthorized("No access token provided");
      }

      const token = authHeader.slice(7);

      let session: AuthSession;
      try {
        session = app.jwt.verify<AuthSession>(token);
      } catch {
        throw unauthorized("Invalid or expired access token");
      }

      if (session.type !== "user") {
        throw badRequest("Only users can set auth mode");
      }

      const { mode } = req.body;

      if (mode === "employee" && !session.canLogAsEmployee) {
        throw forbidden("Not authorized to log in as employee");
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
    },
  );

  /**
   * GET /auth/mode
   * Get current auth mode from cookie.
   */
  app.get("/mode", async (req, reply) => {
    const mode = req.cookies[AUTH_CONFIG.AUTH_MODE_COOKIE_NAME] || "customer";
    return reply.code(200).send({ mode });
  });
};
