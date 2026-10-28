/**
 * POST /api/v1/auth/request-password-reset
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
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
  emailRailFailure,
  emailRailSuccess,
  expectOneAccountSend,
} from "../helpers/accountEmailRail.ts";
import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import { GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE } from "../../src/auth/requestEmailConfirmation.ts";
import { PASSWORD_RESET_TOKEN_TTL_MS } from "../../src/auth/authEmailTokenFlow.ts";

const testPassword = "TestPassword123!";

async function createTestUser(
  email: string,
  overrides?: { emailVerified?: boolean },
) {
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
      ...(overrides?.emailVerified !== undefined
        ? { emailVerified: overrides.emailVerified }
        : {}),
    },
  });
}

describe("POST /api/v1/auth/request-password-reset", () => {
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

  it("returns 400 for invalid email", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "not-an-email" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    const body = JSON.parse(response.body);
    expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
    expect(body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "email" })]),
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 200 generic when no account exists", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "ghost@example.com" },
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends reset for verified user", async () => {
    const app = await getTestApp();
    await createTestUser("verified-reset@example.com", {
      emailVerified: true,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "verified-reset@example.com" },
    });

    expect(response.statusCode).toBe(200);
    const updated = await User.findOne({
      "personalDetails.email": "verified-reset@example.com",
    })
      .select("resetPasswordToken resetPasswordExpires")
      .lean();
    expect(updated?.resetPasswordToken).toBeTruthy();
    expect(updated?.resetPasswordExpires).toBeTruthy();
    const ttl = updated!.resetPasswordExpires!.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(PASSWORD_RESET_TOKEN_TTL_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(PASSWORD_RESET_TOKEN_TTL_MS);
    expectOneAccountSend(sendEmailMock, {
      to: "verified-reset@example.com",
      subject: "Password Reset Request - POS",
      link: `/reset-password?token=${updated?.resetPasswordToken}`,
    });
  });

  it("issues reset token and sends email for unverified user", async () => {
    const app = await getTestApp();
    await createTestUser("user-reset@example.com", { emailVerified: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "user-reset@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const updated = await User.findOne({
      "personalDetails.email": "user-reset@example.com",
    })
      .select("resetPasswordToken resetPasswordExpires")
      .lean();
    expect(updated?.resetPasswordToken).toBeTruthy();
    expect(updated?.resetPasswordExpires).toBeTruthy();
  });

  it("supersedes the previous reset link on a new request", async () => {
    const app = await getTestApp();
    await createTestUser("reset-supersede@example.com");

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "reset-supersede@example.com" },
    });
    expect(first.statusCode).toBe(200);
    const firstStored = await User.findOne({
      "personalDetails.email": "reset-supersede@example.com",
    })
      .select("resetPasswordToken resetPasswordExpires")
      .lean();

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "reset-supersede@example.com" },
    });
    expect(second.statusCode).toBe(200);
    const secondStored = await User.findOne({
      "personalDetails.email": "reset-supersede@example.com",
    })
      .select("resetPasswordToken resetPasswordExpires")
      .lean();

    expect(secondStored?.resetPasswordToken).toBeTruthy();
    expect(secondStored?.resetPasswordToken).not.toBe(
      firstStored?.resetPasswordToken,
    );
    expect(secondStored?.resetPasswordExpires?.getTime()).toBeGreaterThanOrEqual(
      firstStored!.resetPasswordExpires!.getTime(),
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("clears reset token and returns 500 when send fails", async () => {
    const app = await getTestApp();
    await createTestUser("fail-reset@example.com");
    sendEmailMock.mockResolvedValue(emailRailFailure);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "fail-reset@example.com" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json().detail).toBe(
      "Failed to send password reset email. Please try again later.",
    );
    const updated = await User.findOne({
      "personalDetails.email": "fail-reset@example.com",
    })
      .select("resetPasswordToken resetPasswordExpires")
      .lean();
    expect(updated?.resetPasswordToken).toBeFalsy();
    expect(updated?.resetPasswordExpires).toBeFalsy();
  });

});
