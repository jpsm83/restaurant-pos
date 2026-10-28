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
import { withSoftDeleteFilter } from "../../models/softDelete.ts";
import { AUTH_CONFIG } from "../../auth/config.ts";
import {
  createAuthHook,
  isRejectedCredential,
  requireBusinessHook,
  requireLiveAccessSession,
  requireLiveAccessSessionWithRefreshId,
} from "../../auth/middleware.ts";
import { issueLiveTicket } from "../../auth/liveTicketStore.ts";
import type { AuthBusiness, AuthUser } from "../../auth/types.ts";
import {
  buildAuthUserSessionFromUserId,
  exchangeRefreshSession,
  issueSessionWithRefreshCookie,
  revokePresentedRefreshSession,
  signAccessToken,
} from "../../auth/issueSession.ts";
import {
  handleConfirmEmail,
} from "../../auth/confirmEmail.ts";
import {
  GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
  handleRequestEmailConfirmation,
  REACTIVATION_REQUIRED_MESSAGE,
  sendSoftDeletedUserConfirmation,
} from "../../auth/requestEmailConfirmation.ts";
import { sendAccountExistsEmail } from "../../auth/accountExistsEmail.ts";
import { handleRequestPasswordReset } from "../../auth/requestPasswordReset.ts";
import { handleRequestEmailChange } from "../../auth/requestEmailChange.ts";
import { handleConfirmEmailChange } from "../../auth/confirmEmailChange.ts";
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
  confirmEmailChangeBodySchema,
  loginBodySchema,
  requestEmailChangeBodySchema,
  requestEmailConfirmationBodySchema,
  requestPasswordResetBodySchema,
  resetPasswordBodySchema,
  setModeBodySchema,
  signupBodySchema,
  type ConfirmEmailBody,
  type ConfirmEmailChangeBody,
  type LoginBody,
  type RequestEmailChangeBody,
  type RequestEmailConfirmationBody,
  type RequestPasswordResetBody,
  type ResetPasswordBody,
  type SetModeBody,
  type SignupBody,
} from "restaurant-pos-packages/schemas/auth";

export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /auth/signup
   * Create a customer user account and return authenticated session.
   *
   * Only the credential and whatever names/language the person supplied are
   * stored. An active duplicate gets the account-exists email and the generic
   * outcome with no session, so sign-up cannot be used to enumerate accounts.
   */
  app.post<{ Body: SignupBody }>(
    "/signup",
    { schema: { body: signupBodySchema } },
    async (req, reply) => {
      const {
        email,
        password,
        username,
        firstName,
        lastName,
        languagePreference,
      } = req.body;

      const [existingBusiness, existingUser, deletedUser] = await Promise.all([
        Business.findOne({ email }).select("_id tradeName").lean(),
        User.findOne(withSoftDeleteFilter({ "personalDetails.email": email }))
          .select(
            "_id personalDetails.username personalDetails.firstName personalDetails.lastName",
          )
          .lean(),
        User.findOne({
          "personalDetails.email": email,
          deleted: true,
        })
          .select("_id personalDetails.username personalDetails.firstName")
          .lean(),
      ]);

      if (existingUser) {
        const greetingName =
          existingUser.personalDetails.username?.trim() ||
          existingUser.personalDetails.firstName?.trim();
        const sent = await sendAccountExistsEmail({
          to: email,
          greetingName,
        });
        if (!sent) {
          req.log.error(
            { errHint: "signup_account_exists_send" },
            "Account-exists email failed",
          );
        }
        return reply.code(202).send({
          message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
        });
      }
      if (deletedUser) {
        const sent = await sendSoftDeletedUserConfirmation(deletedUser, email);
        if (sent.kind === "server_error_500") {
          throw internal(sent.message);
        }
        return reply.code(202).send({ message: REACTIVATION_REQUIRED_MESSAGE });
      }
      if (existingBusiness) {
        const sent = await sendAccountExistsEmail({
          to: email,
          greetingName: existingBusiness.tradeName?.trim(),
        });
        if (!sent) {
          req.log.error(
            { errHint: "signup_account_exists_send" },
            "Account-exists email failed",
          );
        }
        return reply.code(202).send({
          message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const createdUser = await User.create({
        languagePreference,
        personalDetails: {
          email,
          password: hashedPassword,
          ...(username ? { username } : {}),
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
        },
      });

      const session: AuthUser = {
        id: String(createdUser._id),
        email,
        type: "user",
        emailVerified: createdUser.personalDetails?.emailVerified === true,
        languagePreference: createdUser.languagePreference,
        role: "Customer",
      };


      const { accessToken, user } = await issueSessionWithRefreshCookie(
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
    const session = await requireLiveAccessSession(app, token);

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
   * POST /auth/request-email-change
   * Authenticated business: start a verified sign-in email change. The current
   * email stays active until the new address confirms the emailed link.
   */
  app.post<{ Body: RequestEmailChangeBody }>(
    "/request-email-change",
    {
      preValidation: [createAuthHook(app), requireBusinessHook()],
      schema: { body: requestEmailChangeBodySchema },
    },
    async (req, reply) => {
      const session = req.authSession as AuthBusiness;
      const result = await handleRequestEmailChange(session, req.body, req.log);

      if (result.kind === "account_not_found") {
        throw unauthorized("Account not found.");
      }
      if (result.kind === "invalid_password") {
        throw unauthorized("Current password is incorrect.");
      }
      if (result.kind === "same_email") {
        throw badRequest(
          "The new email must be different from the current sign-in email.",
          [
            {
              path: "newEmail",
              message: "Enter an address different from your current one.",
            },
          ],
        );
      }
      if (result.kind === "email_taken") {
        throw conflict("That email is already used by another account.");
      }
      if (result.kind === "throttled") {
        return reply.code(200).send({ message: result.message });
      }
      if (result.kind === "server_error_500") {
        throw internal(result.message);
      }

      return reply.code(200).send({ message: result.message });
    },
  );

  /**
   * POST /auth/confirm-email-change
   * Unauthenticated: consume the pending sign-in email change token (one-time).
   * On success the pending address becomes the sign-in email, all refresh
   * sessions are revoked, and the previous address is notified.
   */
  app.post<{ Body: ConfirmEmailChangeBody }>(
    "/confirm-email-change",
    { schema: { body: confirmEmailChangeBodySchema } },
    async (req, reply) => {
      const result = await handleConfirmEmailChange(req.body.token, req.log);

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
   * POST /auth/login
   * Authenticate with email/password, returns access token and sets refresh cookie.
   *
   * Flow:
   * 1. Check Business collection by email
   * 2. If not found, check User collection by personalDetails.email
   * 3. Resolve any active Employee membership and its canLogAsEmployee gate
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

        const { accessToken, user } = await issueSessionWithRefreshCookie(
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
        ...withSoftDeleteFilter({ "personalDetails.email": email }),
      })
        .select(
          "_id personalDetails.email personalDetails.password refreshSessionVersion",
        )
        .lean()) as {
        _id: unknown;
        personalDetails: {
          email?: string;
          password?: string;
        };
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

      // 3. Resolve the active Employee membership, if any
      const session = await buildAuthUserSessionFromUserId(String(user._id));
      if (!session) {
        throw unauthorized("Invalid credentials");
      }

      const { accessToken, user: userOut } = await issueSessionWithRefreshCookie(
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
      reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
      throw unauthorized("No refresh token provided");
    }

    const exchanged = await exchangeRefreshSession(app, refreshToken);
    if (exchanged.kind === "invalid") {
      reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
      throw unauthorized("Invalid or expired refresh token");
    }
    if (exchanged.kind === "account_missing") {
      reply.clearCookie(AUTH_CONFIG.REFRESH_COOKIE_NAME, { path: "/" });
      throw unauthorized(
        exchanged.accountType === "business"
          ? "Business not found"
          : "User not found",
      );
    }

    const accessToken = signAccessToken(
      app,
      exchanged.session,
      exchanged.sessionId,
    );

    return reply.code(200).send({
      accessToken,
      user: exchanged.session,
    });
  });

  /**
   * POST /auth/logout
   * Revoke the presented refresh session, then clear the refresh and auth-mode cookies.
   * A missing cookie still succeeds and still clears both cookies.
   */
  app.post("/logout", async (req, reply) => {
    await revokePresentedRefreshSession(
      app,
      req.cookies[AUTH_CONFIG.REFRESH_COOKIE_NAME],
    );
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
    const live = await requireLiveAccessSession(app, token);

    // The User's profile is DB-authoritative: a profile save does not mint a
    // new access token, so the JWT claim may lag the stored language/verified
    // flag. Rebuild the User session on read.
    if (live.type === "user") {
      const freshUser = await buildAuthUserSessionFromUserId(live.id);
      if (!freshUser) {
        throw unauthorized("Invalid or expired access token");
      }
      return reply.code(200).send({ user: freshUser });
    }

    return reply.code(200).send({ user: live });
  });

  /**
   * POST /auth/live-ticket
   * Exchange a live access session for a one-minute, single-use ticket the
   * browser can carry on the WebSocket upgrade URL. The access JWT itself never
   * goes in a URL.
   */
  app.post("/live-ticket", async (req, reply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw unauthorized("No access token provided");
    }

    try {
      const { session, sessionId } = await requireLiveAccessSessionWithRefreshId(
        app,
        authHeader.slice(7),
      );
      const issued = issueLiveTicket({
        sessionId,
        accountId: session.id,
        accountType: session.type,
      });
      return reply.code(201).send(issued);
    } catch (error) {
      if (isRejectedCredential(error)) {
        throw unauthorized("Invalid or expired access token");
      }
      throw error;
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
      const session = await requireLiveAccessSession(app, token);

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
