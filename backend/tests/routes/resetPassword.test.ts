/**
 * POST /api/v1/auth/reset-password
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import Business from "../../src/models/business.ts";
import { CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE } from "../../src/auth/confirmEmail.ts";
import {
  RESET_PASSWORD_MISSING_NEW_PASSWORD_MESSAGE,
  RESET_PASSWORD_MISSING_TOKEN_MESSAGE,
  RESET_PASSWORD_SUCCESS_MESSAGE,
} from "../../src/auth/resetPassword.ts";
import { PASSWORD_POLICY_MESSAGE } from "../../../packages/utils/passwordPolicy.ts";

const oldPassword = "TestPassword123!";
const newPassword = "NewPassword456!";

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function futureResetExpiry(): Date {
  return new Date(Date.now() + 3_600_000);
}

async function createTestUser(email: string) {
  const hashedPassword = await bcrypt.hash(oldPassword, 10);
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
    emailVerified: true,
  });
}

async function createTestBusiness(email: string) {
  const hashedPassword = await bcrypt.hash(oldPassword, 10);
  return Business.create({
    tradeName: "Café ResetPwd",
    legalName: "Café ResetPwd Legal",
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

async function setUserResetToken(userId: unknown) {
  const raw = randomToken();
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        resetPasswordToken: raw,
        resetPasswordExpires: futureResetExpiry(),
      },
    },
  );
  return raw;
}

async function setBusinessResetToken(businessId: unknown) {
  const raw = randomToken();
  await Business.updateOne(
    { _id: businessId },
    {
      $set: {
        resetPasswordToken: raw,
        resetPasswordExpires: futureResetExpiry(),
      },
    },
  );
  return raw;
}

function refreshCookieValueFromLoginResponse(res: {
  headers: Record<string, unknown>;
}): string | undefined {
  const raw = res.headers["set-cookie"];
  const lines = Array.isArray(raw) ? raw : raw != null ? [String(raw)] : [];
  const prefix = "refresh_token=";
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      const after = line.slice(prefix.length);
      const semi = after.indexOf(";");
      return semi >= 0 ? after.slice(0, semi) : after;
    }
  }
  return undefined;
}

describe("POST /api/v1/auth/reset-password", () => {
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
      url: "/api/v1/auth/reset-password",
      payload: { token: "", newPassword: newPassword },
    });
    expect(empty.statusCode).toBe(400);
    expect(JSON.parse(empty.body).message).toBe(
      RESET_PASSWORD_MISSING_TOKEN_MESSAGE,
    );

    const missing = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { newPassword: newPassword },
    });
    expect(missing.statusCode).toBe(400);
  });

  it("returns 400 when newPassword is missing or blank", async () => {
    const app = await getTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: "some-token", newPassword: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe(
      RESET_PASSWORD_MISSING_NEW_PASSWORD_MESSAGE,
    );
  });

  it("returns 400 with policy message for weak password", async () => {
    const app = await getTestApp();
    const user = await createTestUser("weak-pw@example.com");
    const raw = await setUserResetToken(user._id);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: raw, newPassword: "short" },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toBe(PASSWORD_POLICY_MESSAGE);

    const unchanged = await User.findById(user._id)
      .select("personalDetails.password resetPasswordToken")
      .lean();
    expect(
      await bcrypt.compare(oldPassword, unchanged!.personalDetails!.password!),
    ).toBe(true);
    expect(unchanged?.resetPasswordToken).toBeTruthy();
  });

  it("resets user password and clears reset fields", async () => {
    const app = await getTestApp();
    const user = await createTestUser("reset-ok@example.com");
    const raw = await setUserResetToken(user._id);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: raw, newPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      RESET_PASSWORD_SUCCESS_MESSAGE,
    );

    const updated = await User.findById(user._id)
      .select("personalDetails.password resetPasswordToken")
      .lean();
    expect(updated?.resetPasswordToken).toBeFalsy();
    expect(
      await bcrypt.compare(newPassword, updated!.personalDetails!.password!),
    ).toBe(true);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "reset-ok@example.com", password: newPassword },
    });
    expect(login.statusCode).toBe(200);
  });

  it("rejects prior refresh JWT after successful password reset", async () => {
    const app = await getTestApp();
    const user = await createTestUser("refresh-invalidate@example.com");

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "refresh-invalidate@example.com", password: oldPassword },
    });
    expect(loginRes.statusCode).toBe(200);
    const refreshVal = refreshCookieValueFromLoginResponse({
      headers: loginRes.headers as Record<string, unknown>,
    });
    expect(refreshVal).toBeDefined();

    const refreshOk = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refresh_token=${refreshVal}` },
    });
    expect(refreshOk.statusCode).toBe(200);

    const raw = await setUserResetToken(user._id);
    const resetRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: raw, newPassword },
    });
    expect(resetRes.statusCode).toBe(200);

    const refreshAfter = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refresh_token=${refreshVal}` },
    });
    expect(refreshAfter.statusCode).toBe(401);
    expect(JSON.parse(refreshAfter.body).message).toBe(
      "Invalid or expired refresh token",
    );
  });

  it("returns 400 for wrong or expired token", async () => {
    const app = await getTestApp();
    await createTestUser("bad-token@example.com");

    const wrong = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: randomToken(), newPassword },
    });
    expect(wrong.statusCode).toBe(400);
    expect(JSON.parse(wrong.body).message).toBe(
      CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    );

    const user = await createTestUser("expired@example.com");
    const raw = randomToken();
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: raw,
          resetPasswordExpires: new Date(Date.now() - 60_000),
        },
      },
    );

    const expired = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: raw, newPassword },
    });
    expect(expired.statusCode).toBe(400);
  });

  it("rejects replay after successful reset", async () => {
    const app = await getTestApp();
    const user = await createTestUser("replay@example.com");
    const raw = await setUserResetToken(user._id);

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: raw, newPassword },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: raw, newPassword: "OtherPassword456!" },
    });
    expect(second.statusCode).toBe(400);
  });

  it("resets business password when token matches business", async () => {
    const app = await getTestApp();
    const biz = await createTestBusiness("biz-reset@example.com");
    const raw = await setBusinessResetToken(biz._id);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: raw, newPassword },
    });
    expect(response.statusCode).toBe(200);

    const updated = await Business.findById(biz._id)
      .select("password resetPasswordToken")
      .lean();
    expect(updated?.resetPasswordToken).toBeFalsy();
    expect(await bcrypt.compare(newPassword, updated!.password)).toBe(true);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "biz-reset@example.com", password: newPassword },
    });
    expect(login.statusCode).toBe(200);
  });

  it("updates business only when both accounts share the same reset token", async () => {
    const app = await getTestApp();
    const sharedRaw = randomToken();
    const expiresAt = futureResetExpiry();

    const biz = await createTestBusiness("biz-hash@example.com");
    await Business.updateOne(
      { _id: biz._id },
      {
        $set: {
          resetPasswordToken: sharedRaw,
          resetPasswordExpires: expiresAt,
        },
      },
    );

    const usr = await createTestUser("user-hash@example.com");
    await User.updateOne(
      { _id: usr._id },
      {
        $set: {
          resetPasswordToken: sharedRaw,
          resetPasswordExpires: expiresAt,
        },
      },
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: sharedRaw, newPassword },
    });
    expect(response.statusCode).toBe(200);

    const bizAfter = await Business.findById(biz._id)
      .select("password resetPasswordToken")
      .lean();
    expect(await bcrypt.compare(newPassword, bizAfter!.password)).toBe(true);
    expect(bizAfter?.resetPasswordToken).toBeFalsy();

    const usrAfter = await User.findById(usr._id)
      .select("personalDetails.password resetPasswordToken")
      .lean();
    expect(
      await bcrypt.compare(oldPassword, usrAfter!.personalDetails!.password!),
    ).toBe(true);
    expect(usrAfter?.resetPasswordToken).toBe(sharedRaw);
  });
});
