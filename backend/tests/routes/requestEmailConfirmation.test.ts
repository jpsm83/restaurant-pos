/**
 * POST /api/v1/auth/request-email-confirmation
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
import { VERIFICATION_TOKEN_TTL_MS } from "../../src/auth/authEmailTokenFlow.ts";
import {
  CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
  CONFIRM_EMAIL_SUCCESS_MESSAGE,
} from "../../src/auth/confirmEmail.ts";

const testPassword = "TestPassword123!";

async function createTestUser(
  email: string,
  overrides?: { emailVerified?: boolean; languagePreference?: "en" | "es" },
) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return User.create({
    ...(overrides?.languagePreference
      ? { languagePreference: overrides.languagePreference }
      : {}),
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
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(emailRailSuccess);
  });

  it("returns 400 for invalid email", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
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
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns the generic message when email is already verified (no send)", async () => {
    const app = await getTestApp();
    await createTestUser("verified@example.com", { emailVerified: true });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "verified@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("issues one verification token with a 24-hour expiry and sends email for an unverified user", async () => {
    const app = await getTestApp();
    await createTestUser("pending@example.com", { emailVerified: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "pending@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
    );

    const updated = await User.findOne({
      "personalDetails.email": "pending@example.com",
    })
      .select("verificationToken verificationTokenExpires")
      .lean();
    expect(updated?.verificationToken).toBeTruthy();
    const ttl = updated!.verificationTokenExpires!.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(VERIFICATION_TOKEN_TTL_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(VERIFICATION_TOKEN_TTL_MS);
    expectOneAccountSend(sendEmailMock, {
      to: "pending@example.com",
      subject: "Confirm Your Email - POS",
      link: `/confirm-email?token=${updated?.verificationToken}`,
    });
  });

  it("sends the verification email in the User's stored Spanish preference", async () => {
    const app = await getTestApp();
    await createTestUser("spanish-pending@example.com", {
      emailVerified: false,
      languagePreference: "es",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "spanish-pending@example.com" },
    });

    expect(response.statusCode).toBe(200);
    const updated = await User.findOne({
      "personalDetails.email": "spanish-pending@example.com",
    })
      .select("verificationToken")
      .lean();
    expectOneAccountSend(sendEmailMock, {
      to: "spanish-pending@example.com",
      subject: "Confirma tu correo electrónico - POS",
      link: `/confirm-email?token=${updated?.verificationToken}`,
    });
  });

  it("is a 200 no-op inside the one-minute cooldown and changes nothing", async () => {
    const app = await getTestApp();
    await createTestUser("cooldown@example.com", { emailVerified: false });

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "cooldown@example.com" },
    });
    expect(first.statusCode).toBe(200);
    const firstStored = await User.findOne({
      "personalDetails.email": "cooldown@example.com",
    })
      .select("verificationToken")
      .lean();

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "cooldown@example.com" },
    });
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).message).toBe(
      GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const liveLink = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: firstStored!.verificationToken },
    });
    expect(liveLink.statusCode).toBe(200);
    expect(liveLink.json().message).toBe(CONFIRM_EMAIL_SUCCESS_MESSAGE);
  });

  it("supersedes the previous link after the cooldown so only the newest works", async () => {
    const app = await getTestApp();
    await createTestUser("supersede@example.com", { emailVerified: false });

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "supersede@example.com" },
    });
    expect(first.statusCode).toBe(200);
    const firstStored = await User.findOne({
      "personalDetails.email": "supersede@example.com",
    })
      .select("verificationToken")
      .lean();
    const firstToken = firstStored!.verificationToken!;

    await User.updateOne(
      { "personalDetails.email": "supersede@example.com" },
      { $set: { verificationRequestedAt: new Date(Date.now() - 2 * 60_000) } },
    );

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "supersede@example.com" },
    });
    expect(second.statusCode).toBe(200);
    const secondStored = await User.findOne({
      "personalDetails.email": "supersede@example.com",
    })
      .select("verificationToken")
      .lean();
    const secondToken = secondStored!.verificationToken!;

    expect(secondToken).not.toBe(firstToken);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);

    const oldLink = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: firstToken },
    });
    expect(oldLink.statusCode).toBe(400);
    expect(oldLink.json().detail).toBe(CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE);

    const newLink = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: secondToken },
    });
    expect(newLink.statusCode).toBe(200);
    expect(newLink.json().message).toBe(CONFIRM_EMAIL_SUCCESS_MESSAGE);
  });

  it("clears token and returns 500 when send fails", async () => {
    const app = await getTestApp();
    await createTestUser("failsend@example.com", { emailVerified: false });
    sendEmailMock.mockResolvedValue(emailRailFailure);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "failsend@example.com" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json().detail).toBe(
      "Failed to send confirmation email. Please try again later.",
    );
    const updated = await User.findOne({
      "personalDetails.email": "failsend@example.com",
    })
      .select(
        "verificationToken verificationTokenExpires verificationRequestedAt",
      )
      .lean();
    expect(updated?.verificationToken).toBeFalsy();
    expect(updated?.verificationTokenExpires).toBeFalsy();
    expect(updated?.verificationRequestedAt).toBeFalsy();
  });

});
