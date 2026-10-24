/**
 * POST /api/v1/auth/confirm-email-change
 *
 * Unauthenticated: consume a pending sign-in email change token. On success the
 * pending address becomes the sign-in email (verified), the pending fields are
 * cleared, refresh sessions are revoked, and a notice goes to the old address.
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

import { getTestApp, resetTestApp } from "../setup.ts";
import Business from "../../src/models/business.ts";
import { CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE } from "../../src/auth/confirmEmail.ts";
import {
  CONFIRM_EMAIL_CHANGE_SUCCESS_MESSAGE,
} from "../../src/auth/confirmEmailChange.ts";

const testPassword = "TestPassword123!";
const oldEmail = "owner-old@example.com";
const newEmail = "owner-new@example.com";
const token = "c".repeat(64);

async function createBusiness(
  email: string,
  overrides: Record<string, unknown> = {},
) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return Business.create({
    tradeName: "Confirm Change Bistro",
    legalName: "Confirm Change Bistro LLC",
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
    ...overrides,
  });
}

function futureExpiry(): Date {
  return new Date(Date.now() + 3_600_000);
}

describe("POST /api/v1/auth/confirm-email-change", () => {
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

  it("swaps the sign-in email, marks it verified, clears pending fields, bumps the session version, and notifies the old address", async () => {
    const app = await getTestApp();
    const business = await createBusiness(oldEmail, {
      pendingEmail: newEmail,
      pendingEmailToken: token,
      pendingEmailExpires: futureExpiry(),
      pendingEmailRequestedAt: new Date(),
      refreshSessionVersion: 0,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      CONFIRM_EMAIL_CHANGE_SUCCESS_MESSAGE,
    );

    const stored = await Business.findById(business._id).lean();
    expect(stored?.email).toBe(newEmail);
    expect(stored?.emailVerified).toBe(true);
    expect(stored?.pendingEmail).toBeUndefined();
    expect(stored?.pendingEmailToken).toBeUndefined();
    expect(stored?.pendingEmailExpires).toBeUndefined();
    expect(stored?.pendingEmailRequestedAt).toBeUndefined();
    expect(stored?.refreshSessionVersion).toBe(1);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: oldEmail }),
    );
  });

  it("returns 400 with the single non-revealing message for an unknown token", async () => {
    const app = await getTestApp();
    await createBusiness(oldEmail, {
      pendingEmail: newEmail,
      pendingEmailToken: token,
      pendingEmailExpires: futureExpiry(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token: "d".repeat(64) },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).detail).toBe(
      CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an expired token and leaves the email unchanged", async () => {
    const app = await getTestApp();
    const business = await createBusiness(oldEmail, {
      pendingEmail: newEmail,
      pendingEmailToken: token,
      pendingEmailExpires: new Date(Date.now() - 60_000),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).detail).toBe(
      CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    );

    const stored = await Business.findById(business._id).lean();
    expect(stored?.email).toBe(oldEmail);
    expect(stored?.pendingEmail).toBe(newEmail);
  });

  it("returns 400 on replay after a successful change", async () => {
    const app = await getTestApp();
    await createBusiness(oldEmail, {
      pendingEmail: newEmail,
      pendingEmailToken: token,
      pendingEmailExpires: futureExpiry(),
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token },
    });
    expect(second.statusCode).toBe(400);
    expect(JSON.parse(second.body).detail).toBe(
      CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    );
  });

  it("returns 400 when the token is missing or blank", async () => {
    const app = await getTestApp();

    const missing = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: {},
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(JSON.parse(missing.body).errors[0].path).toBe("token");

    const blank = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token: "   " },
    });
    expect(blank.statusCode).toBe(400);
  });

  it("rejects a prior refresh JWT after a confirmed email change", async () => {
    const app = await getTestApp();
    const business = await createBusiness(oldEmail, {
      refreshSessionVersion: 0,
    });

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: oldEmail, password: testPassword },
    });
    expect(loginRes.statusCode).toBe(200);
    const accessToken = loginRes.json().accessToken as string;
    const refreshValue = refreshCookieFrom(loginRes.headers);

    const refreshOk = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refresh_token=${refreshValue}` },
    });
    expect(refreshOk.statusCode).toBe(200);

    await Business.updateOne(
      { _id: business._id },
      {
        $set: {
          pendingEmail: newEmail,
          pendingEmailToken: token,
          pendingEmailExpires: futureExpiry(),
        },
      },
    );

    const confirm = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token },
    });
    expect(confirm.statusCode).toBe(200);

    const refreshAfter = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refresh_token=${refreshValue}` },
    });
    expect(refreshAfter.statusCode).toBe(401);
    const meAfter = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(meAfter.statusCode).toBe(401);
    expect(meAfter.headers["content-type"]).toContain("application/problem+json");
    expect(meAfter.json().detail).toBe("Invalid or expired access token");

    const loginAfter = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: newEmail, password: testPassword },
    });
    expect(loginAfter.statusCode).toBe(200);
    const nextCookie = loginAfter.cookies.find(
      (cookie) => cookie.name === "refresh_token",
    );
    const refreshNext = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refresh_token=${nextCookie!.value}` },
    });
    expect(refreshNext.statusCode).toBe(200);
    expect(refreshNext.json().user.sessionId).toBeUndefined();
    const meNext = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${loginAfter.json().accessToken}` },
    });
    expect(meNext.statusCode).toBe(200);
    expect(meNext.json().user.type).toBe("business");
    expect(meNext.json().user.sessionId).toBeUndefined();
  });

  it("does not send a notice when the token is invalid", async () => {
    const app = await getTestApp();
    await createBusiness(oldEmail);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token: new Types.ObjectId().toString() },
    });
    expect(response.statusCode).toBe(400);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

function refreshCookieFrom(headers: Record<string, unknown>): string {
  const raw = headers["set-cookie"];
  const lines = Array.isArray(raw) ? raw : raw != null ? [String(raw)] : [];
  const prefix = "refresh_token=";
  for (const line of lines) {
    if (line.startsWith(prefix)) {
      const after = line.slice(prefix.length);
      const semi = after.indexOf(";");
      return semi >= 0 ? after.slice(0, semi) : after;
    }
  }
  throw new Error("refresh cookie not set");
}
