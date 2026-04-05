/**
 * Phase 7.1 — Auth email **HTTP route** checklist (`TODO-auth-email-security-flows-implementation.md`).
 *
 * **Deeper / extra scenarios** live alongside: `requestEmailConfirmation.test.ts`,
 * `confirmEmail.test.ts`, `requestPasswordReset.test.ts`, `resetPassword.test.ts`,
 * `resendEmailConfirmation.test.ts`, `authSignupConfirmation.test.ts`, `businessRegistrationConfirmation.test.ts`.
 *
 * **Module-level tests** (`vitest run tests/auth`): `emailToken.test.ts`, `emailLinks.test.ts`,
 * `emailTemplates.test.ts`, `authEmailRateLimit.test.ts`, `confirmEmail.test.ts` (unit),
 * `resetPassword.test.ts` (unit), `verificationIntent*.test.ts`.
 *
 * **Send rollback on failure:** `requestEmailConfirmation.test.ts`, `requestPasswordReset.test.ts`.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import bcrypt from "bcrypt";

const sendWithRollbackMock = vi.fn();

vi.mock("../../src/auth/authEmailSend.ts", () => ({
  sendAuthTransactionalEmail: vi.fn(),
  sendAuthTransactionalEmailWithRollback: (...args: unknown[]) =>
    sendWithRollbackMock(...args),
}));

import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import { __resetAuthEmailRateLimitsForTests } from "../../src/auth/authEmailRateLimit.ts";
import { GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE } from "../../src/auth/requestEmailConfirmation.ts";
import {
  computeEmailVerificationExpiry,
  computePasswordResetExpiry,
  generateRawEmailToken,
  hashEmailToken,
} from "../../src/auth/emailToken.ts";
import {
  CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
  CONFIRM_EMAIL_SUCCESS_MESSAGE,
} from "../../src/auth/confirmEmail.ts";
import {
  RESET_PASSWORD_SUCCESS_MESSAGE,
} from "../../src/auth/resetPassword.ts";
import { PASSWORD_POLICY_MESSAGE } from "../../../packages/utils/passwordPolicy.ts";

const testPassword = "TestPassword123!";
const newPassword = "NewPassword456!";

async function createUnverifiedUser(email: string) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return User.create({
    personalDetails: {
      email,
      password: hashedPassword,
      firstName: "Test",
      lastName: "User",
      phoneNumber: "1234567890",
      birthDate: new Date("1990-01-01"),
      gender: "Man",
      nationality: "USA",
      address: {
        country: "USA",
        state: "CA",
        city: "LA",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
      idNumber: `ID-${email}`,
      idType: "Passport",
      username: "testuser",
    },
    allUserRoles: ["Customer"],
    emailVerified: false,
  });
}

async function createVerifiedUserForReset(email: string) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return User.create({
    personalDetails: {
      email,
      password: hashedPassword,
      firstName: "Test",
      lastName: "User",
      phoneNumber: "1234567890",
      birthDate: new Date("1990-01-01"),
      gender: "Man",
      nationality: "USA",
      address: {
        country: "USA",
        state: "CA",
        city: "LA",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
      idNumber: `ID-${email}`,
      idType: "Passport",
      username: "testuser",
    },
    allUserRoles: ["Customer"],
    emailVerified: true,
  });
}

describe("Phase 7.1 — auth-email routes (checklist)", () => {
  beforeAll(async () => {
    if (!process.env.APP_BASE_URL?.trim()) {
      process.env.APP_BASE_URL = "http://127.0.0.1:3000";
    }
    await resetTestApp();
  });

  afterAll(async () => {
    await resetTestApp();
  });

  beforeEach(() => {
    sendWithRollbackMock.mockReset();
    sendWithRollbackMock.mockResolvedValue(undefined);
    __resetAuthEmailRateLimitsForTests();
    delete process.env.AUTH_EMAIL_RATE_LIMIT_IP_MAX;
    delete process.env.AUTH_EMAIL_RATE_LIMIT_IP_WINDOW_MS;
    delete process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX;
    delete process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS;
  });

  describe("POST /api/v1/auth/request-email-confirmation", () => {
    it("7.1: unknown email → 200 generic, no enumeration, no send", async () => {
      const app = await getTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/request-email-confirmation",
        payload: { email: "phase71-unknown-confirm@example.com" },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe(
        GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
      );
      expect(sendWithRollbackMock).not.toHaveBeenCalled();
    });

    it("7.1: known unverified account → 200 and sends", async () => {
      const app = await getTestApp();
      await createUnverifiedUser("phase71-known-confirm@example.com");
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/request-email-confirmation",
        payload: { email: "phase71-known-confirm@example.com" },
      });
      expect(res.statusCode).toBe(200);
      expect(sendWithRollbackMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /api/v1/auth/confirm-email", () => {
    it("7.1: valid token → success and clears verification fields", async () => {
      const app = await getTestApp();
      const user = await createUnverifiedUser("phase71-confirm-ok@example.com");
      const raw = generateRawEmailToken();
      const tokenHash = hashEmailToken(raw);
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            emailVerificationTokenHash: tokenHash,
            emailVerificationExpiresAt: computeEmailVerificationExpiry(),
          },
        },
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/confirm-email",
        payload: { token: raw },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe(CONFIRM_EMAIL_SUCCESS_MESSAGE);

      const updated = await User.findById(user._id)
        .select("emailVerified emailVerificationTokenHash")
        .lean();
      expect(updated?.emailVerified).toBe(true);
      expect(updated?.emailVerificationTokenHash).toBeFalsy();
    });

    it("7.1: invalid token → 400 consumption message", async () => {
      const app = await getTestApp();
      await createUnverifiedUser("phase71-confirm-bad@example.com");
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/confirm-email",
        payload: { token: generateRawEmailToken() },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toBe(
        CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
      );
    });

    it("7.1: expired token → 400", async () => {
      const app = await getTestApp();
      const user = await createUnverifiedUser("phase71-confirm-exp@example.com");
      const raw = generateRawEmailToken();
      const tokenHash = hashEmailToken(raw);
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            emailVerificationTokenHash: tokenHash,
            emailVerificationExpiresAt: new Date(Date.now() - 60_000),
          },
        },
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/confirm-email",
        payload: { token: raw },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toBe(
        CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
      );
    });

    it("7.1: reused token → second request 400", async () => {
      const app = await getTestApp();
      const user = await createUnverifiedUser("phase71-confirm-replay@example.com");
      const raw = generateRawEmailToken();
      const tokenHash = hashEmailToken(raw);
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            emailVerificationTokenHash: tokenHash,
            emailVerificationExpiresAt: computeEmailVerificationExpiry(),
          },
        },
      );

      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/confirm-email",
            payload: { token: raw },
          })
        ).statusCode,
      ).toBe(200);

      const second = await app.inject({
        method: "POST",
        url: "/api/v1/auth/confirm-email",
        payload: { token: raw },
      });
      expect(second.statusCode).toBe(400);
      expect(JSON.parse(second.body).message).toBe(
        CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
      );
    });
  });

  describe("POST /api/v1/auth/request-password-reset", () => {
    it("7.1: unknown email → 200 generic, no send", async () => {
      const app = await getTestApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/request-password-reset",
        payload: { email: "phase71-unknown-reset@example.com" },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe(
        GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
      );
      expect(sendWithRollbackMock).not.toHaveBeenCalled();
    });

    it("7.1: known account → 200 and sends reset mail", async () => {
      const app = await getTestApp();
      await createVerifiedUserForReset("phase71-known-reset@example.com");
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/request-password-reset",
        payload: { email: "phase71-known-reset@example.com" },
      });
      expect(res.statusCode).toBe(200);
      expect(sendWithRollbackMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /api/v1/auth/reset-password", () => {
    async function issueUserResetToken(userId: unknown) {
      const raw = generateRawEmailToken();
      const tokenHash = hashEmailToken(raw);
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: computePasswordResetExpiry(),
          },
        },
      );
      return raw;
    }

    it("7.1: valid token + policy password → 200 and login with new password", async () => {
      const app = await getTestApp();
      const user = await createVerifiedUserForReset("phase71-reset-ok@example.com");
      const raw = await issueUserResetToken(user._id);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: raw, newPassword },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe(RESET_PASSWORD_SUCCESS_MESSAGE);

      const login = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "phase71-reset-ok@example.com", password: newPassword },
      });
      expect(login.statusCode).toBe(200);
    });

    it("7.1: weak new password → 400 policy, token retained", async () => {
      const app = await getTestApp();
      const user = await createVerifiedUserForReset("phase71-reset-weak@example.com");
      const raw = await issueUserResetToken(user._id);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: raw, newPassword: "short" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toBe(PASSWORD_POLICY_MESSAGE);

      const row = await User.findById(user._id)
        .select("passwordResetTokenHash")
        .lean();
      expect(row?.passwordResetTokenHash).toBeTruthy();
    });

    it("7.1: invalid / expired token → 400", async () => {
      const app = await getTestApp();
      await createVerifiedUserForReset("phase71-reset-bad@example.com");

      const wrong = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: generateRawEmailToken(), newPassword },
      });
      expect(wrong.statusCode).toBe(400);

      const user = await createVerifiedUserForReset("phase71-reset-exp@example.com");
      const raw = generateRawEmailToken();
      const tokenHash = hashEmailToken(raw);
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: new Date(Date.now() - 60_000),
          },
        },
      );

      const expired = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: raw, newPassword },
      });
      expect(expired.statusCode).toBe(400);
    });

    it("7.1: reused reset token → second POST 400", async () => {
      const app = await getTestApp();
      const user = await createVerifiedUserForReset("phase71-reset-replay@example.com");
      const raw = await issueUserResetToken(user._id);

      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/reset-password",
            payload: { token: raw, newPassword },
          })
        ).statusCode,
      ).toBe(200);

      const second = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: raw, newPassword: "OtherPassword456!" },
      });
      expect(second.statusCode).toBe(400);
    });
  });
});
