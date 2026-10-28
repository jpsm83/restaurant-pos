/**
 * Account one-time-link mail on the real delivery rail.
 *
 * The operational-email switch is off. A non-production sink success keeps the
 * pending link. A rail failure clears it and returns the confirmation error.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import bcrypt from "bcrypt";
import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import { EMAIL_CONFIRMATION_SENT_MESSAGE } from "../../src/auth/requestEmailConfirmation.ts";

const sendMail = vi.hoisted(() =>
  vi.fn().mockRejectedValue(new Error("550 mailbox unavailable")),
);

vi.mock("../../src/communications/providers/smtpProvider.ts", () => ({
  getSmtpProviderState: () => ({
    enabled: true,
    fromAddress: "platform@example.com",
    transport: { sendMail },
  }),
}));

const testPassword = "TestPassword123!";

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
      username: `user-${email}`,
      emailVerified: false,
    },
  });
}

describe("account one-time-link mail on the delivery rail", () => {
  const previousSink = process.env.AUTH_EMAIL_DEV_SINK_ENABLED;
  const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
  const previousNodeEnv = process.env.NODE_ENV;

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
    sendMail.mockClear();
    process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    if (previousSink === undefined) delete process.env.AUTH_EMAIL_DEV_SINK_ENABLED;
    else process.env.AUTH_EMAIL_DEV_SINK_ENABLED = previousSink;
    if (previousEmailToggle === undefined) delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
    else process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  it("keeps the confirmation link when the sink accepts the send and operational email is off", async () => {
    process.env.AUTH_EMAIL_DEV_SINK_ENABLED = "true";
    const app = await getTestApp();
    const email = `sink-keep-${Date.now()}@example.com`;
    await createUnverifiedUser(email);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json().message).toBe(EMAIL_CONFIRMATION_SENT_MESSAGE);
    expect(sendMail).not.toHaveBeenCalled();

    const stored = await User.findOne({ "personalDetails.email": email })
      .select("verificationToken")
      .lean();
    expect(stored?.verificationToken).toBeTruthy();
  });

  it("clears the confirmation link and returns the server error when delivery fails", async () => {
    process.env.AUTH_EMAIL_DEV_SINK_ENABLED = "false";
    const app = await getTestApp();
    const email = `rail-fail-${Date.now()}@example.com`;
    await createUnverifiedUser(email);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json().detail).toBe(
      "Failed to send confirmation email. Please try again later.",
    );
    expect(sendMail).toHaveBeenCalledTimes(1);

    const stored = await User.findOne({ "personalDetails.email": email })
      .select("verificationToken")
      .lean();
    expect(stored?.verificationToken).toBeFalsy();
  });
});
