/**
 * POST /api/v1/auth/request-email-change
 *
 * An authenticated business owner starts a verified sign-in email change. The
 * current email stays active until the new address confirms the emailed link.
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
  vi.fn().mockResolvedValue({
    channel: "email",
    success: true,
    sentCount: 1,
  }),
);

vi.mock("../../src/communications/channels/emailChannel.ts", () => ({
  default: { send: sendEmailMock },
}));

import {
  emailRailFailure,
  emailRailSuccess,
  expectOneAccountSend,
} from "../helpers/accountEmailRail.ts";
import { getTestApp, generateTestToken, resetTestApp } from "../setup.ts";
import Business from "../../src/models/business.ts";
import User from "../../src/models/user.ts";
import {
  EMAIL_CHANGE_REQUESTED_MESSAGE,
  EMAIL_CHANGE_REQUEST_COOLDOWN_MS,
} from "../../src/auth/requestEmailChange.ts";

const testPassword = "TestPassword123!";
const newEmail = "changed-to@example.com";

async function createBusiness(
  email: string,
  overrides: Record<string, unknown> = {},
) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return Business.create({
    tradeName: "Email Change Bistro",
    legalName: "Email Change Bistro LLC",
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

async function createUser(email: string) {
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
      emailVerified: true,
    },
  });
}

async function businessTokenFor(business: { _id: unknown; email: string }) {
  return generateTestToken({
    id: String(business._id),
    email: business.email,
    type: "business",
    role: "Tenant",
  });
}

/** Backdates the cooldown stamp so the next request is treated as a fresh send. */
async function agePendingRequestCooldown(businessId: unknown): Promise<void> {
  await Business.updateOne(
    { _id: businessId },
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
    sendEmailMock.mockResolvedValue(emailRailSuccess);
  });

  it("stores the pending email, emails the new address, and leaves the current email unchanged", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-happy@example.com");
    const auth = await businessTokenFor(business);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: testPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe(EMAIL_CHANGE_REQUESTED_MESSAGE);

    const stored = await Business.findById(business._id).lean();
    expect(stored?.pendingEmail).toBe(newEmail);
    expect(stored?.pendingEmailToken).toBeTruthy();
    expect(stored?.pendingEmailExpires?.getTime()).toBeGreaterThan(Date.now());
    expect(stored?.email).toBe("owner-happy@example.com");
    expect(stored?.emailVerified).toBe(false);
    expectOneAccountSend(sendEmailMock, {
      to: newEmail,
      subject: "Confirm Your New Sign-in Email - POS",
      link: `/confirm-email-change?token=${stored?.pendingEmailToken}`,
    });
  });

  it("returns 401 when the current password is wrong and stores nothing", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-badpass@example.com");
    const auth = await businessTokenFor(business);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: "WrongPassword123!" },
    });

    expect(response.statusCode).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();

    const stored = await Business.findById(business._id).lean();
    expect(stored?.pendingEmail).toBeUndefined();
    expect(stored?.pendingEmailToken).toBeUndefined();
    expect(stored?.email).toBe("owner-badpass@example.com");
  });

  it("returns 409 when the new email belongs to another business", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-dup-biz@example.com");
    await createBusiness("taken-by-biz@example.com");
    const auth = await businessTokenFor(business);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "taken-by-biz@example.com", currentPassword: testPassword },
    });

    expect(response.statusCode).toBe(409);
    expect(sendEmailMock).not.toHaveBeenCalled();

    const stored = await Business.findById(business._id).lean();
    expect(stored?.pendingEmail).toBeUndefined();
  });

  it("returns 409 when the new email is pending on another business", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-dup-pending@example.com");
    await createBusiness("reserving-biz@example.com", {
      pendingEmail: "reserved-by-pending@example.com",
      pendingEmailToken: "reserving-token",
      pendingEmailExpires: new Date(Date.now() + 3_600_000),
    });
    const auth = await businessTokenFor(business);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "reserved-by-pending@example.com",
        currentPassword: testPassword,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(sendEmailMock).not.toHaveBeenCalled();

    const stored = await Business.findById(business._id).lean();
    expect(stored?.pendingEmail).toBeUndefined();
  });

  it("returns 409 when the new email belongs to a user account", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-dup-user@example.com");
    await createUser("taken-by-user@example.com");
    const auth = await businessTokenFor(business);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: {
        newEmail: "taken-by-user@example.com",
        currentPassword: testPassword,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the new email matches the current sign-in email", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-same@example.com");
    const auth = await businessTokenFor(business);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "owner-same@example.com", currentPassword: testPassword },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
      "newEmail",
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rolls back the pending fields when the email send fails", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-sendfail@example.com");
    const auth = await businessTokenFor(business);
    sendEmailMock.mockResolvedValue(emailRailFailure);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: testPassword },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json().detail).toBe(
      "Failed to send confirmation email. Please try again later.",
    );

    const stored = await Business.findById(business._id).lean();
    expect(stored?.pendingEmail).toBeUndefined();
    expect(stored?.pendingEmailToken).toBeUndefined();
    expect(stored?.pendingEmailExpires).toBeUndefined();
    expect(stored?.email).toBe("owner-sendfail@example.com");
  });

  it("replaces the previous pending token on a new request once the cooldown elapses", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-replace@example.com");
    const auth = await businessTokenFor(business);

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "first-choice@example.com", currentPassword: testPassword },
    });
    expect(first.statusCode).toBe(200);
    const firstToken = (await Business.findById(business._id).lean())
      ?.pendingEmailToken;

    await agePendingRequestCooldown(business._id);

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "second-choice@example.com", currentPassword: testPassword },
    });
    expect(second.statusCode).toBe(200);

    const stored = await Business.findById(business._id).lean();
    expect(stored?.pendingEmail).toBe("second-choice@example.com");
    expect(stored?.pendingEmailToken).toBeTruthy();
    expect(stored?.pendingEmailToken).not.toBe(firstToken);
  });

  it("restores the previous pending change when a replacement request fails to send", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-restore@example.com");
    const auth = await businessTokenFor(business);

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "still-valid@example.com", currentPassword: testPassword },
    });
    expect(first.statusCode).toBe(200);
    const original = await Business.findById(business._id).lean();

    await agePendingRequestCooldown(business._id);

    sendEmailMock.mockResolvedValue(emailRailFailure);
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "never-sent@example.com", currentPassword: testPassword },
    });
    expect(second.statusCode).toBe(500);
    expect(second.headers["content-type"]).toContain("application/problem+json");
    expect(second.json().detail).toBe(
      "Failed to send confirmation email. Please try again later.",
    );

    const restored = await Business.findById(business._id).lean();
    expect(restored?.pendingEmail).toBe("still-valid@example.com");
    expect(restored?.pendingEmailToken).toBe(original?.pendingEmailToken);
    expect(restored?.pendingEmailExpires?.getTime()).toBe(
      original?.pendingEmailExpires?.getTime(),
    );
  });

  it("throttles a second request inside the cooldown without sending another email", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-throttle@example.com");
    const auth = await businessTokenFor(business);

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "throttle-first@example.com", currentPassword: testPassword },
    });
    expect(first.statusCode).toBe(200);
    const firstStored = await Business.findById(business._id).lean();

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "throttle-second@example.com", currentPassword: testPassword },
    });

    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).message).toBe(EMAIL_CHANGE_REQUESTED_MESSAGE);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const stored = await Business.findById(business._id).lean();
    expect(stored?.pendingEmail).toBe("throttle-first@example.com");
    expect(stored?.pendingEmailToken).toBe(firstStored?.pendingEmailToken);
    expect(stored?.pendingEmailExpires?.getTime()).toBe(
      firstStored?.pendingEmailExpires?.getTime(),
    );
  });

  it("sends again once the cooldown has elapsed", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-cooldown-elapsed@example.com", {
      pendingEmail: "stale-choice@example.com",
      pendingEmailToken: "s".repeat(64),
      pendingEmailExpires: new Date(Date.now() + 3_600_000),
      pendingEmailRequestedAt: new Date(
        Date.now() - EMAIL_CHANGE_REQUEST_COOLDOWN_MS - 1_000,
      ),
    });
    const auth = await businessTokenFor(business);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "fresh-choice@example.com", currentPassword: testPassword },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const stored = await Business.findById(business._id).lean();
    expect(stored?.pendingEmail).toBe("fresh-choice@example.com");
    expect(stored?.pendingEmailToken).not.toBe("s".repeat(64));
  });

  it("returns 400 for an invalid new email", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-bademail@example.com");
    const auth = await businessTokenFor(business);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail: "not-an-email", currentPassword: testPassword },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    const body = JSON.parse(response.body);
    expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
    expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
      "newEmail",
    );
  });

  it("returns 400 for a blank current password", async () => {
    const app = await getTestApp();
    const business = await createBusiness("owner-blankpass@example.com");
    const auth = await businessTokenFor(business);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: "" },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
      "currentPassword",
    );
  });

  it("returns 401 without an access token", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      payload: { newEmail, currentPassword: testPassword },
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns 403 for a non-business session", async () => {
    const app = await getTestApp();
    const auth = await generateTestToken({
      id: new Types.ObjectId().toString(),
      email: "customer@example.com",
      type: "user",
      role: "Customer",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-email-change",
      headers: { authorization: auth },
      payload: { newEmail, currentPassword: testPassword },
    });

    expect(response.statusCode).toBe(403);
  });
});
