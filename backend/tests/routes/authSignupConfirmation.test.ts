/**
 * POST /api/v1/auth/signup — confirmation email trigger
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

const sendEmailMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("../../src/auth/authEmailSend.ts", () => ({
  sendAuthTransactionalEmail: sendEmailMock,
}));

import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";

async function waitForUserVerificationToken(
  email: string,
  opts?: { expectPresent: boolean },
): Promise<void> {
  const expectPresent = opts?.expectPresent ?? true;
  const maxAttempts = 280;
  for (let i = 0; i < maxAttempts; i++) {
    const row = await User.findOne({ "personalDetails.email": email })
      .select("verificationToken")
      .lean();
    const has = Boolean(row?.verificationToken);
    if (expectPresent ? has : !has) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(
    expectPresent
      ? "timeout waiting for verificationToken"
      : "timeout waiting for token to stay cleared",
  );
}

async function waitForSendMockCalls(count: number): Promise<void> {
  const maxAttempts = 280;
  for (let i = 0; i < maxAttempts; i++) {
    if (sendEmailMock.mock.calls.length >= count) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(`timeout waiting for ${count} send mock call(s)`);
}

describe("POST /api/v1/auth/signup (confirmation email)", () => {
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

  it("returns 201 with session immediately and persists verification token after send", async () => {
    const app = await getTestApp();
    const email = `newuser-${Date.now()}@example.com`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        firstName: "Pat",
        lastName: "Lee",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.user?.type).toBe("user");
    expect(body.user?.email).toBe(email);

    await waitForUserVerificationToken(email);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("still returns 201 when confirmation send fails (token cleared)", async () => {
    const app = await getTestApp();
    const email = `rollback-${Date.now()}@example.com`;

    sendEmailMock.mockRejectedValue(new Error("SMTP down"));

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
      },
    });

    expect(res.statusCode).toBe(201);
    await waitForSendMockCalls(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    await waitForUserVerificationToken(email, { expectPresent: false });
  });

  it("returns a reactivation gate response when signup email belongs to a soft-deleted user", async () => {
    const app = await getTestApp();
    const email = `reactivate-${Date.now()}@example.com`;

    await User.create({
      deleted: true,
      deletedAt: new Date(),
      personalDetails: {
        username: "reactivate-user",
        email,
        password: "hashedpassword",
        firstName: "Re",
        lastName: "Activate",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Other",
        nationality: "USA",
        idType: "Passport",
        idNumber: `ID-${Date.now()}`,
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
      },
      emailVerified: false,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        firstName: "Pat",
        lastName: "Lee",
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("reactivation");

    const allRows = await User.find({ "personalDetails.email": email }).lean();
    expect(allRows).toHaveLength(1);
    expect(allRows[0].deleted).toBe(true);
    expect(allRows[0].verificationToken).toBeTruthy();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});
