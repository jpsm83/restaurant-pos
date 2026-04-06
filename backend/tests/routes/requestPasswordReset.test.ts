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
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("../../src/auth/authEmailSend.ts", () => ({
  sendAuthTransactionalEmail: sendEmailMock,
}));

import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import Business from "../../src/models/business.ts";
import { GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE } from "../../src/auth/requestEmailConfirmation.ts";

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
    },
    ...(overrides?.emailVerified !== undefined
      ? { emailVerified: overrides.emailVerified }
      : {}),
  });
}

async function createTestBusiness(email: string) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return Business.create({
    tradeName: "Café Reset",
    legalName: "Café Reset Legal",
    email,
    password: hashedPassword,
    taxNumber: `TAX-${email.replace(/[@.]/g, "-")}`,
    phoneNumber: "1234567890",
    currencyTrade: "USD",
    emailVerified: true,
    address: {
      country: "USA",
      state: "CA",
      city: "LA",
      street: "Main St",
      buildingNumber: "123",
      postCode: "90001",
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
    sendEmailMock.mockResolvedValue(undefined);
  });

  it("returns 400 for invalid email", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "not-an-email" },
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe(
      "Please provide a valid email address",
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
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const updated = await User.findOne({
      "personalDetails.email": "verified-reset@example.com",
    })
      .select("resetPasswordToken resetPasswordExpires")
      .lean();
    expect(updated?.resetPasswordToken).toBeTruthy();
    expect(updated?.resetPasswordExpires).toBeTruthy();
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

  it("clears reset token and returns 500 when send fails", async () => {
    const app = await getTestApp();
    await createTestUser("fail-reset@example.com");
    sendEmailMock.mockRejectedValue(new Error("SMTP down"));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "fail-reset@example.com" },
    });

    expect(response.statusCode).toBe(500);
    const updated = await User.findOne({
      "personalDetails.email": "fail-reset@example.com",
    })
      .select("resetPasswordToken resetPasswordExpires")
      .lean();
    expect(updated?.resetPasswordToken).toBeFalsy();
    expect(updated?.resetPasswordExpires).toBeFalsy();
  });

  it("prefers business over user for the same email", async () => {
    const app = await getTestApp();
    const email = "shared-reset@example.com";
    await createTestBusiness(email);
    await createTestUser(email);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const biz = await Business.findOne({ email })
      .select("resetPasswordToken")
      .lean();
    const usr = await User.findOne({ "personalDetails.email": email })
      .select("resetPasswordToken")
      .lean();
    expect(biz?.resetPasswordToken).toBeTruthy();
    expect(usr?.resetPasswordToken).toBeFalsy();
  });
});
