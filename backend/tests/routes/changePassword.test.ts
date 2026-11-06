/**
 * POST /api/v1/auth/change-password
 *
 * A signed-in User sets or changes their password. The current password or a
 * linked Google identity is the re-authentication proof; a successful change
 * revokes every other refresh session but keeps the presented one usable.
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

import { buildApp } from "../../src/server.ts";
import { getTestApp, generateTestToken, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import {
  GoogleCredentialError,
  type GoogleIdentity,
  type GoogleVerifier,
} from "../../src/auth/google.ts";
import { PASSWORD_POLICY_MESSAGE } from "restaurant-pos-packages/utils/passwordPolicy";

const oldPassword = "TestPassword123!";
const newPassword = "NewPassword456!";

async function createUser(
  email: string,
  overrides: Record<string, unknown> = {},
) {
  const hashedPassword = await bcrypt.hash(oldPassword, 10);
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

async function tokenFor(user: { _id: unknown; personalDetails: { email: string } }) {
  return generateTestToken({
    id: String(user._id),
    email: user.personalDetails.email,
    type: "user",
    role: "Customer",
  });
}

async function storedPassword(userId: unknown): Promise<string> {
  const stored = await User.findById(userId)
    .select("personalDetails.password")
    .lean();
  return stored?.personalDetails?.password ?? "";
}

function fieldPaths(body: string): string[] {
  const parsed = JSON.parse(body) as { errors?: Array<{ path?: string }> };
  return (parsed.errors ?? []).map((issue) => issue.path ?? "");
}

describe("POST /api/v1/auth/change-password", () => {
  beforeAll(async () => {
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

  it("changes the password for a password User and keeps the presented session", async () => {
    const app = await getTestApp();
    const user = await createUser("change-ok@example.com");
    const currentSession = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { authorization: currentSession },
      payload: {
        newPassword,
        confirmPassword: newPassword,
        currentPassword: oldPassword,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.hasPassword).toBe(true);
    expect(
      await bcrypt.compare(newPassword, await storedPassword(user._id)),
    ).toBe(true);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: currentSession },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.hasPassword).toBe(true);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "change-ok@example.com", password: newPassword },
    });
    expect(login.statusCode).toBe(200);

    const oldLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "change-ok@example.com", password: oldPassword },
    });
    expect(oldLogin.statusCode).toBe(401);
  });

  it("revokes every other refresh session and leaves the presented one usable", async () => {
    const app = await getTestApp();
    const user = await createUser("revoke-others@example.com");
    const currentSession = await tokenFor(user);
    const otherSession = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { authorization: currentSession },
      payload: {
        newPassword,
        confirmPassword: newPassword,
        currentPassword: oldPassword,
      },
    });
    expect(response.statusCode).toBe(200);

    const otherAfter = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: otherSession },
    });
    expect(otherAfter.statusCode).toBe(401);

    const currentAfter = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: currentSession },
    });
    expect(currentAfter.statusCode).toBe(200);
  });

  it("rejects a wrong current password with a currentPassword field error", async () => {
    const app = await getTestApp();
    const user = await createUser("wrong-current@example.com");
    const auth = await tokenFor(user);
    const before = await storedPassword(user._id);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { authorization: auth },
      payload: {
        newPassword,
        confirmPassword: newPassword,
        currentPassword: "WrongPassword123!",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(fieldPaths(response.body)).toContain("currentPassword");
    expect(await storedPassword(user._id)).toBe(before);
  });

  it("rejects a confirmation mismatch with a confirmPassword field error", async () => {
    const app = await getTestApp();
    const user = await createUser("mismatch@example.com");
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { authorization: auth },
      payload: {
        newPassword,
        confirmPassword: "DifferentPassword789!",
        currentPassword: oldPassword,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(fieldPaths(response.body)).toContain("confirmPassword");
  });

  it("rejects a policy-breaking password with a newPassword field error", async () => {
    const app = await getTestApp();
    const user = await createUser("weak@example.com");
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { authorization: auth },
      payload: {
        newPassword: "short",
        confirmPassword: "short",
        currentPassword: oldPassword,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as {
      errors?: Array<{ path?: string; message?: string }>;
    };
    expect(body.errors?.map((issue) => issue.path)).toContain("newPassword");
    expect(body.errors?.some((issue) => issue.message === PASSWORD_POLICY_MESSAGE)).toBe(
      true,
    );
  });

  it("requires exactly one re-authentication proof", async () => {
    const app = await getTestApp();
    const user = await createUser("two-proofs@example.com");
    const auth = await tokenFor(user);

    const neither = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { authorization: auth },
      payload: { newPassword, confirmPassword: newPassword },
    });
    expect(neither.statusCode).toBe(400);
    expect(fieldPaths(neither.body)).toContain("currentPassword");

    const both = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { authorization: auth },
      payload: {
        newPassword,
        confirmPassword: newPassword,
        currentPassword: oldPassword,
        googleCredential: "google-id-token",
      },
    });
    expect(both.statusCode).toBe(400);
    expect(fieldPaths(both.body)).toContain("currentPassword");
  });

  it("requires a live User session", async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      payload: {
        newPassword,
        confirmPassword: newPassword,
        currentPassword: oldPassword,
      },
    });
    expect(response.statusCode).toBe(401);
  });

  it("sends no password-changed email", async () => {
    const app = await getTestApp();
    const user = await createUser("no-email@example.com");
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { authorization: auth },
      payload: {
        newPassword,
        confirmPassword: newPassword,
        currentPassword: oldPassword,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  describe("Google re-authentication", () => {
    const verifyGoogle = vi.fn<GoogleVerifier>();
    const linkedIdentity: GoogleIdentity = {
      subject: "google-subject",
      email: "google-only@example.com",
    };
    let googleApp: Awaited<ReturnType<typeof buildApp>>;

    beforeAll(async () => {
      googleApp = await buildApp({
        logger: false,
        skipDb: true,
        googleVerifier: (credential) => verifyGoogle(credential),
      });
    });

    afterAll(async () => {
      await googleApp.close();
    });

    beforeEach(() => {
      verifyGoogle.mockReset();
      verifyGoogle.mockResolvedValue(linkedIdentity);
    });

    it("lets a Google-only User set a password", async () => {
      const user = await User.create({
        googleId: linkedIdentity.subject,
        personalDetails: {
          email: "google-only@example.com",
          emailVerified: true,
          username: "google-only",
        },
      });
      const auth = await tokenFor(user);

      const response = await googleApp.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: { authorization: auth },
        payload: {
          newPassword,
          confirmPassword: newPassword,
          googleCredential: "google-id-token",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(verifyGoogle).toHaveBeenCalledWith("google-id-token");
      expect(response.json().user.hasPassword).toBe(true);
      expect(
        await bcrypt.compare(newPassword, await storedPassword(user._id)),
      ).toBe(true);
    });

    it("lets a mixed account use either its password or linked Google identity", async () => {
      const user = await createUser("mixed@example.com", {
        googleId: linkedIdentity.subject,
      });
      const auth = await tokenFor(user);

      const withPassword = await googleApp.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: { authorization: auth },
        payload: {
          newPassword,
          confirmPassword: newPassword,
          currentPassword: oldPassword,
        },
      });
      expect(withPassword.statusCode).toBe(200);

      const withGoogle = await googleApp.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: { authorization: auth },
        payload: {
          newPassword: "AnotherPassword789!",
          confirmPassword: "AnotherPassword789!",
          googleCredential: "google-id-token",
        },
      });
      expect(withGoogle.statusCode).toBe(200);
      expect(
        await bcrypt.compare(
          "AnotherPassword789!",
          await storedPassword(user._id),
        ),
      ).toBe(true);
    });

    it("refuses a password proof for a Google-only User", async () => {
      const user = await User.create({
        googleId: linkedIdentity.subject,
        personalDetails: {
          email: "google-only-password-proof@example.com",
          emailVerified: true,
        },
      });
      const auth = await tokenFor(user);

      const response = await googleApp.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: { authorization: auth },
        payload: {
          newPassword,
          confirmPassword: newPassword,
          currentPassword: oldPassword,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(fieldPaths(response.body)).toContain("currentPassword");
      expect(await storedPassword(user._id)).toBe("");
    });

    it("rejects a Google credential for a different identity with a googleCredential field error", async () => {
      const user = await createUser("google-mismatch@example.com", {
        googleId: "linked-subject",
      });
      const auth = await tokenFor(user);
      verifyGoogle.mockResolvedValue({
        ...linkedIdentity,
        subject: "different-subject",
      });

      const response = await googleApp.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: { authorization: auth },
        payload: {
          newPassword,
          confirmPassword: newPassword,
          googleCredential: "google-id-token",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(fieldPaths(response.body)).toContain("googleCredential");
      expect(
        await bcrypt.compare(oldPassword, await storedPassword(user._id)),
      ).toBe(true);
    });

    it("rejects a Google credential when the account has no linked identity", async () => {
      const user = await createUser("password-only@example.com");
      const auth = await tokenFor(user);

      const response = await googleApp.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: { authorization: auth },
        payload: {
          newPassword,
          confirmPassword: newPassword,
          googleCredential: "google-id-token",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(fieldPaths(response.body)).toContain("googleCredential");
      expect(verifyGoogle).not.toHaveBeenCalled();
    });

    it("rejects a failed Google credential with a googleCredential field error", async () => {
      const user = await createUser("bad-google@example.com", {
        googleId: linkedIdentity.subject,
      });
      const auth = await tokenFor(user);
      verifyGoogle.mockRejectedValue(new GoogleCredentialError());

      const response = await googleApp.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: { authorization: auth },
        payload: {
          newPassword,
          confirmPassword: newPassword,
          googleCredential: "invalid-token",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(fieldPaths(response.body)).toContain("googleCredential");
    });
  });
});
