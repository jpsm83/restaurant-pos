/**
 * Users Routes Tests - Phase 1 Module 13 + Phase 4 Task 4.6
 *
 * Validation and error responses are asserted at the HTTP seam: failures are
 * RFC 9457 `application/problem+json` documents, never `{ message }`.
 * Phase 4: Full transaction tests for markNotificationAsDeleted (requires
 * replica set). Image upload tests require Cloudinary mocking.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";

const sendEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../src/auth/authEmailSend.ts", () => ({
  sendAuthTransactionalEmail: sendEmailMock,
}));

const deleteFolderCloudinaryMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(true),
);

vi.mock("../../src/cloudinary/deleteFolderCloudinary.ts", () => ({
  default: deleteFolderCloudinaryMock,
}));

import { Types } from "mongoose";
import bcrypt from "bcrypt";
import { getTestApp, generateTestToken } from "../setup.ts";
import User from "../../src/models/user.ts";
import Notification from "../../src/models/notification.ts";
import Business from "../../src/models/business.ts";
import { multipart } from "../helpers/multipart.ts";
import {
  detail,
  errorPaths,
  isProblemDetails,
} from "../helpers/problemDetails.ts";

describe("Users Routes", () => {
  beforeAll(() => {
    if (!process.env.APP_BASE_URL?.trim()) {
      process.env.APP_BASE_URL = "http://127.0.0.1:3000";
    }
  });

  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  const createValidUser = async (emailPrefix: string) => {
    return await User.create({
      personalDetails: {
        username: `${emailPrefix}user`,
        email: `${emailPrefix}@test.com`,
        password: "hashedpassword",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        idType: "National ID",
        idNumber: `ID-${emailPrefix}`,
        address: validAddress,
      },
    });
  };

  const validCreateFields = (overrides: Record<string, string> = {}) => ({
    username: "newuser",
    email: "newuser@test.com",
    password: "Password123!",
    idType: "National ID",
    idNumber: "ID-NEW-123",
    address: JSON.stringify(validAddress),
    firstName: "New",
    lastName: "User",
    nationality: "USA",
    gender: "Man",
    birthDate: "1990-01-01",
    phoneNumber: "9876543210",
    ...overrides,
  });

  describe("GET /api/v1/users", () => {
    it("lists all users", async () => {
      const app = await getTestApp();

      await createValidUser("listuser");

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it("returns a problem-details 404 when no users exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users",
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("No users found!");
    });

    it("excludes soft-deleted users by default and includes them when includeDeleted=true", async () => {
      const app = await getTestApp();

      await createValidUser("active-list-user");
      const deletedUser = await createValidUser("deleted-list-user");
      await User.updateOne(
        { _id: deletedUser._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const defaultList = await app.inject({
        method: "GET",
        url: "/api/v1/users",
      });
      expect(defaultList.statusCode).toBe(200);
      expect(defaultList.json().length).toBe(1);

      const includeDeleted = await app.inject({
        method: "GET",
        url: "/api/v1/users?includeDeleted=true",
      });
      expect(includeDeleted.statusCode).toBe(200);
      expect(includeDeleted.json().length).toBe(2);
    });

    it("returns a validation problem for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users?includeDeleted=maybe",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("includeDeleted");
    });
  });

  describe("POST /api/v1/users", () => {
    it("starts confirmation-gated reactivation for a soft-deleted sign-in email", async () => {
      const app = await getTestApp();
      sendEmailMock.mockClear();
      const existing = await createValidUser("reactivate-create");
      await User.updateOne(
        { _id: existing._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: multipart(
          validCreateFields({
            email: "reactivate-create@test.com",
            username: "someone-else",
            idNumber: "ID-OTHER-REACT",
          }),
        ),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json().message).toContain("reactivation");
      expect(sendEmailMock).toHaveBeenCalledTimes(1);

      const rows = await User.find({
        "personalDetails.email": "reactivate-create@test.com",
      })
        .setOptions({ includeDeleted: true })
        .lean();
      expect(rows).toHaveLength(1);
      expect(rows[0].deleted).toBe(true);
      expect(rows[0].verificationToken).toBeTruthy();
    });

    it("reactivates the soft-deleted user when a business shares the email and the username is taken", async () => {
      const app = await getTestApp();
      sendEmailMock.mockClear();
      const existing = await createValidUser("reactivate-shared");
      await User.updateOne(
        { _id: existing._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );
      await createValidUser("taken-name");
      const business = await Business.create({
        tradeName: "Shared Email Venue",
        legalName: "Shared Email Venue LLC",
        email: "reactivate-shared@test.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: `TAX-SHARED-${Date.now()}`,
        currencyTrade: "USD",
        address: validAddress,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: multipart(
          validCreateFields({
            email: "reactivate-shared@test.com",
            username: "taken-nameuser",
            idNumber: "ID-SHARED-REACT",
          }),
        ),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json().message).toContain("reactivation");

      const rows = await User.find({
        "personalDetails.email": "reactivate-shared@test.com",
      })
        .setOptions({ includeDeleted: true })
        .lean();
      expect(rows).toHaveLength(1);
      expect(rows[0].verificationToken).toBeTruthy();

      const venue = await Business.findById(business._id).lean();
      expect(venue?.verificationToken).toBeUndefined();
    });

    it("lets a new email reuse a username freed by a soft-deleted user", async () => {
      const app = await getTestApp();
      const existing = await createValidUser("freed-username");
      await User.updateOne(
        { _id: existing._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: multipart(
          validCreateFields({
            email: "fresh-person@test.com",
            username: "freed-usernameuser",
            idNumber: "ID-FRESH-PERSON",
          }),
        ),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(201);

      const rows = await User.find({})
        .setOptions({ includeDeleted: true })
        .select("personalDetails.email personalDetails.username deleted")
        .lean();
      const emails = rows.map((row) => row.personalDetails.email);
      expect(emails).toContain("freed-username@test.com");
      expect(emails).toContain("fresh-person@test.com");
    });

    it("creates a user and normalizes the email", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: multipart(
          validCreateFields({ email: "New.User@Example.com" }),
        ),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode, response.body).toBe(201);

      const list = await app.inject({ method: "GET", url: "/api/v1/users" });
      const created = JSON.parse(list.body).find(
        (u: { personalDetails: { username: string } }) =>
          u.personalDetails.username === "newuser",
      );
      expect(created.personalDetails.email).toBe("new.user@example.com");
    });

    it("returns a validation problem for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: multipart({ username: "testuser" }),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode, response.body).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toEqual(
        expect.arrayContaining(["email", "password"]),
      );
    });

    it("returns a validation problem for an invalid address", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: multipart(
          validCreateFields({ address: JSON.stringify({ country: "USA" }) }),
        ),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode, response.body).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("address.state");
    });

    it("returns a validation problem when the password fails the policy", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: multipart(validCreateFields({ password: "weak" })),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode, response.body).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("password");
    });

    it("rejects unknown and server-owned fields", async () => {
      const app = await getTestApp();

      for (const field of ["isAdmin", "refreshSessionVersion", "sessionId"]) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/users",
          payload: multipart(validCreateFields({ [field]: "1" })),
          headers: { "content-type": "multipart/form-data" },
        });

        expect(response.statusCode, `${field}: ${response.body}`).toBe(400);
        expect(isProblemDetails(response)).toBe(true);
      }
    });

    it("returns a problem-details 409 for duplicate user", async () => {
      const app = await getTestApp();

      await createValidUser("duplicate");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: multipart(
          validCreateFields({
            username: "duplicateuser",
            email: "duplicate@test.com",
            idNumber: "ID-duplicate",
          }),
        ),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toContain("already exists");
    });
  });

  describe("GET /api/v1/users/:userId", () => {
    it("gets user by ID", async () => {
      const app = await getTestApp();

      const user = await createValidUser("getbyid");

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(user._id.toString());
    });

    it("returns a validation problem for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("userId");
    });

    it("returns 404 for non-existent user", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${fakeId}`,
      });

      expect(response.statusCode, response.body).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("User not found!");
    });
  });

  describe("PATCH /api/v1/users/:userId", () => {
    it("returns a validation problem for an invalid userId", async () => {
      const app = await getTestApp();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "any@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/invalid-id",
        payload: multipart(validCreateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: auth,
        },
      });

      expect(response.statusCode, response.body).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("userId");
    });

    it("returns a validation problem for missing required fields", async () => {
      const app = await getTestApp();

      const user = await createValidUser("patchuser");
      const auth = await generateTestToken({
        id: user._id.toString(),
        email: "patchuser@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart({ username: "updated" }),
        headers: {
          "content-type": "multipart/form-data",
          authorization: auth,
        },
      });

      expect(response.statusCode, response.body).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("email");
    });

    it("returns 404 for non-existent user when JWT matches URL id", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();
      const auth = await generateTestToken({
        id: fakeId.toString(),
        email: "ghost@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${fakeId}`,
        payload: multipart(validCreateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: auth,
        },
      });

      expect(response.statusCode, response.body).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("User not found!");
    });

    it("returns 401 when PATCH user without auth", async () => {
      const app = await getTestApp();
      const user = await createValidUser("noauthpatch");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart(validCreateFields()),
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Authentication required");
    });

    it("returns 403 when JWT does not match the URL id", async () => {
      const app = await getTestApp();
      const user = await createValidUser("forbiddenpatch");
      const otherUser = await createValidUser("forbiddenpatchother");
      const auth = await generateTestToken({
        id: otherUser._id.toString(),
        email: "forbiddenpatchother@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart(validCreateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: auth,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(isProblemDetails(response)).toBe(true);
    });

    it("returns 401 when token user is soft-deleted", async () => {
      const app = await getTestApp();
      const user = await createValidUser("deletedtokenpatch");
      const auth = await generateTestToken({
        id: user._id.toString(),
        email: "deletedtokenpatch@test.com",
        type: "user",
        role: "Customer",
      });
      await User.updateOne(
        { _id: user._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart(validCreateFields()),
        headers: {
          "content-type": "multipart/form-data",
          authorization: auth,
        },
      });

      expect(response.statusCode, response.body).toBe(401);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Authentication required");
    });

    it("updates the user and returns a session", async () => {
      const app = await getTestApp();

      const user = await createValidUser("updateself");
      const auth = await generateTestToken({
        id: user._id.toString(),
        email: "updateself@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart(
          validCreateFields({
            username: "updateselfuser",
            email: "updateself@test.com",
            idNumber: "ID-updateself",
            firstName: "Updated",
          }),
        ),
        headers: {
          "content-type": "multipart/form-data",
          authorization: auth,
        },
      });

      expect(response.statusCode, response.body).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accessToken).toBeTruthy();
      expect(body.user.sessionId).toBeUndefined();

      const refreshCookie = response.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(refreshCookie?.value).toBeTruthy();
      expect(response.body).not.toContain(refreshCookie!.value);
      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${refreshCookie!.value}` },
      });
      expect(refreshRes.statusCode).toBe(200);
      expect(refreshRes.json().user.type).toBe("user");
      expect(refreshRes.json().user.sessionId).toBeUndefined();

      const fetched = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user._id}`,
      });
      expect(JSON.parse(fetched.body).personalDetails.firstName).toBe(
        "Updated",
      );
    });

    it("issues a refresh session at the current generation when the password stays", async () => {
      const app = await getTestApp();
      const email = "keep-password@test.com";
      const password = "TestPassword123!";
      const user = await User.create({
        personalDetails: {
          username: "keeppassworduser",
          email,
          password: await bcrypt.hash(password, 10),
          firstName: "Pat",
          lastName: "Lee",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: "ID-keep-password",
          address: validAddress,
        },
      });

      const signIn = async () => {
        const loginRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email, password },
        });
        expect(loginRes.statusCode).toBe(200);
        return {
          accessToken: loginRes.json().accessToken as string,
          refreshCookie: loginRes.cookies.find(
            (cookie) => cookie.name === "refresh_token",
          )!.value,
        };
      };

      const first = await signIn();
      const second = await signIn();
      const profile = validCreateFields({
        username: "keeppassworduser",
        email,
        idNumber: "ID-keep-password",
        firstName: "Pat",
        phoneNumber: "1234567890",
        password: "",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart(profile),
        headers: {
          "content-type": "multipart/form-data",
          authorization: `Bearer ${first.accessToken}`,
        },
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().user.sessionId).toBeUndefined();
      const issued = response.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(issued?.value).toBeTruthy();
      const stored = await User.findById(user._id)
        .select("refreshSessionVersion")
        .lean();
      expect(stored?.refreshSessionVersion ?? 0).toBe(0);

      for (const cookie of [first.refreshCookie, second.refreshCookie, issued!.value]) {
        const refreshRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/refresh",
          headers: { cookie: `refresh_token=${cookie}` },
        });
        expect(refreshRes.statusCode).toBe(200);
      }
    });

    it("moves the generation on a password change and issues a session at the new generation", async () => {
      const app = await getTestApp();
      const email = "change-password@test.com";
      const password = "TestPassword123!";
      const user = await User.create({
        personalDetails: {
          username: "changepassworduser",
          email,
          password: await bcrypt.hash(password, 10),
          firstName: "Pat",
          lastName: "Lee",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: "ID-change-password",
          address: validAddress,
        },
      });

      const signIn = async () => {
        const loginRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email, password },
        });
        expect(loginRes.statusCode).toBe(200);
        return loginRes.cookies.find(
          (cookie) => cookie.name === "refresh_token",
        )!.value;
      };

      const firstCookie = await signIn();
      const secondCookie = await signIn();
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password },
      });
      const accessToken = loginRes.json().accessToken as string;

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: multipart(
          validCreateFields({
            username: "changepassworduser",
            email,
            idNumber: "ID-change-password",
            firstName: "Pat",
            phoneNumber: "1234567890",
            password: "NewPassword456!",
          }),
        ),
        headers: {
          "content-type": "multipart/form-data",
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().user.sessionId).toBeUndefined();
      const issued = response.cookies.find(
        (cookie) => cookie.name === "refresh_token",
      );
      expect(issued?.value).toBeTruthy();
      const stored = await User.findById(user._id)
        .select("refreshSessionVersion")
        .lean();
      expect(stored?.refreshSessionVersion).toBe(1);

      for (const cookie of [firstCookie, secondCookie]) {
        const refused = await app.inject({
          method: "POST",
          url: "/api/v1/auth/refresh",
          headers: { cookie: `refresh_token=${cookie}` },
        });
        expect(refused.statusCode).toBe(401);
        expect(refused.headers["content-type"]).toContain(
          "application/problem+json",
        );
        expect(refused.json().detail).toBe("Invalid or expired refresh token");
      }

      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${issued!.value}` },
      });
      expect(refreshRes.statusCode).toBe(200);
      expect(refreshRes.json().user.sessionId).toBeUndefined();
    });
  });

  describe("DELETE /api/v1/users/:userId", () => {
    it("returns a validation problem for an invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/users/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("userId");
    });

    it("returns 404 for non-existent user", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("User not found!");
    });

    it("soft-deletes a user and keeps the record for includeDeleted reads", async () => {
      const app = await getTestApp();
      deleteFolderCloudinaryMock.mockClear();
      const user = await createValidUser("softdelete-user");

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${user._id}`,
      });
      expect(response.statusCode, response.body).toBe(200);

      const persisted = await User.findById(user._id)
        .setOptions({ includeDeleted: true })
        .select("deleted deletedAt")
        .lean();
      expect(persisted).toBeTruthy();
      expect(persisted?.deleted).toBe(true);
      expect(persisted?.deletedAt).toBeInstanceOf(Date);

      const hiddenByDefault = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user._id}`,
      });
      expect(hiddenByDefault.statusCode).toBe(404);

      const visibleWhenIncluded = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user._id}?includeDeleted=true`,
      });
      expect(visibleWhenIncluded.statusCode).toBe(200);
      expect(visibleWhenIncluded.json().deleted).toBe(true);
      expect(deleteFolderCloudinaryMock).not.toHaveBeenCalled();
    });

    it("records the signed-in account that deleted the user", async () => {
      const app = await getTestApp();
      const actor = await createValidUser("delete-actor");
      const target = await createValidUser("delete-target");
      const auth = await generateTestToken({
        id: String(actor._id),
        email: actor.personalDetails.email,
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${target._id}`,
        headers: { authorization: auth },
      });
      expect(response.statusCode, response.body).toBe(200);

      const persisted = await User.findById(target._id)
        .setOptions({ includeDeleted: true })
        .select("deleted deletedBy")
        .lean();
      expect(persisted?.deleted).toBe(true);
      expect(String(persisted?.deletedBy)).toBe(String(actor._id));
    });
  });

  describe("PATCH /api/v1/users/:userId/markNotificationAsDeleted", () => {
    it("returns a validation problem for an invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/invalid-id/markNotificationAsDeleted",
        payload: { notificationId: new Types.ObjectId().toString() },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("userId");
    });

    it("returns a validation problem for an invalid notificationId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${new Types.ObjectId()}/markNotificationAsDeleted`,
        payload: { notificationId: "invalid" },
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toContain("notificationId");
    });

    it("returns 404 for non-existent notification", async () => {
      const app = await getTestApp();

      const user = await createValidUser("notifuser");
      const fakeNotificationId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}/markNotificationAsDeleted`,
        payload: { notificationId: fakeNotificationId.toString() },
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Notification not found!");
    });
  });

  describe("PATCH /api/v1/users/:userId/updateReadFlag/:notificationId", () => {
    it("returns a validation problem for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/invalid-id/updateReadFlag/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      expect(isProblemDetails(response)).toBe(true);
      expect(errorPaths(response)).toEqual(
        expect.arrayContaining(["userId", "notificationId"]),
      );
    });

    it("returns 404 for non-existent notification", async () => {
      const app = await getTestApp();

      const user = await createValidUser("readflaguser");
      const fakeNotificationId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}/updateReadFlag/${fakeNotificationId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(isProblemDetails(response)).toBe(true);
      expect(detail(response)).toBe("Notification not found!");
    });

    it("marks user notification as read", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Read Flag Business",
        legalName: "Read Flag Business LLC",
        email: "read-flag-business@test.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: `READ-FLAG-${Date.now()}`,
        currencyTrade: "USD",
        address: validAddress,
      });

      const notification = await Notification.create({
        message: "Read me",
        notificationType: "Info",
        businessId: business._id,
      });

      const user = await User.create({
        notifications: [
          {
            notificationId: notification._id,
            readFlag: false,
            deletedFlag: false,
          },
        ],
        personalDetails: {
          username: "readflagmarkuser",
          email: "readflagmarkuser@test.com",
          password: "hashedpassword",
          firstName: "Read",
          lastName: "Flag",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: `ID-readflag-${Date.now()}`,
          address: validAddress,
        },
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}/updateReadFlag/${notification._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("updated");

      const updatedUser = await User.findById(user._id).lean();
      const updatedUserNotification = updatedUser?.notifications?.find(
        (n: { notificationId?: Types.ObjectId }) =>
          n.notificationId?.toString() === notification._id.toString(),
      );
      expect(updatedUserNotification?.readFlag).toBe(true);
      expect(updatedUserNotification?.deletedFlag).toBe(false);
    });
  });

  // Phase 4 Task 4.6: Transaction Tests for markNotificationAsDeleted
  describe("Transaction Tests - PATCH /api/v1/users/:userId/markNotificationAsDeleted", () => {
    it("marks notification as deleted and sets readFlag", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Test Business",
        legalName: "Test Business LLC",
        email: "business@test.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const notification = await Notification.create({
        message: "This is a test notification",
        notificationType: "Info",
        businessId: business._id,
      });

      const user = await User.create({
        notifications: [
          {
            notificationId: notification._id,
            readFlag: false,
            deletedFlag: false,
          },
        ],
        personalDetails: {
          username: "markdeleteuser",
          email: "markdelete@test.com",
          password: "hashedpassword",
          firstName: "Mark",
          lastName: "Delete",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: "ID-markdelete",
          address: validAddress,
        },
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}/markNotificationAsDeleted`,
        payload: { notificationId: notification._id.toString() },
      });

      expect(response.statusCode, response.body).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("deleted");

      const updatedUser = await User.findById(user._id).lean();
      const userNotification = updatedUser?.notifications?.find(
        (n: { notificationId?: Types.ObjectId }) =>
          n.notificationId?.toString() === notification._id.toString(),
      );
      expect(userNotification?.deletedFlag).toBe(true);
      expect(userNotification?.readFlag).toBe(true);
    });
  });
});
