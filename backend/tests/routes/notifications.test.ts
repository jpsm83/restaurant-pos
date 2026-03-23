/**
 * Notifications Routes Tests - Phase 1 Module 20 + Phase 4 Task 4.8
 * Tests for notifications CRUD endpoints
 * Includes transaction tests for POST/PATCH/DELETE with recipient sync
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import Notification from "../../src/models/notification.ts";
import Business from "../../src/models/business.ts";
import Employee from "../../src/models/employee.ts";
import User from "../../src/models/user.ts";

describe("Notifications Routes", () => {
  const createTestBusiness = async () => {
    return await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: `test${Date.now()}@restaurant.com`,
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: `TAX-${Date.now()}`,
      currencyTrade: "USD",
      subscription: "Free",
      address: {
        country: "USA",
        state: "CA",
        city: "Los Angeles",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
    });
  };

  const createTestNotification = async (businessId: Types.ObjectId) => {
    const employeeId = new Types.ObjectId();
    return await Notification.create({
      businessId,
      notificationType: "Info",
      message: "Test notification message",
      employeesRecipientsIds: [employeeId],
    });
  };

  describe("GET /api/v1/notifications", () => {
    it("lists all notifications", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestNotification(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 404 when no notifications exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No notifications");
    });
  });

  describe("POST /api/v1/notifications", () => {
    it("returns 400 for missing recipients", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications",
        payload: {
          notificationType: "General",
          message: "Test message",
          businessId: business._id,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("RecipientsIds");
    });

    it("returns 400 for both employee and customer recipients", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications",
        payload: {
          notificationType: "General",
          message: "Test message",
          businessId: business._id,
          employeesRecipientsIds: [new Types.ObjectId()],
          customersRecipientsIds: [new Types.ObjectId()],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("RecipientsIds");
    });

    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications",
        payload: {
          employeesRecipientsIds: [new Types.ObjectId()],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 400 for empty recipients array", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications",
        payload: {
          notificationType: "General",
          message: "Test message",
          businessId: business._id,
          employeesRecipientsIds: [],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("array");
    });

    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications",
        payload: {
          notificationType: "General",
          message: "Test message",
          businessId: "invalid-id",
          employeesRecipientsIds: ["invalid-id"],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid");
    });
  });

  describe("GET /api/v1/notifications/:notificationId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid notification ID");
    });

    it("returns 404 for non-existent notification", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/notifications/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Notification not found");
    });

    it("gets notification by ID", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const notification = await createTestNotification(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/notifications/${notification._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(notification._id.toString());
    });
  });

  describe("PATCH /api/v1/notifications/:notificationId", () => {
    it("returns 400 for missing recipients", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/notifications/${fakeId}`,
        payload: {
          message: "Updated message",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("RecipientsIds");
    });

    it("returns 400 for empty recipients array", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/notifications/${fakeId}`,
        payload: {
          employeesRecipientsIds: [],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("array");
    });

    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/notifications/invalid-id",
        payload: {
          employeesRecipientsIds: ["invalid-id"],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid");
    });
  });

  describe("DELETE /api/v1/notifications/:notificationId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/notifications/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid notification ID!");
    });
  });

  describe("GET /api/v1/notifications/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid business ID!");
    });

    it("returns 404 when no notifications for business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/notifications/business/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No notifications");
    });

    it("lists notifications by business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestNotification(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/notifications/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/v1/notifications/user/:userId", () => {
    it("returns 400 for invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications/user/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid user ID!");
    });

    it("returns 404 when no notifications for user", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/notifications/user/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No notifications");
    });
  });

  // Phase 4 Task 4.8: Transaction Tests
  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  const createTestUser = async (emailPrefix: string) => {
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

  describe("Transaction Tests - POST /api/v1/notifications", () => {
    it("creates notification and updates employee recipients", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      // Create a user first
      const user = await createTestUser(`notif-${Date.now()}`);

      // Create employee linked to user
      const employee = await Employee.create({
        businessId: business._id,
        userId: user._id,
        taxNumber: `EMP-NOTIF-${Date.now()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Waiter"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications",
        payload: {
          notificationType: "Info",
          message: "Test notification for transaction test",
          businessId: business._id.toString(),
          employeesRecipientsIds: [employee._id.toString()],
        },
      });

      expect(response.statusCode, response.body).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created");

      // Verify notification was created
      const notification = await Notification.findOne({
        businessId: business._id,
        message: "Test notification for transaction test",
      }).lean();
      expect(notification).not.toBeNull();

      // Verify user's notifications inbox was updated (employee inbox state is centralized on User)
      const updatedUser = await User.findById(user._id).lean();
      expect(updatedUser?.notifications).toBeDefined();
      expect(updatedUser?.notifications?.length).toBe(1);
      expect(updatedUser?.notifications?.[0].notificationId.toString()).toBe(
        notification?._id.toString()
      );
    });

    it("creates notification and updates customer recipients", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      // Create a customer user
      const user = await createTestUser(`notif-customer-${Date.now()}`);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications",
        payload: {
          notificationType: "Info",
          message: "Test notification for customer transaction test",
          businessId: business._id.toString(),
          customersRecipientsIds: [user._id.toString()],
        },
      });

      expect(response.statusCode, response.body).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created");

      // Verify notification was created
      const notification = await Notification.findOne({
        businessId: business._id,
        message: "Test notification for customer transaction test",
      }).lean();
      expect(notification).not.toBeNull();

      // Verify customer's notifications inbox was updated
      const updatedUser = await User.findById(user._id).lean();
      expect(updatedUser?.notifications).toBeDefined();
      expect(updatedUser?.notifications?.length).toBe(1);
      expect(updatedUser?.notifications?.[0].notificationId.toString()).toBe(
        notification?._id.toString()
      );
    });
  });

  describe("Transaction Tests - PATCH /api/v1/notifications/:notificationId", () => {
    it("updates notification and syncs recipients", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      // Create user and employee
      const user = await createTestUser(`patch-notif-${Date.now()}`);

      const employee = await Employee.create({
        businessId: business._id,
        userId: user._id,
        taxNumber: `EMP-PATCH-${Date.now()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Waiter"],
      });

      // Create notification via POST first
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/notifications",
        payload: {
          notificationType: "Info",
          message: "Original message",
          businessId: business._id.toString(),
          employeesRecipientsIds: [employee._id.toString()],
        },
      });
      expect(createResponse.statusCode, createResponse.body).toBe(201);

      // Get the notification
      const notification = await Notification.findOne({
        businessId: business._id,
        message: "Original message",
      }).lean();
      expect(notification).not.toBeNull();

      // PATCH to update the message
      const patchResponse = await app.inject({
        method: "PATCH",
        url: `/api/v1/notifications/${notification?._id}`,
        payload: {
          message: "Updated message",
          employeesRecipientsIds: [employee._id.toString()],
        },
      });

      expect(patchResponse.statusCode).toBe(200);
      const body = JSON.parse(patchResponse.body);
      expect(body.message).toContain("updated");

      // Verify notification was updated
      const updatedNotification = await Notification.findById(notification?._id).lean();
      expect(updatedNotification?.message).toBe("Updated message");

      // Verify user's notification flags were reset (since message changed)
      const updatedUser = await User.findById(user._id).lean();
      const userNotif = updatedUser?.notifications?.find(
        (n) => n.notificationId.toString() === notification?._id.toString()
      );
      expect(userNotif?.readFlag).toBe(false);
    });
  });

  describe("Transaction Tests - DELETE /api/v1/notifications/:notificationId", () => {
    it("deletes notification and removes from recipients", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      // Create user and employee
      const user = await createTestUser(`delete-notif-${Date.now()}`);

      const employee = await Employee.create({
        businessId: business._id,
        userId: user._id,
        taxNumber: `EMP-DEL-${Date.now()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Waiter"],
      });

      // Create notification via POST
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/notifications",
        payload: {
          notificationType: "Warning",
          message: "To be deleted",
          businessId: business._id.toString(),
          employeesRecipientsIds: [employee._id.toString()],
        },
      });
      expect(createResponse.statusCode, createResponse.body).toBe(201);

      // Get the notification
      const notification = await Notification.findOne({
        businessId: business._id,
        message: "To be deleted",
      }).lean();
      expect(notification).not.toBeNull();

      // Verify user's inbox has notification (employee inbox state centralized on User)
      const updatedUserAfterPost = await User.findById(user._id).lean();
      expect(updatedUserAfterPost?.notifications?.length).toBe(1);

      // DELETE the notification
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/notifications/${notification?._id}`,
      });

      expect(deleteResponse.statusCode).toBe(200);
      const body = JSON.parse(deleteResponse.body);
      expect(body.message).toContain("deleted");

      // Verify notification was deleted
      const deletedNotification = await Notification.findById(notification?._id);
      expect(deletedNotification).toBeNull();

      // Verify notification was removed from user's inbox (employee inbox state is centralized on User)
      const updatedUser = await User.findById(user._id).lean();
      expect(updatedUser?.notifications?.length).toBe(0);
    });
  });
});
