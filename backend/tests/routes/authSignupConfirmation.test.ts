/**
 * POST /api/v1/auth/signup — confirmation email trigger
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
import { getTestApp, resetTestApp } from "../setup.ts";
import Business from "../../src/models/business.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";
import RefreshSession from "../../src/models/refreshSession.ts";
import User from "../../src/models/user.ts";

async function waitForUserVerificationToken(
  email: string,
  opts?: { expectPresent: boolean },
): Promise<void> {
  const expectPresent = opts?.expectPresent ?? true;
  const maxAttempts = 280;
  for (let i = 0; i < maxAttempts; i++) {
    const row = await User.findOne({ "personalDetails.email": email })
      .select("verificationToken")
      .lean();
    const has = Boolean(row?.verificationToken);
    if (expectPresent ? has : !has) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(
    expectPresent
      ? "timeout waiting for verificationToken"
      : "timeout waiting for token to stay cleared",
  );
}

async function waitForSendMockCalls(count: number): Promise<void> {
  const maxAttempts = 280;
  for (let i = 0; i < maxAttempts; i++) {
    if (sendEmailMock.mock.calls.length >= count) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(`timeout waiting for ${count} send mock call(s)`);
}

describe("POST /api/v1/auth/signup (confirmation email)", () => {
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

  it("returns 201 with session immediately and persists verification token after send", async () => {
    const app = await getTestApp();
    const email = `newuser-${Date.now()}@example.com`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        privacyAccepted: true,
        firstName: "Pat",
        lastName: "Lee",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.user?.type).toBe("user");
    expect(body.user?.email).toBe(email);
    expect(body.user.sessionId).toBeUndefined();
    expect(body.refreshToken).toBeUndefined();

    const refreshCookie = res.cookies.find(
      (cookie) => cookie.name === "refresh_token",
    );
    expect(refreshCookie?.value).toBeTruthy();
    expect(res.body).not.toContain(refreshCookie!.value);
    const refreshRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refresh_token=${refreshCookie!.value}` },
    });
    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.json().user.email).toBe(email);
    expect(refreshRes.json().user.sessionId).toBeUndefined();

    await waitForUserVerificationToken(email);
    const stored = await User.findOne({ "personalDetails.email": email })
      .select("verificationToken")
      .lean();
    expectOneAccountSend(sendEmailMock, {
      to: email,
      subject: "Confirm Your Email - POS",
      link: `/confirm-email?token=${stored?.verificationToken}`,
    });
  });


  it("creates only email, password, supplied names and language — no invented personal data", async () => {
    const app = await getTestApp();
    const email = `clean-signup-${Date.now()}@example.com`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        privacyAccepted: true,
        firstName: "Pat",
        languagePreference: "es",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().user.languagePreference).toBe("es");
    expect(res.json().user.emailVerified).toBe(false);

    const stored = await User.findOne({ "personalDetails.email": email }).lean();
    expect(stored?.personalDetails.firstName).toBe("Pat");
    expect(stored?.personalDetails.lastName).toBeUndefined();
    expect(stored?.personalDetails.username).toBeUndefined();
    expect(stored?.personalDetails.phoneNumber).toBeUndefined();
    expect(stored?.personalDetails.address).toBeUndefined();
    expect(stored?.personalDetails.birthDate).toBeUndefined();
    expect(stored?.personalDetails.gender).toBeUndefined();
    expect(stored?.personalDetails.nationality).toBeUndefined();
    expect(stored?.personalDetails.idType).toBeUndefined();
    expect(stored?.personalDetails.idNumber).toBeUndefined();
    expect(stored?.languagePreference).toBe("es");
  });

  it("creates an account with email and password only", async () => {
    const app = await getTestApp();
    const email = `minimal-signup-${Date.now()}@example.com`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        privacyAccepted: true,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().accessToken).toBeTruthy();
    const stored = await User.findOne({ "personalDetails.email": email }).lean();
    expect(stored?.personalDetails.email).toBe(email);
    expect(stored?.personalDetails.username).toBeUndefined();
    expect(stored?.personalDetails.firstName).toBeUndefined();
    expect(stored?.languagePreference).toBeUndefined();
  });

  it("stores privacy acceptance with a server timestamp and marketing consent off", async () => {
    const app = await getTestApp();
    const email = `acceptance-${Date.now()}@example.com`;
    const before = Date.now();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        privacyAccepted: true,
      },
    });
    const after = Date.now();

    expect(res.statusCode).toBe(201);
    const stored = await User.findOne({ "personalDetails.email": email }).lean();
    expect(stored?.privacyAccepted).toBe(true);
    expect(stored?.privacyAcceptedAt).toBeInstanceOf(Date);
    expect(stored?.privacyAcceptedAt?.getTime()).toBeGreaterThanOrEqual(before);
    expect(stored?.privacyAcceptedAt?.getTime()).toBeLessThanOrEqual(after);
    expect(stored?.marketingConsent).toBe(false);
    expect(stored?.marketingConsentUpdatedAt).toBeUndefined();
  });

  it("rejects a signup without the acceptance proof before creating a user", async () => {
    const app = await getTestApp();
    const email = `no-acceptance-${Date.now()}@example.com`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json().errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "privacyAccepted" }),
      ]),
    );
    expect(await User.countDocuments({ "personalDetails.email": email })).toBe(
      0,
    );
  });

  it("rejects a signup that refuses the acceptance proof before creating a user", async () => {
    const app = await getTestApp();
    const email = `refused-acceptance-${Date.now()}@example.com`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        privacyAccepted: false,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json().errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "privacyAccepted" }),
      ]),
    );
    expect(await User.countDocuments({ "personalDetails.email": email })).toBe(
      0,
    );
  });

  it("returns a generic outcome and emails the owner for an active duplicate sign-up", async () => {
    const app = await getTestApp();
    const email = `active-duplicate-${Date.now()}@example.com`;
    sendEmailMock.mockClear();

    await User.create({
      personalDetails: {
        email,
        password: "hashedpassword",
        username: "existing-person",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        privacyAccepted: true,
        firstName: "Someone",
      },
    });

    expect(res.statusCode).toBe(202);
    expect(res.json().message).not.toContain("already exists");
    expect(res.json().accessToken).toBeUndefined();
    expect(
      res.cookies.find((cookie) => cookie.name === "refresh_token"),
    ).toBeUndefined();
    expect(await RefreshSession.countDocuments()).toBe(0);
    expect(await User.countDocuments({ "personalDetails.email": email })).toBe(1);

    await waitForSendMockCalls(1);
    const payload = sendEmailMock.mock.calls[0]?.[0] as {
      to?: unknown;
      subject?: unknown;
      text?: unknown;
    };
    expect(payload.to).toBe(email);
    expect(payload.subject).toBe("You Already Have a POS Account");
    expect(String(payload.text)).toContain("/login");
    expect(String(payload.text)).toContain("/forgot-password");
  });

  it("still returns 201 when confirmation send fails (token cleared)", async () => {
    const app = await getTestApp();
    const email = `rollback-${Date.now()}@example.com`;

    sendEmailMock.mockResolvedValue(emailRailFailure);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        privacyAccepted: true,
      },
    });

    expect(res.statusCode).toBe(201);
    await waitForSendMockCalls(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    await waitForUserVerificationToken(email, { expectPresent: false });
  });

  it("returns a reactivation gate response when signup email belongs to a soft-deleted user", async () => {
    const app = await getTestApp();
    const email = `reactivate-${Date.now()}@example.com`;

    await User.create({
      deleted: true,
      deletedAt: new Date(),
      personalDetails: {
        username: "reactivate-user",
        email,
        password: "hashedpassword",
        firstName: "Re",
        lastName: "Activate",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Other",
        nationality: "USA",
        idType: "Passport",
        idNumber: `ID-${Date.now()}`,
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
        emailVerified: false,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        privacyAccepted: true,
        firstName: "Pat",
        lastName: "Lee",
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.reactivationRequired).toBe(true);
    expect(body.message).toContain("reactivation");
    expect(body.accessToken).toBeUndefined();
    expect(
      res.cookies.find((cookie) => cookie.name === "refresh_token"),
    ).toBeUndefined();
    expect(await RefreshSession.countDocuments()).toBe(0);

    const allRows = await User.find({ "personalDetails.email": email })
      .setOptions({ includeDeleted: true })
      .lean();
    expect(allRows).toHaveLength(1);
    expect(allRows[0].deleted).toBe(true);
    expect(allRows[0].verificationToken).toBeTruthy();
    expectOneAccountSend(sendEmailMock, {
      to: email,
      subject: "Confirm Your Email - POS",
      link: `/confirm-email?token=${allRows[0].verificationToken}`,
    });
  });

  it("reactivates the soft-deleted user when a business shares the signup email", async () => {
    const app = await getTestApp();
    const email = `shared-${Date.now()}@example.com`;

    await User.create({
      deleted: true,
      deletedAt: new Date(),
      personalDetails: {
        username: "shared-user",
        email,
        password: "hashedpassword",
        firstName: "Re",
        lastName: "Activate",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Other",
        nationality: "USA",
        idType: "Passport",
        idNumber: `ID-SHARED-${Date.now()}`,
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
        emailVerified: false,
      },
    });
    const business = await createTestBusiness({
      tradeName: "Shared Venue",
      legalName: "Shared Venue LLC",
      email,
      phoneNumber: "1234567890",
      taxNumber: `TAX-SHARED-${Date.now()}`,
      currencyTrade: "USD",
      address: {
        country: "USA",
        state: "CA",
        city: "LA",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "TestPassword123!",
        privacyAccepted: true,
        firstName: "Pat",
        lastName: "Lee",
      },
    });

    expect(res.statusCode).toBe(202);
    const user = await User.findOne({ "personalDetails.email": email })
      .setOptions({ includeDeleted: true })
      .lean();
    expect(user?.deleted).toBe(true);
    expect(user?.verificationToken).toBeTruthy();
    const venue = await Business.findById(business._id).lean();
    expect(venue?.email).toBe(email);
  });
});
