/**
 * Users Routes Tests - Phase 1 Module 13 + Phase 4 Task 4.6
 * Tests for users CRUD endpoints with transaction verification
 * Phase 4: Full transaction tests for markNotificationAsDeleted (requires replica set)
 * Note: Image upload tests require Cloudinary mocking
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import User from "../../src/models/user.ts";
import Notification from "../../src/models/notification.ts";
import Business from "../../src/models/business.ts";

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
      username: `${emailPrefix}user`,
      email: `${emailPrefix}@test.com`,
      password: "hashedpassword",
      allUserRoles: ["employee"],
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

    it("returns 404 when no users exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No users found");
    });
  });

  describe("POST /api/v1/users", () => {
    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("username", "testuser");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode, response.body).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 400 for invalid address", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("username", "newuser");
      form.append("email", "newuser@test.com");
      form.append("password", "password123");
      form.append("idType", "National ID");
      form.append("idNumber", "NEW-123");
      form.append("address", JSON.stringify({ country: "USA" }));
      form.append("firstName", "New");
      form.append("lastName", "User");
      form.append("nationality", "USA");
      form.append("gender", "Man");
      form.append("birthDate", "1990-01-01");
      form.append("phoneNumber", "9876543210");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode, response.body).toBe(400);
    });

    it("returns 409 for duplicate user", async () => {
      const app = await getTestApp();

      await createValidUser("duplicate");

      const form = new FormData();
      form.append("username", "duplicateuser");
      form.append("email", "duplicate@test.com");
      form.append("password", "password123");
      form.append("idType", "National ID");
      form.append("idNumber", "ID-duplicate");
      form.append("address", JSON.stringify(validAddress));
      form.append("firstName", "Dup");
      form.append("lastName", "User");
      form.append("nationality", "USA");
      form.append("gender", "Man");
      form.append("birthDate", "1990-01-01");
      form.append("phoneNumber", "9876543210");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode, response.body).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("already exists");
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

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid user ID!");
    });

    it("returns 404 for non-existent user", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${fakeId}`,
      });

      expect(response.statusCode, response.body).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("User not found!");
    });
  });

  describe("PATCH /api/v1/users/:userId", () => {
    it("returns 400 for invalid userId", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("username", "updated");

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/invalid-id",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("User ID is not valid!");
    });

    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const user = await createValidUser("patchuser");

      const form = new FormData();
      form.append("username", "updated");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}`,
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 404 for non-existent user", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const form = new FormData();
      form.append("username", "updated");
      form.append("email", "updated@test.com");
      form.append("idType", "National ID");
      form.append("idNumber", "UPD-123");
      form.append("address", JSON.stringify(validAddress));
      form.append("firstName", "Updated");
      form.append("lastName", "User");
      form.append("nationality", "USA");
      form.append("gender", "Man");
      form.append("birthDate", "1990-01-01");
      form.append("phoneNumber", "9876543210");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${fakeId}`,
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode, response.body).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("User not found!");
    });
  });

  describe("DELETE /api/v1/users/:userId", () => {
    it("returns 400 for invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/users/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid user ID!");
    });

    it("returns 404 for non-existent user", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("User not found!");
    });
  });

  describe("PATCH /api/v1/users/:userId/markNotificationAsDeleted", () => {
    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/invalid-id/markNotificationAsDeleted",
        payload: { notificationId: "invalid" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("User or notification ID is not valid!");
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
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Notification not found!");
    });
  });

  describe("PATCH /api/v1/users/:userId/updateReadFlag/:notificationId", () => {
    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/users/invalid-id/updateReadFlag/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("User or notification ID is not valid!");
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
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Notification not found!");
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
        username: "readflagmarkuser",
        email: "readflagmarkuser@test.com",
        password: "hashedpassword",
        allUserRoles: ["employee"],
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
          n.notificationId?.toString() === notification._id.toString()
      );
      expect(updatedUserNotification?.readFlag).toBe(true);
      expect(updatedUserNotification?.deletedFlag).toBe(false);
    });
  });

  // Phase 4 Task 4.6: Transaction Tests for markNotificationAsDeleted
  describe("Transaction Tests - PATCH /api/v1/users/:userId/markNotificationAsDeleted", () => {
    it("marks notification as deleted and sets readFlag", async () => {
      const app = await getTestApp();

      // Create a business for the notification
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

      // Create a notification
      const notification = await Notification.create({
        message: "This is a test notification",
        notificationType: "Info",
        businessId: business._id,
      });

      // Create a user with the notification in their notifications array
      const user = await User.create({
        username: "markdeleteuser",
        email: "markdelete@test.com",
        password: "hashedpassword",
        allUserRoles: ["employee"],
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

      // Mark notification as deleted
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/users/${user._id}/markNotificationAsDeleted`,
        payload: { notificationId: notification._id.toString() },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("deleted");

      // Verify notification was marked as deleted
      const updatedUser = await User.findById(user._id).lean();
      const userNotification = updatedUser?.notifications?.find(
        (n: { notificationId?: Types.ObjectId }) =>
          n.notificationId?.toString() === notification._id.toString()
      );
      expect(userNotification?.deletedFlag).toBe(true);
      expect(userNotification?.readFlag).toBe(true);
    });
  });
});
