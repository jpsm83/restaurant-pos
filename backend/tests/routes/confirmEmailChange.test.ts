/**
 * POST /api/v1/auth/confirm-email-change
 *
 * Public: consume a pending sign-in email change token. On success the pending
 * address becomes the sign-in email (verified), the pending fields are cleared,
 * every refresh session is revoked, and a no-link notice goes to the old
 * address.
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
import crypto from "crypto";
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

import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import { CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE } from "../../src/auth/confirmEmail.ts";
import { CONFIRM_EMAIL_CHANGE_SUCCESS_MESSAGE } from "../../src/auth/confirmEmailChange.ts";

const testPassword = "TestPassword123!";
const oldEmail = "change-old@example.com";
const newEmail = "change-new@example.com";
const token = "c".repeat(64);

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function futureExpiry(): Date {
  return new Date(Date.now() + 3_600_000);
}

async function createUser(
  email: string,
  overrides: Record<string, unknown> = {},
) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return User.create({
    personalDetails: {
      email,
      password: hashedPassword,
      username: `user-${email.replace(/[@.]/g, "-")}`,
      emailVerified: true,
    },
    ...overrides,
  });
}

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
    sendEmailMock.mockResolvedValue({
      channel: "email",
      success: true,
      sentCount: 1,
    });
  });

  it("promotes the pending address, verifies it, clears the pending fields, and notifies the old address", async () => {
    const app = await getTestApp();
    const user = await createUser(oldEmail, {
      personalDetails: {
        email: oldEmail,
        username: "change-user",
        emailVerified: false,
      },
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

    const stored = await User.findById(user._id).lean();
    expect(stored?.personalDetails.email).toBe(newEmail);
    expect(stored?.personalDetails.emailVerified).toBe(true);
    expect(stored?.pendingEmail).toBeUndefined();
    expect(stored?.pendingEmailToken).toBeUndefined();
    expect(stored?.pendingEmailExpires).toBeUndefined();
    expect(stored?.pendingEmailRequestedAt).toBeUndefined();
    expect(stored?.refreshSessionVersion).toBe(1);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const notice = sendEmailMock.mock.calls[0][0] as {
      to: string;
      subject: string;
      html: string;
      text: string;
    };
    expect(notice.to).toBe(oldEmail);
    expect(notice.subject).toContain("Sign-In Email Was Changed");
    expect(notice.html).toContain(newEmail);
    expect(notice.html).not.toContain("href=");
    expect(notice.text).not.toContain("http");
  });

  it("accepts an uppercase token", async () => {
    const app = await getTestApp();
    const user = await createUser(oldEmail, {
      pendingEmail: newEmail,
      pendingEmailToken: token,
      pendingEmailExpires: futureExpiry(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token: token.toUpperCase() },
    });

    expect(response.statusCode).toBe(200);
    const stored = await User.findById(user._id).lean();
    expect(stored?.personalDetails.email).toBe(newEmail);
  });

  it("returns the single non-revealing outcome for an unknown token", async () => {
    const app = await getTestApp();
    const user = await createUser(oldEmail, {
      pendingEmail: newEmail,
      pendingEmailToken: token,
      pendingEmailExpires: futureExpiry(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token: randomToken() },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).detail).toBe(
      CONFIRM_EMAIL_CONSUMPTION_ERROR_MESSAGE,
    );
    expect(sendEmailMock).not.toHaveBeenCalled();

    const stored = await User.findById(user._id).lean();
    expect(stored?.personalDetails.email).toBe(oldEmail);
    expect(stored?.pendingEmailToken).toBe(token);
  });

  it("returns the same outcome for an expired token and leaves the account unchanged", async () => {
    const app = await getTestApp();
    const user = await createUser(oldEmail, {
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
    expect(sendEmailMock).not.toHaveBeenCalled();

    const stored = await User.findById(user._id).lean();
    expect(stored?.personalDetails.email).toBe(oldEmail);
    expect(stored?.pendingEmail).toBe(newEmail);
    expect(stored?.pendingEmailToken).toBe(token);
  });

  it("returns the same outcome when the same link is used twice", async () => {
    const app = await getTestApp();
    const user = await createUser(oldEmail, {
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

    const stored = await User.findById(user._id).lean();
    expect(stored?.personalDetails.email).toBe(newEmail);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("returns a validation error when the token is missing or blank", async () => {
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

    const blank = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token: "   " },
    });
    expect(blank.statusCode).toBe(400);
  });

  it("revokes sessions from before the change and accepts a new sign-in with the new address", async () => {
    const app = await getTestApp();
    const user = await createUser(oldEmail);

    const loginOld = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: oldEmail, password: testPassword },
    });
    expect(loginOld.statusCode).toBe(200);
    const oldRefresh = refreshCookieFrom(
      loginOld.headers as Record<string, unknown>,
    );

    const refreshBefore = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refresh_token=${oldRefresh}` },
    });
    expect(refreshBefore.statusCode).toBe(200);

    await User.updateOne(
      { _id: user._id },
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
      headers: { cookie: `refresh_token=${oldRefresh}` },
    });
    expect(refreshAfter.statusCode).toBe(401);

    const loginNew = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: newEmail, password: testPassword },
    });
    expect(loginNew.statusCode).toBe(200);
    const newRefresh = refreshCookieFrom(
      loginNew.headers as Record<string, unknown>,
    );

    const refreshNew = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refresh_token=${newRefresh}` },
    });
    expect(refreshNew.statusCode).toBe(200);
  });

  it("keeps the change when the notice cannot be sent", async () => {
    const app = await getTestApp();
    sendEmailMock.mockRejectedValue(new Error("SMTP unavailable"));
    const user = await createUser(oldEmail, {
      pendingEmail: newEmail,
      pendingEmailToken: token,
      pendingEmailExpires: futureExpiry(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email-change",
      payload: { token },
    });

    expect(response.statusCode).toBe(200);
    const stored = await User.findById(user._id).lean();
    expect(stored?.personalDetails.email).toBe(newEmail);
    expect(stored?.personalDetails.emailVerified).toBe(true);
  });
});
