/**
 * Auth email HTTP routes — integration checklist.
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
import crypto from "crypto";
import bcrypt from "bcrypt";

const sendEmailMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    channel: "email",
    success: true,
    sentCount: 1,
  }),
);

vi.mock("../../src/communications/channels/emailChannel.ts", () => ({
  default: { send: sendEmailMock },
}));

import {
  emailRailSuccess,
  expectOneAccountSend,
} from "../helpers/accountEmailRail.ts";
import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import { GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE } from "../../src/auth/requestEmailConfirmation.ts";
import {
  CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
  CONFIRM_EMAIL_SUCCESS_MESSAGE,
} from "../../src/auth/confirmEmail.ts";
import { RESET_PASSWORD_SUCCESS_MESSAGE } from "../../src/auth/resetPassword.ts";
import { PASSWORD_POLICY_MESSAGE } from "restaurant-pos-packages/utils/passwordPolicy";
import { VERIFICATION_TOKEN_TTL_MS } from "../../src/auth/authEmailTokenFlow.ts";

const testPassword = "TestPassword123!";
const newPassword = "NewPassword456!";

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function futureVerificationExpiry(): Date {
  return new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
}

function futureResetExpiry(): Date {
  return new Date(Date.now() + 3_600_000);
}

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
      emailVerified: false,
    },
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
      emailVerified: true,
    },
  });
}

describe("auth-email routes (checklist)", () => {
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
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(emailRailSuccess);
  });

  describe("POST /api/v1/auth/request-email-confirmation", () => {
    it("unknown email → 200 generic, no enumeration, no send", async () => {
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
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("known unverified account → 200 and sends", async () => {
      const app = await getTestApp();
      await createUnverifiedUser("phase71-known-confirm@example.com");
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/request-email-confirmation",
        payload: { email: "phase71-known-confirm@example.com" },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe(
        GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
      );
      const stored = await User.findOne({
        "personalDetails.email": "phase71-known-confirm@example.com",
      })
        .select("verificationToken")
        .lean();
      expectOneAccountSend(sendEmailMock, {
        to: "phase71-known-confirm@example.com",
        subject: "Confirm Your Email - POS",
        link: `/confirm-email?token=${stored?.verificationToken}`,
      });
    });
  });

  describe("POST /api/v1/auth/confirm-email", () => {
    it("valid token → success and clears verificationToken", async () => {
      const app = await getTestApp();
      const user = await createUnverifiedUser("phase71-confirm-ok@example.com");
      const raw = randomToken();
      await User.updateOne(
        { _id: user._id },
        { $set: { verificationToken: raw, verificationTokenExpires: futureVerificationExpiry() } },
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/confirm-email",
        payload: { token: raw },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).message).toBe(CONFIRM_EMAIL_SUCCESS_MESSAGE);

      const updated = await User.findById(user._id)
        .select("personalDetails.emailVerified verificationToken")
        .lean();
      expect(updated?.personalDetails?.emailVerified).toBe(true);
      expect(updated?.verificationToken).toBeFalsy();
    });

    it("invalid token → 400 consumption message", async () => {
      const app = await getTestApp();
      await createUnverifiedUser("phase71-confirm-bad@example.com");
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/confirm-email",
        payload: { token: randomToken() },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).detail).toBe(
        CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
      );
    });

    it("reused token → second request 400", async () => {
      const app = await getTestApp();
      const user = await createUnverifiedUser("phase71-confirm-replay@example.com");
      const raw = randomToken();
      await User.updateOne(
        { _id: user._id },
        { $set: { verificationToken: raw, verificationTokenExpires: futureVerificationExpiry() } },
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
      expect(JSON.parse(second.body).detail).toBe(
        CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
      );
    });
  });

  describe("POST /api/v1/auth/request-password-reset", () => {
    it("unknown email → 200 generic, no send", async () => {
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
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("known account → 200 and sends reset mail", async () => {
      const app = await getTestApp();
      await createVerifiedUserForReset("phase71-known-reset@example.com");
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/request-password-reset",
        payload: { email: "phase71-known-reset@example.com" },
      });
      expect(res.statusCode).toBe(200);
      const stored = await User.findOne({
        "personalDetails.email": "phase71-known-reset@example.com",
      })
        .select("resetPasswordToken")
        .lean();
      expectOneAccountSend(sendEmailMock, {
        to: "phase71-known-reset@example.com",
        subject: "Password Reset Request - POS",
        link: `/reset-password?token=${stored?.resetPasswordToken}`,
      });
    });
  });

  describe("POST /api/v1/auth/reset-password", () => {
    async function issueUserResetToken(userId: unknown) {
      const raw = randomToken();
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            resetPasswordToken: raw,
            resetPasswordExpires: futureResetExpiry(),
          },
        },
      );
      return raw;
    }

    it("valid token + policy password → 200 and login with new password", async () => {
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

    it("weak new password → 400 policy, token retained", async () => {
      const app = await getTestApp();
      const user = await createVerifiedUserForReset("phase71-reset-weak@example.com");
      const raw = await issueUserResetToken(user._id);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: raw, newPassword: "short" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).errors[0].message).toBe(PASSWORD_POLICY_MESSAGE);

      const row = await User.findById(user._id)
        .select("resetPasswordToken")
        .lean();
      expect(row?.resetPasswordToken).toBeTruthy();
    });

    it("invalid / expired token → 400", async () => {
      const app = await getTestApp();
      await createVerifiedUserForReset("phase71-reset-bad@example.com");

      const wrong = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: { token: randomToken(), newPassword },
      });
      expect(wrong.statusCode).toBe(400);

      const user = await createVerifiedUserForReset("phase71-reset-exp@example.com");
      const raw = randomToken();
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            resetPasswordToken: raw,
            resetPasswordExpires: new Date(Date.now() - 60_000),
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

    it("reused reset token → second POST 400", async () => {
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
