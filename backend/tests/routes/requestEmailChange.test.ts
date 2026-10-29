/**
 * POST /api/v1/auth/request-email-change
 *
 * A signed-in User starts a verified sign-in email change with their current
 * password. The current email stays active until the new address confirms the
 * emailed link.
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

import { getTestApp, generateTestToken, resetTestApp } from "../setup.ts";
import AuditEntry from "../../src/models/auditEntry.ts";
import User from "../../src/models/user.ts";
import { AUDIT_ACT_KINDS } from "../../src/audit/auditCatalogue.ts";
import {
  EMAIL_CHANGE_REQUESTED_MESSAGE,
  EMAIL_CHANGE_REQUEST_COOLDOWN_MS,
} from "../../src/auth/requestEmailChange.ts";

const testPassword = "TestPassword123!";
const newEmail = "changed-to@example.com";

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

async function tokenFor(user: { _id: unknown; personalDetails: { email: string } }) {
  return generateTestToken({
    id: String(user._id),
    email: user.personalDetails.email,
    type: "user",
    role: "Customer",
  });
}

async function agePendingRequestCooldown(userId: unknown): Promise<void> {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        pendingEmailRequestedAt: new Date(
          Date.now() - EMAIL_CHANGE_REQUEST_COOLDOWN_MS - 1_000,
        ),
      },
    },
  );
}

describe("POST /api/v1/auth/request-email-change", () => {
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

  it("stores only the pending target and emails the new address", async () => {
    const app = await getTestApp();
    const user = await createUser("happy@example.com");
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: testPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(
      EMAIL_CHANGE_REQUESTED_MESSAGE,
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: newEmail }),
    );

    const stored = await User.findById(user._id).lean();
    expect(stored?.pendingEmail).toBe(newEmail);
    expect(stored?.pendingEmailToken).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.pendingEmailExpires?.getTime()).toBeGreaterThan(Date.now());
    expect(stored?.pendingEmailRequestedAt).toBeInstanceOf(Date);
    expect(stored?.personalDetails.email).toBe("happy@example.com");
    expect(stored?.personalDetails.emailVerified).toBe(true);

    const html = sendEmailMock.mock.calls[0][0].html as string;
    expect(html).toContain(
      `/confirm-email-change?token=${stored?.pendingEmailToken}`,
    );
  });

  it("normalizes the new address before storing and sending", async () => {
    const app = await getTestApp();
    const user = await createUser("normalize@example.com");
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "  NEW.Address@Example.COM ",
        currentPassword: testPassword,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "new.address@example.com" }),
    );
    const stored = await User.findById(user._id).lean();
    expect(stored?.pendingEmail).toBe("new.address@example.com");
  });

  it("logs one audit entry on success without the address or token", async () => {
    const app = await getTestApp();
    const user = await createUser("audit-success@example.com");
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: testPassword },
    });
    expect(response.statusCode).toBe(200);

    const stored = await User.findById(user._id).lean();
    const entries = await AuditEntry.find({}).lean();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.actKind).toBe(AUDIT_ACT_KINDS.EMAIL_CHANGE_REQUESTED);
    expect(String(entries[0]?.actorId)).toBe(String(user._id));
    expect(entries[0]?.target.kind).toBe("User");
    expect(String(entries[0]?.target.id)).toBe(String(user._id));

    const serialized = JSON.stringify(entries[0]);
    expect(serialized).not.toContain(newEmail);
    expect(serialized).not.toContain(String(stored?.pendingEmailToken));
  });

  it("returns 401 when the current password is wrong and stores nothing", async () => {
    const app = await getTestApp();
    const user = await createUser("badpass@example.com");
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: "WrongPassword123!" },
    });

    expect(response.statusCode).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(await AuditEntry.countDocuments({})).toBe(0);

    const stored = await User.findById(user._id).lean();
    expect(stored?.pendingEmail).toBeUndefined();
    expect(stored?.pendingEmailToken).toBeUndefined();
    expect(stored?.personalDetails.email).toBe("badpass@example.com");
  });

  it("refuses an account with no password", async () => {
    const app = await getTestApp();
    const user = await createUser("google-only@example.com", {
      personalDetails: {
        email: "google-only@example.com",
        googleId: "google-subject",
        username: "google-only",
      },
    });
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: testPassword },
    });

    expect(response.statusCode).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the new email matches the current sign-in email", async () => {
    const app = await getTestApp();
    const user = await createUser("same@example.com");
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "same@example.com",
        currentPassword: testPassword,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
      "newEmail",
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the new email is another active sign-in email", async () => {
    const app = await getTestApp();
    const user = await createUser("taken-from@example.com");
    await createUser("already-active@example.com");
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "already-active@example.com",
        currentPassword: testPassword,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 409 when another User has a live pending change to the address", async () => {
    const app = await getTestApp();
    const user = await createUser("pending-from@example.com");
    await createUser("reserving@example.com", {
      pendingEmail: "reserved@example.com",
      pendingEmailToken: "r".repeat(64),
      pendingEmailExpires: new Date(Date.now() + 3_600_000),
      pendingEmailRequestedAt: new Date(),
    });
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "reserved@example.com",
        currentPassword: testPassword,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("ignores an expired pending change on another User", async () => {
    const app = await getTestApp();
    const user = await createUser("expired-from@example.com");
    await createUser("expired-reserving@example.com", {
      pendingEmail: "released@example.com",
      pendingEmailToken: "e".repeat(64),
      pendingEmailExpires: new Date(Date.now() - 60_000),
      pendingEmailRequestedAt: new Date(Date.now() - 120_000),
    });
    const auth = await tokenFor(user);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "released@example.com",
        currentPassword: testPassword,
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it("clears the new pending fields when the send fails", async () => {
    const app = await getTestApp();
    const user = await createUser("sendfail@example.com");
    const auth = await tokenFor(user);
    sendEmailMock.mockResolvedValue({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "SMTP down",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: testPassword },
    });

    expect(response.statusCode).toBe(500);
    expect(await AuditEntry.countDocuments({})).toBe(0);

    const stored = await User.findById(user._id).lean();
    expect(stored?.pendingEmail).toBeUndefined();
    expect(stored?.pendingEmailToken).toBeUndefined();
    expect(stored?.pendingEmailExpires).toBeUndefined();
    expect(stored?.personalDetails.email).toBe("sendfail@example.com");
  });

  it("restores the previous pending change when a replacement send fails", async () => {
    const app = await getTestApp();
    const user = await createUser("restore@example.com");
    const auth = await tokenFor(user);

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "still-valid@example.com",
        currentPassword: testPassword,
      },
    });
    expect(first.statusCode).toBe(200);

    await agePendingRequestCooldown(user._id);
    const original = await User.findById(user._id).lean();

    sendEmailMock.mockResolvedValue({
      channel: "email",
      success: false,
      sentCount: 0,
      error: "SMTP down",
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "never-sent@example.com",
        currentPassword: testPassword,
      },
    });
    expect(second.statusCode).toBe(500);

    const restored = await User.findById(user._id).lean();
    expect(restored?.pendingEmail).toBe("still-valid@example.com");
    expect(restored?.pendingEmailToken).toBe(original?.pendingEmailToken);
    expect(restored?.pendingEmailExpires?.getTime()).toBe(
      original?.pendingEmailExpires?.getTime(),
    );
    expect(restored?.pendingEmailRequestedAt?.getTime()).toBe(
      original?.pendingEmailRequestedAt?.getTime(),
    );
  });

  it("throttles a second request inside the cooldown without sending again", async () => {
    const app = await getTestApp();
    const user = await createUser("throttle@example.com");
    const auth = await tokenFor(user);

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "throttle-first@example.com",
        currentPassword: testPassword,
      },
    });
    expect(first.statusCode).toBe(200);
    const firstStored = await User.findById(user._id).lean();

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "throttle-second@example.com",
        currentPassword: testPassword,
      },
    });

    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).message).toBe(
      EMAIL_CHANGE_REQUESTED_MESSAGE,
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const stored = await User.findById(user._id).lean();
    expect(stored?.pendingEmail).toBe("throttle-first@example.com");
    expect(stored?.pendingEmailToken).toBe(firstStored?.pendingEmailToken);
    expect(stored?.pendingEmailExpires?.getTime()).toBe(
      firstStored?.pendingEmailExpires?.getTime(),
    );
  });

  it("replaces the previous pending link after the cooldown", async () => {
    const app = await getTestApp();
    const user = await createUser("replace@example.com");
    const auth = await tokenFor(user);

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "first-choice@example.com",
        currentPassword: testPassword,
      },
    });
    expect(first.statusCode).toBe(200);
    const firstToken = (await User.findById(user._id).lean())?.pendingEmailToken;

    await agePendingRequestCooldown(user._id);

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "second-choice@example.com",
        currentPassword: testPassword,
      },
    });
    expect(second.statusCode).toBe(200);

    const stored = await User.findById(user._id).lean();
    expect(stored?.pendingEmail).toBe("second-choice@example.com");
    expect(stored?.pendingEmailToken).toBeTruthy();
    expect(stored?.pendingEmailToken).not.toBe(firstToken);
  });

  it("returns 400 for an invalid new email and a blank password", async () => {
    const app = await getTestApp();
    const user = await createUser("validation@example.com");
    const auth = await tokenFor(user);

    const invalidEmail = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "not-an-email", currentPassword: testPassword },
    });
    expect(invalidEmail.statusCode).toBe(400);
    expect(
      JSON.parse(invalidEmail.body).errors?.map(
        (e: { path: string }) => e.path,
      ),
    ).toContain("newEmail");

    const blankPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: "" },
    });
    expect(blankPassword.statusCode).toBe(400);
    expect(
      JSON.parse(blankPassword.body).errors?.map(
        (e: { path: string }) => e.path,
      ),
    ).toContain("currentPassword");
  });

  it("requires a live User session", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      payload: { newEmail, currentPassword: testPassword },
    });
    expect(response.statusCode).toBe(401);
  });
});
