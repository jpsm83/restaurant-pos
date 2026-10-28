/**
 * POST /api/v1/auth/confirm-email
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
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
    expect(empty.headers["content-type"]).toContain("application/problem+json");
    const emptyBody = JSON.parse(empty.body);
    expect(emptyBody.errors[0].path).toBe("token");
    expect(emptyBody.errors[0].message).toBe(
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
      .select("personalDetails.emailVerified verificationToken")
      .lean();
    expect(updated?.personalDetails?.emailVerified).toBe(true);
    expect(updated?.verificationToken).toBeFalsy();
  });

  it("accepts uppercase hex token matching stored verificationToken", async () => {
    const app = await getTestApp();
    const user = await createTestUser("confirm-upper@example.com");
    const raw = randomToken();
    await User.updateOne({ _id: user._id }, { $set: { verificationToken: raw } });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: raw.toUpperCase() },
    });

    expect(response.statusCode).toBe(200);
    const updated = await User.findById(user._id)
      .select("personalDetails.emailVerified verificationToken")
      .lean();
    expect(updated?.personalDetails?.emailVerified).toBe(true);
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
    expect(JSON.parse(response.body).detail).toBe(
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
    expect(JSON.parse(second.body).detail).toBe(
      CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    );
  });

  it("reactivates a soft-deleted user when consuming a valid token", async () => {
    const app = await getTestApp();
    const user = await createTestUser("reactivate-confirm@example.com");
    const raw = randomToken();

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          verificationToken: raw,
          deleted: true,
          deletedAt: new Date(),
        },
      },
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: raw },
    });

    expect(response.statusCode).toBe(200);

    const updated = await User.findById(user._id)
      .select("deleted deletedAt personalDetails.emailVerified verificationToken")
      .lean();
    expect(updated?.deleted).toBe(false);
    expect(updated?.deletedAt).toBeFalsy();
    expect(updated?.personalDetails?.emailVerified).toBe(true);
    expect(updated?.verificationToken).toBeFalsy();
  });
});
