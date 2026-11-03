/**
 * POST /api/v1/business/:businessId/request-email-verification
 *
 * The venue contact address is verified through the account-email rail. The
 * request is an authenticated Admin/Owner action; every other layer is refused.
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

import { getTestApp, generateTestToken, resetTestApp } from "../setup.ts";
import Business from "../../src/models/business.ts";
import Employee from "../../src/models/employee.ts";
import RefreshSession from "../../src/models/refreshSession.ts";
import User from "../../src/models/user.ts";
import {
  BUSINESS_CONTACT_VERIFICATION_ALREADY_VERIFIED_MESSAGE,
  BUSINESS_CONTACT_VERIFICATION_COOLDOWN_MESSAGE,
  BUSINESS_CONTACT_VERIFICATION_NO_CONTACT_EMAIL_MESSAGE,
  BUSINESS_CONTACT_VERIFICATION_SEND_FAILED_MESSAGE,
  BUSINESS_CONTACT_VERIFICATION_SENT_MESSAGE,
} from "../../src/business/businessContactEmail.ts";
import { VERIFICATION_TOKEN_TTL_MS } from "../../src/auth/authEmailTokenFlow.ts";
import { CONFIRM_EMAIL_SUCCESS_MESSAGE } from "../../src/auth/confirmEmail.ts";
import {
  emailRailFailure,
  emailRailSuccess,
  expectOneAccountSend,
} from "../helpers/accountEmailRail.ts";
import {
  createTestBusiness,
  createTestOwnerCompany,
} from "../helpers/fixtures.ts";

const BUSINESS_VERIFICATION_SUBJECT =
  "Confirm Your Business Contact Email - POS";
const BUSINESS_VERIFICATION_SUBJECT_ES =
  "Confirma el correo de contacto de tu negocio - POS";
const REQUEST_PATH = (businessId: string | Types.ObjectId) =>
  `/api/v1/business/${String(businessId)}/request-email-verification`;

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function futureExpiry(): Date {
  return new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
}

async function ownedBusiness(
  overrides: Record<string, unknown> = {},
  jwtLanguagePreference?: "en" | "es",
) {
  const { user, company } = await createTestOwnerCompany();
  const business = await createTestBusiness({
    tradeName: "Verification Venue",
    email: "venue-contact@example.com",
    currencyTrade: "USD",
    address: validAddress,
    companyId: company._id,
    ...overrides,
  });
  const auth = await generateTestToken({
    id: user._id.toString(),
    email: user.personalDetails.email,
    type: "user",
    role: "Customer",
    ...(jwtLanguagePreference
      ? { languagePreference: jwtLanguagePreference }
      : {}),
  });
  return { business, auth, user, company };
}

async function memberAuth(
  businessId: string | Types.ObjectId,
  roles: string[],
  languagePreference?: "en" | "es",
): Promise<string> {
  const userId = new Types.ObjectId();
  const email = `member-${userId}@test.com`;
  await User.create({
    _id: userId,
    personalDetails: { email, firstName: "Venue", lastName: "Member" },
    ...(languagePreference ? { languagePreference } : {}),
  });
  const employee = await Employee.create({
    businessId,
    userId,
    allEmployeeRoles: roles,
    currentShiftRole: roles[0],
    taxNumber: `EMP-${new Types.ObjectId()}`,
    joinDate: new Date(),
    vacationDaysPerYear: 20,
    active: true,
  });
  return generateTestToken({
    id: userId.toString(),
    email,
    type: "user",
    role: roles[0],
    businessId: String(businessId),
    employeeId: employee._id.toString(),
    canLogAsEmployee: true,
  });
}

async function strangerAuth(): Promise<string> {
  const userId = new Types.ObjectId();
  const email = `stranger-${userId}@test.com`;
  await User.create({
    _id: userId,
    personalDetails: { email, firstName: "No", lastName: "Access" },
  });
  return generateTestToken({
    id: userId.toString(),
    email,
    type: "user",
    role: "Customer",
  });
}

describe("POST /api/v1/business/:businessId/request-email-verification", () => {
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

  it("requires authentication", async () => {
    const app = await getTestApp();
    const { business } = await ownedBusiness();

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it.each([
    ["manager", "Manager"],
    ["supervisor", "Supervisor"],
    ["employee", "Waiter"],
  ])("refuses a %s membership with 403", async (_label, role) => {
    const app = await getTestApp();
    const { business } = await ownedBusiness();

    const auth = await memberAuth(business._id, [role]);
    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
    const stored = await Business.findById(business._id)
      .select(
        "contactVerificationToken contactVerificationTokenExpires contactVerificationRequestedAt",
      )
      .lean();
    expect(stored?.contactVerificationToken).toBeUndefined();
    expect(stored?.contactVerificationTokenExpires).toBeUndefined();
  });

  it("refuses a stranger with no ownership or membership", async () => {
    const app = await getTestApp();
    const { business } = await ownedBusiness();

    const auth = await strangerAuth();
    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("lets an owner issue one English venue email and writes only Business token state", async () => {
    const app = await getTestApp();
    const { business, auth } = await ownedBusiness();

    const usersBefore = await User.countDocuments();
    const employeesBefore = await Employee.countDocuments();
    const sessionsBefore = await RefreshSession.countDocuments();

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe(
      BUSINESS_CONTACT_VERIFICATION_SENT_MESSAGE,
    );

    const stored = await Business.findById(business._id)
      .select(
        "email contactVerificationToken contactVerificationTokenExpires contactVerificationRequestedAt",
      )
      .lean();
    expect(stored?.email).toBe("venue-contact@example.com");
    expect(stored?.contactVerificationToken).toMatch(/^[0-9a-f]{64}$/);
    const ttl =
      stored!.contactVerificationTokenExpires!.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(VERIFICATION_TOKEN_TTL_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(VERIFICATION_TOKEN_TTL_MS);
    expect(
      Date.now() - stored!.contactVerificationRequestedAt!.getTime(),
    ).toBeLessThan(60_000);

    expectOneAccountSend(sendEmailMock, {
      to: "venue-contact@example.com",
      subject: BUSINESS_VERIFICATION_SUBJECT,
      link: `/confirm-email?token=${stored?.contactVerificationToken}`,
    });
    const payload = sendEmailMock.mock.calls[0]?.[0] as {
      text?: string;
      html?: string;
    };
    expect(payload.text).toContain("Verification Venue");
    expect(payload.html).toContain("Verification Venue");

    await expect(User.countDocuments()).resolves.toBe(usersBefore);
    await expect(Employee.countDocuments()).resolves.toBe(employeesBefore);
    await expect(RefreshSession.countDocuments()).resolves.toBe(sessionsBefore);
  });

  it("uses the acting Owner's stored Spanish preference, not the JWT claim", async () => {
    const app = await getTestApp();
    const { business, auth, user } = await ownedBusiness({}, "en");
    await User.updateOne(
      { _id: user._id },
      { $set: { languagePreference: "es" } },
    );

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const stored = await Business.findById(business._id)
      .select("contactVerificationToken")
      .lean();
    expectOneAccountSend(sendEmailMock, {
      to: "venue-contact@example.com",
      subject: BUSINESS_VERIFICATION_SUBJECT_ES,
      link: `/confirm-email?token=${stored?.contactVerificationToken}`,
    });
    const payload = sendEmailMock.mock.calls[0]?.[0] as {
      text?: string;
      html?: string;
    };
    expect(payload.text).toContain("24 horas");
    expect(payload.text).toContain("Verification Venue");
  });

  it("uses the acting Admin membership's stored Spanish preference", async () => {
    const app = await getTestApp();
    const { business } = await ownedBusiness();
    const auth = await memberAuth(business._id, ["Admin"], "es");

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0] as { subject?: string };
    expect(payload.subject).toBe(BUSINESS_VERIFICATION_SUBJECT_ES);
  });

  it("sends English for an unsupported stored preference", async () => {
    const app = await getTestApp();
    const { business, auth, user } = await ownedBusiness();
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { languagePreference: "fr" } },
    );

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const payload = sendEmailMock.mock.calls[0]?.[0] as { subject?: string };
    expect(payload.subject).toBe(BUSINESS_VERIFICATION_SUBJECT);
  });

  it("does not use the venue contact address as a User identity for language", async () => {
    const app = await getTestApp();
    const { business, auth, user } = await ownedBusiness();
    await User.updateOne(
      { _id: user._id },
      { $set: { languagePreference: "en" } },
    );
    await User.create({
      personalDetails: {
        email: "venue-contact@example.com",
        firstName: "Contact",
        lastName: "Only",
      },
      languagePreference: "es",
    });

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    const payload = sendEmailMock.mock.calls[0]?.[0] as { subject?: string };
    expect(payload.subject).toBe(BUSINESS_VERIFICATION_SUBJECT);
  });

  it("lets an Admin membership issue the verification email", async () => {
    const app = await getTestApp();
    const { business } = await ownedBusiness();
    const auth = await memberAuth(business._id, ["Admin"]);

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("is a 200 no-op when the contact email is already verified", async () => {
    const app = await getTestApp();
    const { business, auth } = await ownedBusiness({ emailVerified: true });

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe(
      BUSINESS_CONTACT_VERIFICATION_ALREADY_VERIFIED_MESSAGE,
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
    const stored = await Business.findById(business._id)
      .select(
        "contactVerificationToken contactVerificationTokenExpires contactVerificationRequestedAt",
      )
      .lean();
    expect(stored?.contactVerificationToken).toBeUndefined();
    expect(stored?.contactVerificationTokenExpires).toBeUndefined();
    expect(stored?.contactVerificationRequestedAt).toBeUndefined();
  });

  it("is a 200 no-op inside the one-minute cooldown and changes nothing", async () => {
    const app = await getTestApp();
    const { business, auth } = await ownedBusiness();

    const first = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });
    expect(first.statusCode).toBe(200);
    const firstStored = await Business.findById(business._id)
      .select(
        "contactVerificationToken contactVerificationTokenExpires contactVerificationRequestedAt",
      )
      .lean();

    const second = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().message).toBe(
      BUSINESS_CONTACT_VERIFICATION_COOLDOWN_MESSAGE,
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const secondStored = await Business.findById(business._id)
      .select(
        "contactVerificationToken contactVerificationTokenExpires contactVerificationRequestedAt",
      )
      .lean();
    expect(secondStored?.contactVerificationToken).toBe(
      firstStored?.contactVerificationToken,
    );
    expect(secondStored?.contactVerificationTokenExpires?.getTime()).toBe(
      firstStored?.contactVerificationTokenExpires?.getTime(),
    );
    expect(secondStored?.contactVerificationRequestedAt?.getTime()).toBe(
      firstStored?.contactVerificationRequestedAt?.getTime(),
    );
  });

  it("replaces the previous token after the cooldown so only the newest link works", async () => {
    const app = await getTestApp();
    const { business, auth } = await ownedBusiness();

    const first = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });
    expect(first.statusCode).toBe(200);
    const firstStored = await Business.findById(business._id)
      .select("contactVerificationToken")
      .lean();
    const firstToken = firstStored!.contactVerificationToken!;

    await Business.updateOne(
      { _id: business._id },
      { $set: { contactVerificationRequestedAt: new Date(Date.now() - 2 * 60_000) } },
    );

    const second = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });
    expect(second.statusCode).toBe(200);
    const secondStored = await Business.findById(business._id)
      .select("contactVerificationToken")
      .lean();
    const secondToken = secondStored!.contactVerificationToken!;

    expect(secondToken).not.toBe(firstToken);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);

    const oldLink = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: firstToken },
    });
    expect(oldLink.statusCode).toBe(400);

    const newLink = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: secondToken },
    });
    expect(newLink.statusCode).toBe(200);
    expect(newLink.json().message).toBe(CONFIRM_EMAIL_SUCCESS_MESSAGE);
  });

  it("returns 400 problem details when the venue has no contact email", async () => {
    const app = await getTestApp();
    const { business, auth } = await ownedBusiness({ email: undefined });

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json().detail).toBe(
      BUSINESS_CONTACT_VERIFICATION_NO_CONTACT_EMAIL_MESSAGE,
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns 500 and leaves token state unset when the rail fails and none existed", async () => {
    const app = await getTestApp();
    const { business, auth } = await ownedBusiness();
    sendEmailMock.mockResolvedValue(emailRailFailure);

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json().detail).toBe(
      BUSINESS_CONTACT_VERIFICATION_SEND_FAILED_MESSAGE,
    );

    const stored = await Business.findById(business._id)
      .select(
        "contactVerificationToken contactVerificationTokenExpires contactVerificationRequestedAt",
      )
      .lean();
    expect(stored?.contactVerificationToken).toBeUndefined();
    expect(stored?.contactVerificationTokenExpires).toBeUndefined();
    expect(stored?.contactVerificationRequestedAt).toBeUndefined();
  });

  it("restores a previous still-valid link when a resend fails", async () => {
    const app = await getTestApp();
    const previousToken = randomToken();
    const previousExpiry = futureExpiry();
    const previousRequestedAt = new Date(Date.now() - 5 * 60_000);
    const { business, auth } = await ownedBusiness({
      contactVerificationToken: previousToken,
      contactVerificationTokenExpires: previousExpiry,
      contactVerificationRequestedAt: previousRequestedAt,
    });
    sendEmailMock.mockResolvedValue(emailRailFailure);

    const response = await app.inject({
      method: "POST",
      url: REQUEST_PATH(business._id),
      headers: { authorization: auth },
    });

    expect(response.statusCode).toBe(500);
    const stored = await Business.findById(business._id)
      .select(
        "contactVerificationToken contactVerificationTokenExpires contactVerificationRequestedAt",
      )
      .lean();
    expect(stored?.contactVerificationToken).toBe(previousToken);
    expect(stored?.contactVerificationTokenExpires?.getTime()).toBe(
      previousExpiry.getTime(),
    );
    expect(stored?.contactVerificationRequestedAt?.getTime()).toBe(
      previousRequestedAt.getTime(),
    );

    const oldLink = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: previousToken },
    });
    expect(oldLink.statusCode).toBe(200);
    expect(oldLink.json().message).toBe(CONFIRM_EMAIL_SUCCESS_MESSAGE);
  });

  it("keeps token state out of public profile, discovery, and portfolio reads", async () => {
    const app = await getTestApp();
    const token = randomToken();
    const { business, auth } = await ownedBusiness({
      contactVerificationToken: token,
      contactVerificationTokenExpires: futureExpiry(),
      contactVerificationRequestedAt: new Date(),
    });

    const profile = await app.inject({
      method: "GET",
      url: `/api/v1/business/${business._id}/profile`,
      headers: { authorization: auth },
    });
    expect(profile.statusCode).toBe(200);
    const profileBody = profile.json();
    expect(profileBody.email).toBe("venue-contact@example.com");
    expect(profileBody.emailVerified).toBe(false);
    for (const field of [
      "contactVerificationToken",
      "contactVerificationTokenExpires",
      "contactVerificationRequestedAt",
    ]) {
      expect(profileBody[field], field).toBeUndefined();
    }

    const discovery = await app.inject({
      method: "GET",
      url: "/api/v1/business",
    });
    expect(discovery.statusCode).toBe(200);
    const discovered = discovery.json().find(
      (item: { _id: string }) => item._id === String(business._id),
    );
    expect(discovered).toBeDefined();
    expect(discovered.email).toBeUndefined();
    expect(discovered.emailVerified).toBeUndefined();
    for (const field of [
      "contactVerificationToken",
      "contactVerificationTokenExpires",
      "contactVerificationRequestedAt",
    ]) {
      expect(discovered[field], field).toBeUndefined();
    }

    const portfolio = await app.inject({
      method: "GET",
      url: "/api/v1/owners/portfolio",
      headers: { authorization: auth },
    });
    expect(portfolio.statusCode).toBe(200);
    const portfolioBusiness = portfolio
      .json()
      .companies.flatMap(
        (company: { businesses: unknown[] }) => company.businesses,
      )
      .find((item: { _id: string }) => item._id === String(business._id));
    expect(portfolioBusiness).toBeDefined();
    for (const field of [
      "contactVerificationToken",
      "contactVerificationTokenExpires",
      "contactVerificationRequestedAt",
    ]) {
      expect(portfolioBusiness[field], field).toBeUndefined();
    }
  });
});
