/**
 * Users Routes Tests - Phase 1 Module 13 + Phase 4 Task 4.6
 *
 * Validation and error responses are asserted at the HTTP seam: failures are
 * RFC 9457 `application/problem+json` documents, never `{ message }`.
 * Phase 4: Full transaction tests for markNotificationAsDeleted (requires
 * replica set). Image upload tests require Cloudinary mocking.
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
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
  });

  describe("POST /api/v1/users", () => {
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

      for (const field of ["isAdmin", "refreshSessionVersion"]) {
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
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "other@test.com",
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

      const fetched = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user._id}`,
      });
      expect(JSON.parse(fetched.body).personalDetails.firstName).toBe(
        "Updated",
      );
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
