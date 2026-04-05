/**
 * POST /api/v1/auth/request-email-confirmation (Phase 3.1)
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

async function createTestUser(email: string, overrides?: { emailVerified?: boolean }) {
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

describe("POST /api/v1/auth/request-email-confirmation", () => {
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
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "not-an-email" },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Please provide a valid email address");
    expect(sendWithRollbackMock).not.toHaveBeenCalled();
  });

  it("returns 200 generic message when no account exists", async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "nobody@example.com" },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe(GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE);
    expect(sendWithRollbackMock).not.toHaveBeenCalled();
  });

  it("returns 200 generic when already verified (no email sent)", async () => {
    const app = await getTestApp();
    await createTestUser("verified@example.com", { emailVerified: true });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "verified@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(sendWithRollbackMock).not.toHaveBeenCalled();
  });

  it("issues token and sends email for unverified user", async () => {
    const app = await getTestApp();
    await createTestUser("pending@example.com", { emailVerified: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "pending@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(sendWithRollbackMock).toHaveBeenCalledTimes(1);

    const updated = await User.findOne({
      "personalDetails.email": "pending@example.com",
    })
      .select("emailVerificationTokenHash emailVerificationExpiresAt")
      .lean();
    expect(updated?.emailVerificationTokenHash).toBeTruthy();
    expect(updated?.emailVerificationExpiresAt).toBeTruthy();
  });

  it("clears token and returns 500 when send fails", async () => {
    const app = await getTestApp();
    await createTestUser("failsend@example.com", { emailVerified: false });
    sendWithRollbackMock.mockImplementation(
      async (options: { rollback: () => Promise<void> }) => {
        await options.rollback();
        throw new Error("SMTP down");
      },
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "failsend@example.com" },
    });

    expect(response.statusCode).toBe(500);
    const updated = await User.findOne({
      "personalDetails.email": "failsend@example.com",
    })
      .select("emailVerificationTokenHash emailVerificationExpiresAt")
      .lean();
    expect(updated?.emailVerificationTokenHash).toBeFalsy();
    expect(updated?.emailVerificationExpiresAt).toBeFalsy();
  });

  it("returns 429 when IP rate limit exceeded", async () => {
    process.env.AUTH_EMAIL_RATE_LIMIT_IP_MAX = "2";
    process.env.AUTH_EMAIL_RATE_LIMIT_IP_WINDOW_MS = "3600000";

    const app = await getTestApp();

    const opts = {
      method: "POST" as const,
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "nobody@example.com" },
      remoteAddress: "192.168.55.55",
    };

    expect((await app.inject(opts)).statusCode).toBe(200);
    expect((await app.inject(opts)).statusCode).toBe(200);
    const third = await app.inject(opts);
    expect(third.statusCode).toBe(429);
    const body = JSON.parse(third.body);
    expect(body.message).toBe("Too many requests. Please try again later.");
  });

  it("returns 200 without rotating token when per-email send cap is reached", async () => {
    process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_MAX = "2";
    process.env.AUTH_EMAIL_RATE_LIMIT_EMAIL_WINDOW_MS = "3600000";

    const app = await getTestApp();
    await createTestUser("throttled@example.com", { emailVerified: false });

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "throttled@example.com" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "throttled@example.com" },
    });

    const afterSecond = await User.findOne({
      "personalDetails.email": "throttled@example.com",
    })
      .select("emailVerificationTokenHash")
      .lean();
    const hashAfterSecond = afterSecond?.emailVerificationTokenHash;

    const third = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "throttled@example.com" },
    });
    expect(third.statusCode).toBe(200);
    expect(sendWithRollbackMock).toHaveBeenCalledTimes(2);

    const afterThird = await User.findOne({
      "personalDetails.email": "throttled@example.com",
    })
      .select("emailVerificationTokenHash")
      .lean();
    expect(afterThird?.emailVerificationTokenHash).toBe(hashAfterSecond);
  });

  it("prefers business over user for the same email", async () => {
    const app = await getTestApp();
    const email = "shared@example.com";
    await createTestBusiness(email, { emailVerified: false });
    await createTestUser(email, { emailVerified: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email },
    });

    expect(response.statusCode).toBe(200);
    expect(sendWithRollbackMock).toHaveBeenCalledTimes(1);
    const firstCall = sendWithRollbackMock.mock.calls[0]?.[0] as {
      correlationId?: string;
    };
    expect(firstCall.correlationId).toMatch(/^email-confirm-business:/);

    const biz = await Business.findOne({ email }).select("emailVerificationTokenHash").lean();
    const usr = await User.findOne({ "personalDetails.email": email })
      .select("emailVerificationTokenHash")
      .lean();
    expect(biz?.emailVerificationTokenHash).toBeTruthy();
    expect(usr?.emailVerificationTokenHash).toBeFalsy();
  });
});
