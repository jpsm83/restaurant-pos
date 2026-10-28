/**
 * POST /api/v1/auth/google — one verified Google entry path.
 *
 * The verifier is a deterministic fake; no test calls Google.
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
import User from "../../src/models/user.ts";
import {
  GoogleCredentialError,
  type GoogleIdentity,
  type GoogleVerifier,
} from "../../src/auth/google.ts";
import { REACTIVATION_REQUIRED_MESSAGE } from "../../src/auth/requestEmailConfirmation.ts";

const password = "TestPassword123!";

const defaultIdentity: GoogleIdentity = {
  subject: "google-subject",
  email: "google-user@test.com",
  firstName: "Google",
  lastName: "User",
};

const verifyGoogle = vi.fn<GoogleVerifier>();

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  if (!process.env.APP_BASE_URL?.trim()) {
    process.env.APP_BASE_URL = "http://127.0.0.1:3000";
  }
  app = await buildApp({
    logger: false,
    skipDb: true,
    googleVerifier: (credential) => verifyGoogle(credential),
  });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  verifyGoogle.mockReset();
  verifyGoogle.mockResolvedValue(defaultIdentity);
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue({
    channel: "email",
    success: true,
    sentCount: 1,
  });
});

async function postGoogle(
  target: Awaited<ReturnType<typeof buildApp>>,
  payload: Record<string, unknown> = { credential: "google-id-token" },
) {
  return target.inject({
    method: "POST",
    url: "/api/v1/auth/google",
    payload,
  });
}

function resetTokenFromLastEmail(): string {
  const payload = sendEmailMock.mock.calls.at(-1)?.[0] as {
    text?: string;
  };
  const link = String(payload?.text ?? "")
    .match(/https?:\/\/\S+/g)
    ?.find((candidate) => candidate.includes("/reset-password"));
  if (!link) throw new Error("reset email did not carry a reset link");
  const token = new URL(link).searchParams.get("token");
  if (!token) throw new Error("reset link did not carry a token");
  return token;
}

describe("POST /api/v1/auth/google", () => {
  it("creates a verified Google User with no password, names, and language", async () => {
    const response = await postGoogle(app, {
      credential: "google-id-token",
      languagePreference: "es",
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["content-type"]).toContain("application/json");
    const body = response.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user).toMatchObject({
      email: defaultIdentity.email,
      type: "user",
      emailVerified: true,
      languagePreference: "es",
      mode: "customer",
      role: "Customer",
    });
    expect(body.refreshToken).toBeUndefined();
    expect(
      response.cookies.find((cookie) => cookie.name === "refresh_token")?.value,
    ).toBeTruthy();
    expect(verifyGoogle).toHaveBeenCalledWith("google-id-token");

    const stored = await User.findOne({
      "personalDetails.email": defaultIdentity.email,
    }).lean();
    expect(stored?.googleId).toBe(defaultIdentity.subject);
    expect(stored?.personalDetails?.firstName).toBe("Google");
    expect(stored?.personalDetails?.lastName).toBe("User");
    expect(stored?.personalDetails?.emailVerified).toBe(true);
    expect(stored?.personalDetails?.password).toBeUndefined();
    expect(stored?.languagePreference).toBe("es");
    expect(stored?.verificationToken).toBeUndefined();
    expect(sendEmailMock).not.toHaveBeenCalled();

    const refreshCookie = response.cookies.find(
      (cookie) => cookie.name === "refresh_token",
    );
    const refreshed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refresh_token=${refreshCookie!.value}` },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().user.email).toBe(defaultIdentity.email);
  });

  it("signs in the existing active User by Google subject", async () => {
    const existing = await User.create({
      googleId: defaultIdentity.subject,
      personalDetails: {
        email: defaultIdentity.email,
        password: await bcrypt.hash(password, 10),
        emailVerified: true,
      },
    });

    const response = await postGoogle(app);

    expect(response.statusCode).toBe(200);
    expect(response.json().user.id).toBe(String(existing._id));
    expect(await User.countDocuments()).toBe(1);
    expect(
      await User.countDocuments({
        "personalDetails.email": defaultIdentity.email,
      }),
    ).toBe(1);
  });

  it("resolves by Google subject before verified email", async () => {
    const subjectUser = await User.create({
      googleId: defaultIdentity.subject,
      personalDetails: {
        email: "subject-user@test.com",
        password: await bcrypt.hash(password, 10),
        emailVerified: true,
      },
    });
    const emailUser = await User.create({
      personalDetails: {
        email: defaultIdentity.email,
        password: await bcrypt.hash(password, 10),
        emailVerified: true,
      },
    });

    const response = await postGoogle(app);

    expect(response.statusCode).toBe(200);
    expect(response.json().user.id).toBe(String(subjectUser._id));
    const untouched = await User.findById(emailUser._id).lean();
    expect(untouched?.personalDetails?.email).toBe(defaultIdentity.email);
    expect(untouched?.googleId).toBeUndefined();
  });

  it("links a verified Google email to the existing active User", async () => {
    const existing = await User.create({
      personalDetails: {
        email: defaultIdentity.email,
        password: await bcrypt.hash(password, 10),
        emailVerified: false,
        firstName: "Existing",
      },
    });

    const response = await postGoogle(app);

    expect(response.statusCode).toBe(200);
    expect(response.json().user.id).toBe(String(existing._id));
    expect(await User.countDocuments()).toBe(1);

    const stored = await User.findById(existing._id).lean();
    expect(stored?.googleId).toBe(defaultIdentity.subject);
    expect(stored?.personalDetails?.emailVerified).toBe(true);
    expect(stored?.personalDetails?.firstName).toBe("Existing");
  });

  it("refuses a different Google subject already linked to the email", async () => {
    const existing = await User.create({
      googleId: "different-subject",
      personalDetails: {
        email: defaultIdentity.email,
        password: await bcrypt.hash(password, 10),
        emailVerified: true,
      },
    });

    const response = await postGoogle(app);

    expect(response.statusCode).toBe(409);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json().detail).toBe(
      "This email is linked to a different Google account.",
    );
    expect(response.json().accessToken).toBeUndefined();
    expect(
      response.cookies.find((cookie) => cookie.name === "refresh_token"),
    ).toBeUndefined();

    const stored = await User.findById(existing._id).lean();
    expect(stored?.googleId).toBe("different-subject");
    expect(await User.countDocuments()).toBe(1);
  });

  it("keeps the email-confirmed reactivation path for a soft-deleted User", async () => {
    const deleted = await User.create({
      personalDetails: {
        email: defaultIdentity.email,
        password: await bcrypt.hash(password, 10),
      },
      deleted: true,
      deletedAt: new Date(),
    });

    const response = await postGoogle(app);

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      message: REACTIVATION_REQUIRED_MESSAGE,
    });
    expect(response.json().accessToken).toBeUndefined();
    expect(
      response.cookies.find((cookie) => cookie.name === "refresh_token"),
    ).toBeUndefined();

    const stored = await User.findOne({
      _id: deleted._id,
      deleted: true,
    }).lean();
    expect(stored?.deleted).toBe(true);
    expect(stored?.verificationToken).toEqual(expect.any(String));
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("lets a Google-only User set a password through reset and sign in with it", async () => {
    const created = await postGoogle(app);
    expect(created.statusCode).toBe(201);

    const noPasswordLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: defaultIdentity.email, password },
    });
    expect(noPasswordLogin.statusCode).toBe(401);
    expect(noPasswordLogin.json().detail).toBe("Invalid credentials");

    const requested = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email: defaultIdentity.email },
    });
    expect(requested.statusCode).toBe(200);

    const resetToken = resetTokenFromLastEmail();
    const reset = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: resetToken, newPassword: password },
    });
    expect(reset.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: defaultIdentity.email, password },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().user.id).toBe(created.json().user.id);
  });

  it("returns 401 when the verifier refuses the credential", async () => {
    verifyGoogle.mockRejectedValue(new GoogleCredentialError());

    const response = await postGoogle(app);

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json().detail).toBe("Invalid Google credential");
    expect(await User.countDocuments()).toBe(0);
  });

  it("hides the endpoint when Google is not configured while email auth still works", async () => {
    const unconfiguredApp = await buildApp({
      logger: false,
      skipDb: true,
      googleVerifier: null,
    });

    try {
      const google = await postGoogle(unconfiguredApp);
      expect(google.statusCode).toBe(404);
      expect(google.headers["content-type"]).toContain(
        "application/problem+json",
      );

      const signup = await unconfiguredApp.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: {
          email: `email-auth-${Date.now()}@test.com`,
          password,
        },
      });
      expect(signup.statusCode).toBe(201);
      expect(signup.json().user.emailVerified).toBe(false);
    } finally {
      await unconfiguredApp.close();
    }
  });
});
