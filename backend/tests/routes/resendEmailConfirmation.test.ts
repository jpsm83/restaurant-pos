/**
 * POST /api/v1/auth/resend-email-confirmation
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
import { Types } from "mongoose";

const sendEmailMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("../../src/auth/authEmailSend.ts", () => ({
  sendAuthTransactionalEmail: sendEmailMock,
}));

import { generateTestToken, getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import Business from "../../src/models/business.ts";
import { GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE } from "../../src/auth/requestEmailConfirmation.ts";
import { RESEND_EMAIL_ALREADY_VERIFIED_MESSAGE } from "../../src/auth/resendEmailConfirmation.ts";

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

async function createTestBusiness(
  email: string,
  overrides?: { emailVerified?: boolean },
) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return Business.create({
    tradeName: "Café Test",
    legalName: "Café Test Legal",
    email,
    password: hashedPassword,
    taxNumber: `TAX-${email.replace(/[@.]/g, "-")}`,
    phoneNumber: "1234567890",
    currencyTrade: "USD",
    emailVerified: overrides?.emailVerified ?? false,
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

describe("POST /api/v1/auth/resend-email-confirmation", () => {
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

  it("returns 401 without Bearer token", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-email-confirmation",
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns 401 for invalid token", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-email-confirmation",
      headers: { authorization: "Bearer not-a-jwt" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns 401 when session id has no matching account", async () => {
    const app = await getTestApp();
    const token = await generateTestToken({
      id: new Types.ObjectId().toString(),
      email: "ghost@example.com",
      type: "user",
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-email-confirmation",
      headers: { authorization: token },
    });
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Account not found.");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 already verified for user without sending", async () => {
    const app = await getTestApp();
    const u = await createTestUser("verified-resend@example.com", {
      emailVerified: true,
    });
    const token = await generateTestToken({
      id: String(u._id),
      email: "verified-resend@example.com",
      type: "user",
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-email-confirmation",
      headers: { authorization: token },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe(RESEND_EMAIL_ALREADY_VERIFIED_MESSAGE);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 200 and sends for unverified user", async () => {
    const app = await getTestApp();
    const u = await createTestUser("pending-resend@example.com", {
      emailVerified: false,
    });
    const token = await generateTestToken({
      id: String(u._id),
      email: "pending-resend@example.com",
      type: "user",
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-email-confirmation",
      headers: { authorization: token },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe(GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 already verified for business without sending", async () => {
    const app = await getTestApp();
    const b = await createTestBusiness("biz-verified@example.com", {
      emailVerified: true,
    });
    const token = await generateTestToken({
      id: String(b._id),
      email: "biz-verified@example.com",
      type: "business",
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-email-confirmation",
      headers: { authorization: token },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe(RESEND_EMAIL_ALREADY_VERIFIED_MESSAGE);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 200 and sends for unverified business", async () => {
    const app = await getTestApp();
    const b = await createTestBusiness("biz-pending@example.com", {
      emailVerified: false,
    });
    const token = await generateTestToken({
      id: String(b._id),
      email: "biz-pending@example.com",
      type: "business",
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-email-confirmation",
      headers: { authorization: token },
    });
    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});
