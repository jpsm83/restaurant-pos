/**
 * POST /api/v1/auth/confirm-email
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import Business from "../../src/models/business.ts";
import {
  CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
  CONFIRM_EMAIL_MISSING_TOKEN_MESSAGE,
  CONFIRM_EMAIL_SUCCESS_MESSAGE,
} from "../../src/auth/confirmEmail.ts";

const testPassword = "TestPassword123!";

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function createTestUser(email: string) {
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
    emailVerified: false,
  });
}

async function createTestBusiness(email: string) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return Business.create({
    tradeName: "Café Confirm",
    legalName: "Café Confirm Legal",
    email,
    password: hashedPassword,
    taxNumber: `TAX-${email.replace(/[@.]/g, "-")}`,
    phoneNumber: "1234567890",
    currencyTrade: "USD",
    emailVerified: false,
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

describe("POST /api/v1/auth/confirm-email", () => {
  beforeAll(async () => {
    await resetTestApp();
  });

  afterAll(async () => {
    await resetTestApp();
  });

  it("returns 400 when token is missing or blank", async () => {
    const app = await getTestApp();

    const empty = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: "" },
    });
    expect(empty.statusCode).toBe(400);
    expect(JSON.parse(empty.body).message).toBe(
      CONFIRM_EMAIL_MISSING_TOKEN_MESSAGE,
    );

    const missing = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: {},
    });
    expect(missing.statusCode).toBe(400);
  });

  it("verifies user email and clears verificationToken", async () => {
    const app = await getTestApp();
    const user = await createTestUser("confirm-user@example.com");
    const raw = randomToken();
    await User.updateOne({ _id: user._id }, { $set: { verificationToken: raw } });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: raw },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe(CONFIRM_EMAIL_SUCCESS_MESSAGE);

    const updated = await User.findById(user._id)
      .select("emailVerified personalDetails.emailVerified verificationToken")
      .lean();
    expect(updated?.emailVerified).toBe(true);
    expect(updated?.personalDetails?.emailVerified).toBe(true);
    expect(updated?.verificationToken).toBeFalsy();
  });

  it("accepts uppercase hex token matching stored verificationToken", async () => {
    const app = await getTestApp();
    const biz = await createTestBusiness("confirm-biz-upper@example.com");
    const raw = randomToken();
    await Business.updateOne({ _id: biz._id }, { $set: { verificationToken: raw } });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: raw.toUpperCase() },
    });

    expect(response.statusCode).toBe(200);
    const updated = await Business.findById(biz._id)
      .select("emailVerified verificationToken")
      .lean();
    expect(updated?.emailVerified).toBe(true);
    expect(updated?.verificationToken).toBeFalsy();
  });

  it("returns 400 for wrong token", async () => {
    const app = await getTestApp();
    await createTestUser("wrong@example.com");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: randomToken() },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe(
      CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    );
  });

  it("returns 400 on second use (replay)", async () => {
    const app = await getTestApp();
    const user = await createTestUser("replay@example.com");
    const raw = randomToken();
    await User.updateOne({ _id: user._id }, { $set: { verificationToken: raw } });

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: raw },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: raw },
    });
    expect(second.statusCode).toBe(400);
    expect(JSON.parse(second.body).message).toBe(
      CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    );
  });

  it("updates business when token matches business row", async () => {
    const app = await getTestApp();
    const biz = await createTestBusiness("confirm-biz@example.com");
    const raw = randomToken();
    await Business.updateOne({ _id: biz._id }, { $set: { verificationToken: raw } });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: raw },
    });

    expect(response.statusCode).toBe(200);

    const updated = await Business.findById(biz._id)
      .select("emailVerified verificationToken")
      .lean();
    expect(updated?.emailVerified).toBe(true);
    expect(updated?.verificationToken).toBeFalsy();
  });

  it("does not consume user token when business has the same token (business wins)", async () => {
    const app = await getTestApp();
    const sharedRaw = randomToken();

    const biz = await createTestBusiness("biz-wins@example.com");
    await Business.updateOne(
      { _id: biz._id },
      { $set: { verificationToken: sharedRaw } },
    );

    const usr = await createTestUser("user-same-token@example.com");
    await User.updateOne(
      { _id: usr._id },
      { $set: { verificationToken: sharedRaw } },
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: sharedRaw },
    });
    expect(response.statusCode).toBe(200);

    const bizAfter = await Business.findById(biz._id)
      .select("emailVerified verificationToken")
      .lean();
    expect(bizAfter?.emailVerified).toBe(true);
    expect(bizAfter?.verificationToken).toBeFalsy();

    const usrAfter = await User.findById(usr._id)
      .select("emailVerified verificationToken")
      .lean();
    expect(usrAfter?.emailVerified).toBe(false);
    expect(usrAfter?.verificationToken).toBe(sharedRaw);
  });
});
