/**
 * Soft-deleted sign-in identity.
 *
 * Sign-up with a deleted User's email keeps that User and sends a confirmation
 * link. Confirming the link clears the marker. Password reset and a closed
 * Business email do not restore an account.
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

import {
  emailRailSuccess,
  expectOneAccountSend,
} from "../helpers/accountEmailRail.ts";
import { getTestApp, resetTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import Business from "../../src/models/business.ts";
import { CONFIRM_EMAIL_SUCCESS_MESSAGE } from "../../src/auth/confirmEmail.ts";
import {
  GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
  REACTIVATION_REQUIRED_MESSAGE,
} from "../../src/auth/requestEmailConfirmation.ts";

const originalPassword = "OriginalPassword123!";
const signupPassword = "SignupPassword123!";

const address = {
  country: "USA",
  state: "CA",
  city: "LA",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

async function createUser(email: string) {
  const password = await bcrypt.hash(originalPassword, 10);
  return User.create({
    personalDetails: {
      username: "same-user",
      email,
      password,
      firstName: "Same",
      lastName: "User",
      phoneNumber: "1234567890",
      birthDate: new Date("1990-01-01"),
      gender: "Other",
      nationality: "USA",
      idType: "Passport",
      idNumber: `ID-${email}`,
      address,
    },
  });
}

async function createBusiness(email: string, taxNumber: string) {
  const password = await bcrypt.hash(originalPassword, 10);
  return Business.create({
    tradeName: "Shared Office",
    legalName: "Shared Office LLC",
    email,
    password,
    phoneNumber: "1234567890",
    taxNumber,
    currencyTrade: "USD",
    address,
  });
}

describe("soft-deleted sign-in reactivation", () => {
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

  it("creates one user when the email is unused and refuses an active user's email", async () => {
    const app = await getTestApp();
    const email = `fresh-${Date.now()}@example.com`;

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: signupPassword,
        firstName: "Pat",
        lastName: "Lee",
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.headers["content-type"]).toContain("application/json");
    const createdBody = created.json();
    expect(createdBody.user.email).toBe(email);
    expect(createdBody.user.type).toBe("user");
    expect(createdBody.user.emailVerified).toBe(false);

    const rows = await User.find({ "personalDetails.email": email })
      .setOptions({ includeDeleted: true })
      .select("_id deleted")
      .lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deleted).not.toBe(true);
    expect(String(rows[0]?._id)).toBe(createdBody.user.id);

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: { email, password: signupPassword },
    });

    expect(duplicate.statusCode).toBe(202);
    expect(duplicate.headers["content-type"]).toContain("application/json");
    expect(duplicate.json().message).not.toContain("already exists");
    expect(duplicate.json().accessToken).toBeUndefined();
    const accountExistsCall = sendEmailMock.mock.calls.find(
      ([payload]) =>
        (payload as { subject?: string }).subject ===
        "You Already Have a POS Account",
    );
    expect(accountExistsCall?.[0]).toMatchObject({
      to: email,
      subject: "You Already Have a POS Account",
    });

    const afterDuplicate = await User.find({ "personalDetails.email": email })
      .setOptions({ includeDeleted: true })
      .select("_id")
      .lean();
    expect(afterDuplicate).toHaveLength(1);
  });

  it("reactivates the same soft-deleted user only after the confirmation link", async () => {
    const app = await getTestApp();
    const email = `reactivate-${Date.now()}@example.com`;
    const user = await createUser(email);
    const deletedBy = new Types.ObjectId();

    await User.updateOne(
      { _id: user._id },
      { $set: { deleted: true, deletedAt: new Date("2026-01-02T00:00:00.000Z"), deletedBy } },
    );

    const before = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: originalPassword },
    });
    expect(before.statusCode).toBe(401);
    expect(before.headers["content-type"]).toContain("application/problem+json");
    expect(before.json().detail).toBe("Invalid credentials");

    const signup = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: signupPassword,
        firstName: "Other",
        lastName: "Person",
      },
    });

    expect(signup.statusCode).toBe(202);
    expect(signup.headers["content-type"]).toContain("application/json");
    expect(signup.json()).toEqual({ message: REACTIVATION_REQUIRED_MESSAGE });

    const pending = await User.find({ "personalDetails.email": email })
      .setOptions({ includeDeleted: true })
      .select("deleted deletedAt deletedBy verificationToken personalDetails.firstName")
      .lean();
    expect(pending).toHaveLength(1);
    expect(String(pending[0]?._id)).toBe(String(user._id));
    expect(pending[0]?.deleted).toBe(true);
    expect(pending[0]?.deletedAt).toBeInstanceOf(Date);
    expect(String(pending[0]?.deletedBy)).toBe(String(deletedBy));
    expect(pending[0]?.personalDetails?.firstName).toBe("Same");
    const token = pending[0]?.verificationToken;
    expect(typeof token).toBe("string");
    expectOneAccountSend(sendEmailMock, {
      to: email,
      subject: "Confirm Your Email - POS",
      link: `/confirm-email?token=${token}`,
    });

    const stillDeleted = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: originalPassword },
    });
    expect(stillDeleted.statusCode).toBe(401);
    expect(stillDeleted.headers["content-type"]).toContain("application/problem+json");
    expect(stillDeleted.json().detail).toBe("Invalid credentials");

    const confirmed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.headers["content-type"]).toContain("application/json");
    expect(confirmed.json()).toEqual({ message: CONFIRM_EMAIL_SUCCESS_MESSAGE });

    const restored = await User.findById(user._id)
      .setOptions({ includeDeleted: true })
      .select("deleted deletedAt deletedBy personalDetails.emailVerified")
      .lean();
    expect(restored?.deleted).toBe(false);
    expect(restored?.deletedAt).toBeUndefined();
    expect(restored?.deletedBy).toBeUndefined();
    expect(restored?.personalDetails?.emailVerified).toBe(true);
    expect(restored).not.toHaveProperty("emailVerified");

    const after = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: originalPassword },
    });
    expect(after.statusCode).toBe(200);
    expect(after.headers["content-type"]).toContain("application/json");
    expect(after.json().user.id).toBe(String(user._id));
    expect(after.json().user.email).toBe(email);
    expect(after.json().user.emailVerified).toBe(true);
  });

  it("does not restore a soft-deleted user when a password reset is requested", async () => {
    const app = await getTestApp();
    const email = `reset-request-${Date.now()}@example.com`;
    const user = await createUser(email);
    const deletedBy = new Types.ObjectId();
    await User.updateOne(
      { _id: user._id },
      { $set: { deleted: true, deletedAt: new Date("2026-01-02T00:00:00.000Z"), deletedBy } },
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/request-password-reset",
      payload: { email },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual({
      message: GENERIC_REQUEST_EMAIL_CONFIRMATION_MESSAGE,
    });
    expect(sendEmailMock).not.toHaveBeenCalled();

    const stored = await User.findById(user._id)
      .setOptions({ includeDeleted: true })
      .select("deleted deletedAt deletedBy resetPasswordToken")
      .lean();
    expect(stored?.deleted).toBe(true);
    expect(stored?.deletedAt).toBeInstanceOf(Date);
    expect(String(stored?.deletedBy)).toBe(String(deletedBy));
    expect(stored?.resetPasswordToken).toBeUndefined();

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: originalPassword },
    });
    expect(login.statusCode).toBe(401);
    expect(login.headers["content-type"]).toContain("application/problem+json");
    expect(login.json().detail).toBe("Invalid credentials");
  });

  it("does not restore a soft-deleted user when a reset link was issued before deletion", async () => {
    const app = await getTestApp();
    const email = `reset-link-${Date.now()}@example.com`;
    const user = await createUser(email);
    const deletedBy = new Types.ObjectId();
    const resetToken = "reset-token-issued-before-deletion";

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
    );
    await User.updateOne(
      { _id: user._id },
      { $set: { deleted: true, deletedAt: new Date("2026-01-02T00:00:00.000Z"), deletedBy } },
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: resetToken, newPassword: "Replacement123!" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json().detail).toBe(
      "This link is invalid or has expired. Please request a new one.",
    );

    const stored = await User.findById(user._id)
      .setOptions({ includeDeleted: true })
      .select("deleted deletedAt deletedBy personalDetails.password")
      .lean();
    expect(stored?.deleted).toBe(true);
    expect(stored?.deletedAt).toBeInstanceOf(Date);
    expect(String(stored?.deletedBy)).toBe(String(deletedBy));
    expect(
      await bcrypt.compare(originalPassword, stored?.personalDetails?.password ?? ""),
    ).toBe(true);
    expect(
      await bcrypt.compare("Replacement123!", stored?.personalDetails?.password ?? ""),
    ).toBe(false);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "Replacement123!" },
    });
    expect(login.statusCode).toBe(401);
    expect(login.headers["content-type"]).toContain("application/problem+json");
    expect(login.json().detail).toBe("Invalid credentials");

    const originalLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: originalPassword },
    });
    expect(originalLogin.statusCode).toBe(401);
    expect(originalLogin.headers["content-type"]).toContain("application/problem+json");
    expect(originalLogin.json().detail).toBe("Invalid credentials");
  });

  it("keeps a business email non-unique and does not reactivate a closed business by reusing it", async () => {
    const app = await getTestApp();
    const email = `office-${Date.now()}@example.com`;
    const first = await createBusiness(email, `TAX-A-${Date.now()}`);
    const second = await createBusiness(email, `TAX-B-${Date.now()}`);
    expect(String(first._id)).not.toBe(String(second._id));

    await Business.updateOne(
      { _id: second._id },
      {
        $set: {
          deleted: true,
          deletedAt: new Date("2026-01-02T00:00:00.000Z"),
          deletedBy: second._id,
        },
      },
    );

    const signup = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: { email, password: signupPassword },
    });

    expect(signup.statusCode).toBe(202);
    expect(signup.headers["content-type"]).toContain("application/json");
    expect(signup.json().message).not.toContain("already exists");
    expect(signup.json().accessToken).toBeUndefined();

    const closed = await Business.findById(second._id)
      .setOptions({ includeDeleted: true })
      .select("deleted deletedAt deletedBy")
      .lean();
    expect(closed?.deleted).toBe(true);
    expect(closed?.deletedAt).toBeInstanceOf(Date);
    expect(String(closed?.deletedBy)).toBe(String(second._id));

    const open = await Business.findById(first._id).select("deleted").lean();
    expect(open?.deleted).not.toBe(true);

    const users = await User.find({ "personalDetails.email": email })
      .setOptions({ includeDeleted: true })
      .select("_id")
      .lean();
    expect(users).toHaveLength(0);

    await Business.updateOne(
      { _id: first._id },
      { $set: { deleted: true, deletedAt: new Date("2026-01-03T00:00:00.000Z") } },
    );

    const reuse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: { email, password: signupPassword, firstName: "Pat", lastName: "Lee" },
    });
    expect(reuse.statusCode).toBe(201);
    expect(reuse.headers["content-type"]).toContain("application/json");
    expect(reuse.json().user.type).toBe("user");

    const venues = await Business.find({ email })
      .setOptions({ includeDeleted: true })
      .select("deleted")
      .lean();
    expect(venues).toHaveLength(2);
    expect(venues.every((venue) => venue.deleted === true)).toBe(true);
  });

  it("does not restore a closed business from a confirmation or reset link issued before closure", async () => {
    const app = await getTestApp();
    const email = `closed-link-${Date.now()}@example.com`;
    const business = await createBusiness(email, `TAX-CLOSED-${Date.now()}`);
    const deletedBy = new Types.ObjectId();
    const confirmationToken = "confirm-token-issued-before-closure";
    const resetToken = "reset-token-issued-before-closure";

    await Business.updateOne(
      { _id: business._id },
      {
        $set: {
          verificationToken: confirmationToken,
          resetPasswordToken: resetToken,
          resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
          deleted: true,
          deletedAt: new Date("2026-01-02T00:00:00.000Z"),
          deletedBy,
        },
      },
    );

    const confirmed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/confirm-email",
      payload: { token: confirmationToken },
    });
    expect(confirmed.statusCode).toBe(400);
    expect(confirmed.headers["content-type"]).toContain("application/problem+json");
    expect(confirmed.json().detail).toBe(
      "This link is invalid or has expired. Please request a new one.",
    );

    const reset = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: { token: resetToken, newPassword: "Replacement123!" },
    });
    expect(reset.statusCode).toBe(400);
    expect(reset.headers["content-type"]).toContain("application/problem+json");
    expect(reset.json().detail).toBe(
      "This link is invalid or has expired. Please request a new one.",
    );

    const stored = await Business.findById(business._id)
      .setOptions({ includeDeleted: true })
      .select("deleted deletedAt deletedBy")
      .lean();
    expect(stored?.deleted).toBe(true);
    expect(stored?.deletedAt).toBeInstanceOf(Date);
    expect(String(stored?.deletedBy)).toBe(String(deletedBy));

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: originalPassword },
    });
    expect(login.statusCode).toBe(401);
    expect(login.headers["content-type"]).toContain("application/problem+json");
    expect(login.json().detail).toBe("Invalid credentials");
  });
});
