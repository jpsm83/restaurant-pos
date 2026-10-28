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
import Business from "../../src/models/business.ts";
import {
  EMAIL_CONFIRMATION_SENT_MESSAGE,
  GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
} from "../../src/auth/requestEmailConfirmation.ts";

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

  it("returns 400 when email is already verified (no send)", async () => {
    const app = await getTestApp();
    await createTestUser("verified@example.com", { emailVerified: true });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "verified@example.com" },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).detail).toBe("Email is already verified.");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("issues verificationToken and sends email for unverified user", async () => {
    const app = await getTestApp();
    await createTestUser("pending@example.com", { emailVerified: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email: "pending@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(EMAIL_CONFIRMATION_SENT_MESSAGE);

    const updated = await User.findOne({
      "personalDetails.email": "pending@example.com",
    })
      .select("verificationToken")
      .lean();
    expect(updated?.verificationToken).toBeTruthy();
    expectOneAccountSend(sendEmailMock, {
      to: "pending@example.com",
      subject: "Confirm Your Email - POS",
      link: `/confirm-email?token=${updated?.verificationToken}`,
    });
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
      .select("verificationToken")
      .lean();
    expect(updated?.verificationToken).toBeFalsy();
  });

  it("does not store a confirmation token for a closed business", async () => {
    const app = await getTestApp();
    const email = "closed-confirm@example.com";
    const business = await createTestBusiness(email, { emailVerified: false });
    await Business.updateOne(
      { _id: business._id },
      { $set: { deleted: true, deletedAt: new Date() } },
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-confirmation",
      payload: { email },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe(GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE);
    expect(sendEmailMock).not.toHaveBeenCalled();

    const stored = await Business.findById(business._id)
      .setOptions({ includeDeleted: true })
      .select("verificationToken")
      .lean();
    expect(stored?.verificationToken).toBeFalsy();
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

    const biz = await Business.findOne({ email }).select("verificationToken").lean();
    const usr = await User.findOne({ "personalDetails.email": email })
      .select("verificationToken")
      .lean();
    expect(biz?.verificationToken).toBeTruthy();
    expect(usr?.verificationToken).toBeFalsy();
    expectOneAccountSend(sendEmailMock, {
      to: email,
      subject: "Confirm Your Email - POS",
      link: `/confirm-email?token=${biz?.verificationToken}`,
    });
  });
});
