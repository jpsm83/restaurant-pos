/**
 * Sign-in confirmation email at the auth-route seam.
 *
 * A successful email-and-password sign-in of an existing active User sends one
 * security notice through the existing account-email rail. Rejected or
 * non-sign-in paths send nothing, and a failed send never changes the response.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
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

import { emailRailFailure, emailRailSuccess } from "../helpers/accountEmailRail.ts";
import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import { markAsDeletedById } from "../../src/models/softDelete.ts";

const testPassword = "TestPassword123!";

async function createSignInUser(options: {
  email: string;
  firstName?: string;
  username?: string;
  languagePreference?: "en" | "es";
}) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return User.create({
    ...(options.languagePreference
      ? { languagePreference: options.languagePreference }
      : {}),
    personalDetails: {
      email: options.email,
      password: hashedPassword,
      ...(options.firstName ? { firstName: options.firstName } : {}),
      ...(options.username ? { username: options.username } : {}),
    },
  });
}

function refreshCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}): { name: string; value: string } | undefined {
  return response.cookies.find((cookie) => cookie.name === "refresh_token");
}

describe("POST /api/v1/auth/login sign-in confirmation", () => {
  beforeAll(async () => {
    await resetTestApp();
  });

  afterAll(async () => {
    await resetTestApp();
  });

  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(emailRailSuccess);
  });

  it("sends one localized confirmation to the sign-in email", async () => {
    const app = await getTestApp();
    const email = "signin-confirm-en@example.com";
    await createSignInUser({ email, firstName: "Pat" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: testPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0] as {
      to?: string;
      subject?: string;
      text?: string;
      html?: string;
    };
    expect(payload.to).toBe(email);
    expect(payload.subject).toBe("New Sign-In to Your POS Account");
    expect(payload.text).toContain("Hello Pat!");
    expect(payload.text).toContain(
      "A sign-in to your POS account just happened.",
    );
    expect(payload.html).toContain("Hello Pat!");
    expect(payload.html).not.toContain("href=");
    expect(payload.text).not.toContain("http");
  });

  it("uses the saved Spanish preference", async () => {
    const app = await getTestApp();
    const email = "signin-confirm-es@example.com";
    await createSignInUser({
      email,
      firstName: "Pat",
      languagePreference: "es",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: testPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0] as {
      to?: string;
      subject?: string;
    };
    expect(payload.to).toBe(email);
    expect(payload.subject).toBe(
      "Nuevo inicio de sesión en tu cuenta de POS",
    );
  });

  it("prefers the saved username for the greeting", async () => {
    const app = await getTestApp();
    const email = "signin-confirm-username@example.com";
    await createSignInUser({
      email,
      firstName: "Pat",
      username: "patty",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: testPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0] as { text?: string };
    expect(payload.text).toContain("Hello patty!");
  });

  it("uses a neutral greeting when the account has no name", async () => {
    const app = await getTestApp();
    const email = "signin-confirm-noname@example.com";
    await createSignInUser({ email });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: testPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0] as { text?: string };
    expect(payload.text).toContain("Hello there!");
  });

  it("sends nothing for rejected credentials", async () => {
    const app = await getTestApp();
    const email = "signin-confirm-wrong@example.com";
    await createSignInUser({ email });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "wrong-password" },
    });

    expect(response.statusCode).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends nothing for a soft-deleted account", async () => {
    const app = await getTestApp();
    const email = "signin-confirm-deleted@example.com";
    const user = await createSignInUser({ email });
    await markAsDeletedById(User, user._id);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: testPassword },
    });

    expect(response.statusCode).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends nothing on token refresh or current-session reads", async () => {
    const app = await getTestApp();
    const email = "signin-confirm-refresh@example.com";
    await createSignInUser({ email });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: testPassword },
    });
    expect(login.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    sendEmailMock.mockClear();
    const cookie = refreshCookie(login);
    expect(cookie).toBeDefined();

    const refresh = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      cookies: { refresh_token: cookie?.value ?? "" },
    });
    expect(refresh.statusCode).toBe(200);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${login.json().accessToken as string}` },
    });
    expect(me.statusCode).toBe(200);

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("leaves the sign-in response and session unchanged when the send fails", async () => {
    sendEmailMock.mockResolvedValue(emailRailFailure);
    const app = await getTestApp();
    const email = "signin-confirm-fail@example.com";
    await createSignInUser({ email, firstName: "Pat" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: testPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().accessToken).toBeDefined();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${response.json().accessToken as string}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe(email);
  });
});
