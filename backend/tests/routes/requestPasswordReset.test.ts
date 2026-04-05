/**
 * POST /api/v1/auth/request-password-reset (Phase 3.3)
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

const sendWithRollbackMock = vi.fn();

vi.mock("../../src/auth/authEmailSend.ts", () => ({
  sendAuthTransactionalEmail: vi.fn(),
  sendAuthTransactionalEmailWithRollback: (...args: unknown[]) =>
    sendWithRollbackMock(...args),
}));

import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import Business from "../../src/models/business.ts";
import { __resetAuthEmailRateLimitsForTests } from "../../src/auth/authEmailRateLimit.ts";
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
    allUserRoles: ["Customer"],
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
    sendWithRollbackMock.mockReset();
    sendWithRollbackMock.mockResolvedValue(undefined);
    __resetAuthEmailRateLimitsForTests();
    delete process.env.AUTH_EMAIL_RATE_LIMIT_IP_MAX;
    delete process.env.AUTH_EMAIL_RATE_LIMIT_IP_WINDOW_MS;
    delete process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX;
    delete process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS;
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
    expect(sendWithRollbackMock).not.toHaveBeenCalled();
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
    expect(sendWithRollbackMock).not.toHaveBeenCalled();
  });

  it("sends reset for verified user (unlike confirmation request)", async () => {
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
    expect(sendWithRollbackMock).toHaveBeenCalledTimes(1);
    const updated = await User.findOne({
      "personalDetails.email": "verified-reset@example.com",
    })
      .select("passwordResetTokenHash passwordResetExpiresAt")
      .lean();
    expect(updated?.passwordResetTokenHash).toBeTruthy();
    expect(updated?.passwordResetExpiresAt).toBeTruthy();
  });

  it("issues reset token and sends email for user", async () => {
    const app = await getTestApp();
    await createTestUser("user-reset@example.com", { emailVerified: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "user-reset@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(sendWithRollbackMock).toHaveBeenCalledTimes(1);
    const updated = await User.findOne({
      "personalDetails.email": "user-reset@example.com",
    })
      .select("passwordResetTokenHash passwordResetExpiresAt")
      .lean();
    expect(updated?.passwordResetTokenHash).toBeTruthy();
    expect(updated?.passwordResetExpiresAt).toBeTruthy();
  });

  it("clears reset token and returns 500 when send fails", async () => {
    const app = await getTestApp();
    await createTestUser("fail-reset@example.com");
    sendWithRollbackMock.mockImplementation(
      async (options: { rollback: () => Promise<void> }) => {
        await options.rollback();
        throw new Error("SMTP down");
      },
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "fail-reset@example.com" },
    });

    expect(response.statusCode).toBe(500);
    const updated = await User.findOne({
      "personalDetails.email": "fail-reset@example.com",
    })
      .select("passwordResetTokenHash passwordResetExpiresAt")
      .lean();
    expect(updated?.passwordResetTokenHash).toBeFalsy();
    expect(updated?.passwordResetExpiresAt).toBeFalsy();
  });

  it("returns 429 on its own IP bucket (not shared with confirmation)", async () => {
    process.env.AUTH_EMAIL_RATE_LIMIT_IP_MAX = "2";
    process.env.AUTH_EMAIL_RATE_LIMIT_IP_WINDOW_MS = "3600000";

    const app = await getTestApp();

    const resetOpts = {
      method: "POST" as const,
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "ghost@example.com" },
      remoteAddress: "10.20.30.40",
    };

    expect((await app.inject(resetOpts)).statusCode).toBe(200);
    expect((await app.inject(resetOpts)).statusCode).toBe(200);
    const third = await app.inject(resetOpts);
    expect(third.statusCode).toBe(429);

    const confirmOpts = {
      method: "POST" as const,
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "ghost@example.com" },
      remoteAddress: "10.20.30.40",
    };
    expect((await app.inject(confirmOpts)).statusCode).toBe(200);
  });

  it("uses a separate per-email send cap from confirmation (Phase 6 intents)", async () => {
    process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX = "2";
    process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS = "3600000";

    const app = await getTestApp();
    await createTestUser("combo-cap@example.com");

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "combo-cap@example.com" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "combo-cap@example.com" },
    });
    expect(sendWithRollbackMock).toHaveBeenCalledTimes(2);

    const resetResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: "combo-cap@example.com" },
    });
    expect(resetResponse.statusCode).toBe(200);
    expect(sendWithRollbackMock).toHaveBeenCalledTimes(3);

    const updated = await User.findOne({
      "personalDetails.email": "combo-cap@example.com",
    })
      .select("passwordResetTokenHash")
      .lean();
    expect(updated?.passwordResetTokenHash).toBeTruthy();
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
    expect(sendWithRollbackMock).toHaveBeenCalledTimes(1);
    const firstCall = sendWithRollbackMock.mock.calls[0]?.[0] as {
      correlationId?: string;
    };
    expect(firstCall.correlationId).toMatch(/^pwd-reset-business:/);

    const biz = await Business.findOne({ email })
      .select("passwordResetTokenHash")
      .lean();
    const usr = await User.findOne({ "personalDetails.email": email })
      .select("passwordResetTokenHash")
      .lean();
    expect(biz?.passwordResetTokenHash).toBeTruthy();
    expect(usr?.passwordResetTokenHash).toBeFalsy();
  });
});
