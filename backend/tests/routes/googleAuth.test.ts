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
import { Types } from "mongoose";
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
import Business from "../../src/models/business.ts";
import Employee from "../../src/models/employee.ts";
import Schedule from "../../src/models/schedule.ts";
import User from "../../src/models/user.ts";
import {
  GoogleCredentialError,
  type GoogleIdentity,
  type GoogleVerifier,
} from "../../src/auth/google.ts";
import { REACTIVATION_REQUIRED_MESSAGE } from "../../src/auth/requestEmailConfirmation.ts";
import ownerCompanyCreation from "../../src/owners/ownerCompanyCreation.ts";
import { fakeBusinessRecord } from "../helpers/fixtures.ts";
import { multipart } from "../helpers/multipart.ts";

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

function refreshCookieFrom(
  response: Awaited<ReturnType<typeof postGoogle>>,
): string {
  const cookie = response.cookies.find(
    (candidate) => candidate.name === "refresh_token",
  );
  if (!cookie?.value) throw new Error("response did not set a refresh cookie");
  return cookie.value;
}

async function createBusiness(label: string) {
  return Business.create({
    ...fakeBusinessRecord({ country: "USA" }),
    tradeName: `${label} Venue`,
    legalName: `${label} Venue Legal`,
    email: `${label}-venue@test.com`,
  });
}

async function createEmployee(
  businessId: Types.ObjectId,
  userId: Types.ObjectId,
  role: string,
) {
  return Employee.create({
    businessId,
    userId,
    taxNumber: `EMP-${role}-${userId}`,
    joinDate: new Date(),
    vacationDaysPerYear: 20,
    allEmployeeRoles: [role],
    currentShiftRole: role,
    active: true,
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

  describe("cross-slice identity regression", () => {
    it("keeps a Google-created User's saved language across refresh and /me", async () => {
      const created = await postGoogle(app, {
        credential: "google-id-token",
        languagePreference: "en",
      });
      expect(created.statusCode).toBe(201);
      expect(created.json().user.languagePreference).toBe("en");
      const userId = created.json().user.id as string;
      const accessToken = created.json().accessToken as string;
      const refreshCookie = refreshCookieFrom(created);

      const saved = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${userId}`,
        payload: multipart({ languagePreference: "es" }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: `Bearer ${accessToken}`,
        },
      });
      expect(saved.statusCode, saved.body).toBe(200);

      const refreshed = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${refreshCookie}` },
      });
      expect(refreshed.statusCode).toBe(200);
      expect(refreshed.json().user.languagePreference).toBe("es");

      const me = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(me.statusCode).toBe(200);
      expect(me.json().user.languagePreference).toBe("es");
    });

    it("keeps the existing language and profile when Google links to a password account", async () => {
      const existing = await User.create({
        languagePreference: "en",
        personalDetails: {
          email: defaultIdentity.email,
          password: await bcrypt.hash(password, 10),
          firstName: "Ada",
          lastName: "Lovelace",
          username: "adalovelace",
          phoneNumber: "9876543210",
          birthDate: new Date("1990-01-01"),
          gender: "Woman",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
        },
      });

      const linked = await postGoogle(app);
      expect(linked.statusCode).toBe(200);
      expect(linked.json().user.id).toBe(String(existing._id));
      expect(await User.countDocuments()).toBe(1);
      const accessToken = linked.json().accessToken as string;

      const stored = await User.findById(existing._id).lean();
      expect(stored?.googleId).toBe(defaultIdentity.subject);
      expect(stored?.personalDetails?.emailVerified).toBe(true);
      expect(stored?.languagePreference).toBe("en");
      expect(stored?.personalDetails?.firstName).toBe("Ada");
      expect(stored?.personalDetails?.lastName).toBe("Lovelace");
      expect(stored?.personalDetails?.username).toBe("adalovelace");
      expect(stored?.personalDetails?.phoneNumber).toBe("9876543210");

      const profile = await app.inject({
        method: "GET",
        url: `/api/v1/users/${existing._id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(profile.statusCode, profile.body).toBe(200);
      expect(profile.json().languagePreference).toBe("en");
      expect(profile.json().personalDetails).toMatchObject({
        email: defaultIdentity.email,
        firstName: "Ada",
        lastName: "Lovelace",
        username: "adalovelace",
        phoneNumber: "9876543210",
      });
    });

    it("lets a Google-created Owner enter Business mode through Owner → Company → Business", async () => {
      const created = await postGoogle(app);
      expect(created.statusCode).toBe(201);
      const userId = created.json().user.id as string;
      const accessToken = created.json().accessToken as string;

      const venue = await ownerCompanyCreation({
        userId,
        business: {
          ...fakeBusinessRecord({ country: "USA" }),
          _id: new Types.ObjectId(),
        },
      });
      expect(venue.owner.userId.toString()).toBe(userId);
      expect(venue.company.ownerId.toString()).toBe(
        venue.owner._id.toString(),
      );
      expect(venue.business.companyId?.toString()).toBe(
        venue.company._id.toString(),
      );

      const setMode = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { mode: "business" },
      });
      expect(setMode.statusCode, setMode.body).toBe(200);
      expect(setMode.json().mode).toBe("business");
    });

    it("resolves a Google-created Employee membership and its management role gate", async () => {
      const created = await postGoogle(app);
      expect(created.statusCode).toBe(201);
      const userId = created.json().user.id as string;
      const accessToken = created.json().accessToken as string;

      const business = await createBusiness("google-created-employee");
      const employee = await createEmployee(
        business._id,
        new Types.ObjectId(userId),
        "Manager",
      );

      const me = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(me.statusCode).toBe(200);
      expect(me.json().user).toMatchObject({
        id: userId,
        employeeId: String(employee._id),
        businessId: String(business._id),
        canLogAsEmployee: true,
        role: "Manager",
      });

      const setMode = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { mode: "business" },
      });
      expect(setMode.statusCode, setMode.body).toBe(200);
      expect(setMode.json().mode).toBe("business");
    });

    it("applies the existing role and schedule gate to a Google-linked Employee", async () => {
      const existing = await User.create({
        languagePreference: "en",
        personalDetails: {
          email: defaultIdentity.email,
          password: await bcrypt.hash(password, 10),
          firstName: "Linked",
          lastName: "Waiter",
        },
      });
      const business = await createBusiness("google-linked-employee");
      const employee = await createEmployee(business._id, existing._id, "Waiter");

      const linked = await postGoogle(app);
      expect(linked.statusCode).toBe(200);
      expect(linked.json().user.id).toBe(String(existing._id));
      const accessToken = linked.json().accessToken as string;

      const before = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(before.statusCode).toBe(200);
      expect(before.json().user).toMatchObject({
        employeeId: String(employee._id),
        businessId: String(business._id),
        canLogAsEmployee: false,
        role: "Waiter",
      });

      const blocked = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { mode: "business" },
      });
      expect(blocked.statusCode).toBe(403);

      const now = new Date();
      await Schedule.create({
        businessId: business._id,
        date: now,
        weekNumber: 1,
        employeesSchedules: [
          {
            employeeId: employee._id,
            role: "Waiter",
            timeRange: {
              startTime: new Date(now.getTime() - 60 * 60 * 1000),
              endTime: new Date(now.getTime() + 60 * 60 * 1000),
            },
            shiftHours: 2,
            employeeCost: 30,
          },
        ],
      });

      const after = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(after.statusCode).toBe(200);
      expect(after.json().user.canLogAsEmployee).toBe(true);

      const allowed = await app.inject({
        method: "POST",
        url: "/api/v1/auth/set-mode",
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { mode: "business" },
      });
      expect(allowed.statusCode, allowed.body).toBe(200);
      expect(allowed.json().mode).toBe("business");
    });
  });
});
