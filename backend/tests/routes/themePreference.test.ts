/**
 * Per-user theme preference across the profile and auth session HTTP seams.
 *
 * The profile update/read is self-only; auth sessions carry the stored
 * preference so the client can apply it after sign-in.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
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

import { buildApp } from "../../src/server.ts";
import { getTestApp, generateTestToken } from "../setup.ts";
import User from "../../src/models/user.ts";
import type { GoogleVerifier } from "../../src/auth/google.ts";
import { multipart } from "../helpers/multipart.ts";

const password = "TestPassword123!";
const googleIdentity = {
  subject: "theme-google-subject",
  email: "theme-google@test.com",
  firstName: "Theme",
  lastName: "User",
};

const verifyGoogle = vi.fn<GoogleVerifier>();

let googleApp: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  if (!process.env.APP_BASE_URL?.trim()) {
    process.env.APP_BASE_URL = "http://127.0.0.1:3000";
  }
  verifyGoogle.mockResolvedValue(googleIdentity);
  googleApp = await buildApp({
    logger: false,
    skipDb: true,
    googleVerifier: (credential) => verifyGoogle(credential),
  });
});

afterAll(async () => {
  await googleApp.close();
});

async function tokenFor(user: {
  _id: unknown;
  personalDetails: { email: string };
}): Promise<string> {
  return generateTestToken({
    id: String(user._id),
    email: user.personalDetails.email,
    type: "user",
    role: "Customer",
  });
}

describe("theme preference through the profile API", () => {
  it("persists the theme on update and returns it on read", async () => {
    const app = await getTestApp();
    const user = await User.create({
      personalDetails: {
        email: "theme-profile@test.com",
        password: "hashedpassword",
      },
    });
    const auth = await tokenFor(user);

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${user._id}`,
      payload: multipart({ themePreference: "dark" }),
      headers: {
        "content-type": "multipart/form-data",
        authorization: auth,
      },
    });

    expect(updated.statusCode, updated.body).toBe(200);
    expect(updated.json().user.themePreference).toBe("dark");

    const stored = await User.findById(user._id).lean();
    expect(stored?.themePreference).toBe("dark");

    const read = await app.inject({
      method: "GET",
      url: `/api/v1/users/${user._id}`,
      headers: { authorization: auth },
    });
    expect(read.statusCode, read.body).toBe(200);
    expect(read.json().themePreference).toBe("dark");
  });

  it("rejects an unknown appearance", async () => {
    const app = await getTestApp();
    const user = await User.create({
      personalDetails: {
        email: "theme-invalid@test.com",
        password: "hashedpassword",
      },
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${user._id}`,
      payload: multipart({ themePreference: "sepia" }),
      headers: {
        "content-type": "multipart/form-data",
        authorization: await tokenFor(user),
      },
    });

    expect(response.statusCode, response.body).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    const stored = await User.findById(user._id).lean();
    expect(stored?.themePreference).toBeUndefined();
  });

  it("clears the stored theme when the field is blank", async () => {
    const app = await getTestApp();
    const user = await User.create({
      themePreference: "light",
      personalDetails: {
        email: "theme-clear@test.com",
        password: "hashedpassword",
      },
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${user._id}`,
      payload: multipart({ themePreference: "" }),
      headers: {
        "content-type": "multipart/form-data",
        authorization: await tokenFor(user),
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().user.themePreference).toBeUndefined();
    const stored = await User.findById(user._id).lean();
    expect(stored?.themePreference).toBeUndefined();
  });
});

describe("theme preference in auth sessions", () => {
  it("carries the stored theme through login, refresh, and the current-user read", async () => {
    const app = await getTestApp();
    const email = "theme-login@test.com";
    await User.create({
      themePreference: "dark",
      personalDetails: {
        email,
        password: await bcrypt.hash(password, 10),
      },
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password },
    });
    expect(login.statusCode, login.body).toBe(200);
    expect(login.json().user.themePreference).toBe("dark");

    const refreshCookie = login.cookies.find(
      (cookie) => cookie.name === "refresh_token",
    )!.value;
    const refreshed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refresh_token=${refreshCookie}` },
    });
    expect(refreshed.statusCode, refreshed.body).toBe(200);
    expect(refreshed.json().user.themePreference).toBe("dark");

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${login.json().accessToken as string}` },
    });
    expect(me.statusCode, me.body).toBe(200);
    expect(me.json().user.themePreference).toBe("dark");
  });

  it("carries the stored theme through Google sign-in", async () => {
    const existing = await User.create({
      googleId: googleIdentity.subject,
      themePreference: "system",
      personalDetails: {
        email: googleIdentity.email,
        emailVerified: true,
      },
    });

    const response = await googleApp.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: { credential: "google-id-token", intent: "signin" },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().user.id).toBe(String(existing._id));
    expect(response.json().user.themePreference).toBe("system");
  });
});
