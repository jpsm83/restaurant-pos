/**
 * Business Routes Tests - Phase 1 Module 2
 * Tests for business CRUD endpoints
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Business from "../../src/models/business.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Notification from "../../src/models/notification.ts";
import emailChannel from "../../src/communications/channels/emailChannel.ts";

describe("Business Routes", () => {
  const validAddress = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  describe("GET /api/v1/business", () => {
    it("lists all businesses", async () => {
      const app = await getTestApp();

      await Business.create({
        tradeName: "Test Restaurant",
        legalName: "Test Restaurant LLC",
        email: "test@restaurant.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].tradeName).toBe("Test Restaurant");
      expect(body[0].password).toBeUndefined();
    });

    it("returns 400 when no businesses exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No business found!");
    });

    it("filters by cuisineType", async () => {
      const app = await getTestApp();

      await Business.create([
        {
          tradeName: "Italian Place",
          legalName: "Italian Place LLC",
          email: "italian@test.com",
          password: "hashedpassword",
          phoneNumber: "1234567890",
          taxNumber: "TAX-IT-001",
          currencyTrade: "USD",
          address: validAddress,
          cuisineType: "Italian",
        },
        {
          tradeName: "Mexican Place",
          legalName: "Mexican Place LLC",
          email: "mexican@test.com",
          password: "hashedpassword",
          phoneNumber: "1234567891",
          taxNumber: "TAX-MX-001",
          currencyTrade: "USD",
          address: validAddress,
          cuisineType: "Mexican",
        },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business?cuisineType=Italian",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
      expect(body[0].cuisineType).toBe("Italian");
    });

    it("filters by name (tradeName)", async () => {
      const app = await getTestApp();

      await Business.create([
        {
          tradeName: "Pizza Paradise",
          legalName: "Pizza Paradise LLC",
          email: "pizza@test.com",
          password: "hashedpassword",
          phoneNumber: "1234567890",
          taxNumber: "TAX-PIZ-001",
          currencyTrade: "USD",
          address: validAddress,
        },
        {
          tradeName: "Burger Barn",
          legalName: "Burger Barn LLC",
          email: "burger@test.com",
          password: "hashedpassword",
          phoneNumber: "1234567891",
          taxNumber: "TAX-BUR-001",
          currencyTrade: "USD",
          address: validAddress,
        },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business?name=Pizza",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
      expect(body[0].tradeName).toBe("Pizza Paradise");
    });
  });

  describe("GET /api/v1/business/:businessId", () => {
    it("gets business by ID", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Get Test Business",
        legalName: "Get Test Business LLC",
        email: "gettest@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-GET-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tradeName).toBe("Get Test Business");
      expect(body.password).toBeUndefined();
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessId!");
    });

    it("returns 404 for non-existent business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No business found!");
    });
  });

  describe("POST /api/v1/business", () => {
    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const form = new FormData();
      form.append("tradeName", "Test Business");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { "content-type": "multipart/form-data; boundary=----formdata" },
        payload:
          "------formdata\r\n" +
          'Content-Disposition: form-data; name="tradeName"\r\n\r\n' +
          "Test Business\r\n" +
          "------formdata--\r\n",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid email format", async () => {
      const app = await getTestApp();

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nTest Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nTest Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\ninvalid-email',
        `--${boundary}`,
        'Content-Disposition: form-data; name="password"\r\n\r\nPassword123!',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid email format!");
    });

    it("returns 400 for weak password", async () => {
      const app = await getTestApp();

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nTest Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nTest Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\ntest@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="password"\r\n\r\nweak',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Password must be at least");
    });

    it("creates business with valid data", async () => {
      const app = await getTestApp();

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nNew Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nNew Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\nnew@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="password"\r\n\r\nPassword123!',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-NEW-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created");
      expect(body.accessToken).toBeDefined();
      expect(body.user?.type).toBe("business");
      expect(body.user?.email).toBe("new@business.com");

      const created = await Business.findOne({ email: "new@business.com" });
      expect(created).not.toBeNull();
      expect(created?.tradeName).toBe("New Business");
    });

    it("returns 409 for duplicate business", async () => {
      const app = await getTestApp();

      await Business.create({
        tradeName: "Existing Business",
        legalName: "Existing Business LLC",
        email: "existing@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-EXIST-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nNew Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nExisting Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\nanother@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="password"\r\n\r\nPassword123!',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-NEW-002',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe("PATCH /api/v1/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/business/invalid-id",
        headers: { "content-type": "multipart/form-data; boundary=----formdata" },
        payload: "------formdata--\r\n",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 404 for non-existent business when JWT matches URL id", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();
      const auth = await generateTestToken({
        id: fakeId.toString(),
        email: "ghost@business.com",
        type: "business",
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nUpdated Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nUpdated Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\nupdated@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-UPD-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${fakeId}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it("returns 401 when PATCH business without auth", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "No Auth Patch",
        legalName: "No Auth Patch LLC",
        email: "noauthpatch@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-NOAUTH-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nX',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nNo Auth Patch LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\nnoauthpatch@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-NOAUTH-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(401);
    });

    it("updates business successfully", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Original Business",
        legalName: "Original Business LLC",
        email: "original@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-ORIG-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "original@business.com",
        type: "business",
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nUpdated Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nOriginal Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\noriginal@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-ORIG-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accessToken).toBeDefined();
      expect(body.user?.type).toBe("business");

      const updated = await Business.findById(business._id);
      expect(updated?.tradeName).toBe("Updated Business");
    });

    it("dispatches BUSINESS_PROFILE_UPDATED to manager recipients after successful patch", async () => {
      const app = await getTestApp();
      const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
      process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

      const business = await Business.create({
        tradeName: "Notify Business",
        legalName: "Notify Business LLC",
        email: "notify@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-NOTIFY-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const managerUser = await User.create({
        personalDetails: {
          username: `notify-manager-${Date.now()}`,
          email: "notify-manager@test.com",
          password: "hashedpassword",
          firstName: "Notify",
          lastName: "Manager",
          phoneNumber: "9999999999",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: `ID-NOTIFY-${Date.now()}`,
          address: validAddress,
        },
        allUserRoles: ["Employee"],
      });

      const managerEmployee = await Employee.create({
        businessId: business._id,
        userId: managerUser._id,
        taxNumber: `EMP-NOTIFY-${Date.now()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Manager"],
        currentShiftRole: "Manager",
        onDuty: false,
        active: true,
      });

      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "notify@business.com",
        type: "business",
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nNotify Business Updated',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nNotify Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\nnotify@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-NOTIFY-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
          "x-correlation-id": "corr-route-biz-patch-001",
          "x-idempotency-key": "op-route-biz-patch-001",
        },
        payload,
      });

      expect(response.statusCode).toBe(200);

      let notifications: Array<{ message: string }> = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        notifications = (await Notification.find({
          businessId: business._id,
          employeesRecipientsIds: managerEmployee._id,
        }).lean()) as Array<{ message: string }>;
        if (
          notifications.some((n) =>
            n.message.includes("Business profile updated"),
          )
        ) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(
        notifications.some((n) => n.message.includes("Business profile updated")),
      ).toBe(true);

      if (previousEmailToggle === undefined) {
        delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
      } else {
        process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
      }
    });

    it("profile PATCH triggers manager email send when email channel is enabled", async () => {
      const app = await getTestApp();
      const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
      const previousInAppToggle = process.env.COMMUNICATIONS_INAPP_ENABLED;
      process.env.COMMUNICATIONS_EMAIL_ENABLED = "true";
      process.env.COMMUNICATIONS_INAPP_ENABLED = "true";

      const business = await Business.create({
        tradeName: "Email Dispatch Business",
        legalName: "Email Dispatch LLC",
        email: "emaildispatch@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-EMAIL-001",
        currencyTrade: "USD",
        subscription: "Free",
        address: validAddress,
      });

      const managerUser = await User.create({
        personalDetails: {
          username: `email-mgr-${Date.now()}`,
          email: "email-mgr-profile@test.com",
          password: "hashedpassword",
          firstName: "Email",
          lastName: "Manager",
          phoneNumber: "9991112222",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: `ID-EMAIL-${Date.now()}`,
          address: validAddress,
        },
        allUserRoles: ["Employee"],
      });

      await Employee.create({
        businessId: business._id,
        userId: managerUser._id,
        taxNumber: `EMP-EMAIL-${Date.now()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Manager"],
        currentShiftRole: "Manager",
        onDuty: false,
        active: true,
      });

      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "emaildispatch@business.com",
        type: "business",
      });

      const emailSpy = vi.spyOn(emailChannel, "send").mockResolvedValue({
        channel: "email",
        success: true,
        sentCount: 1,
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nEmail Dispatch Business Updated',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nEmail Dispatch LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\nemaildispatch@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-EMAIL-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);

      for (let attempt = 0; attempt < 50 && emailSpy.mock.calls.length === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      expect(emailSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

      const firstEmailPayload = emailSpy.mock.calls[0][0];
      expect(firstEmailPayload.eventName).toBe("BUSINESS_PROFILE_UPDATED");
      expect(firstEmailPayload.subject).toBe("Business profile updated");
      expect(typeof firstEmailPayload.text).toBe("string");
      expect(firstEmailPayload.text).toContain("The business profile was updated.");
      expect(firstEmailPayload.text).toContain(business._id.toString());

      emailSpy.mockRestore();
      if (previousEmailToggle === undefined) {
        delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
      } else {
        process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
      }
      if (previousInAppToggle === undefined) {
        delete process.env.COMMUNICATIONS_INAPP_ENABLED;
      } else {
        process.env.COMMUNICATIONS_INAPP_ENABLED = previousInAppToggle;
      }
    });

    it("skips BUSINESS_PROFILE_UPDATED dispatch when patch has no meaningful changes", async () => {
      const app = await getTestApp();
      const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
      process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

      const business = await Business.create({
        tradeName: "No Change Business",
        legalName: "No Change Business LLC",
        email: "nochange@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-NOCHANGE-001",
        currencyTrade: "USD",
        subscription: "Free",
        address: validAddress,
      });

      const managerUser = await User.create({
        personalDetails: {
          username: `nochange-manager-${Date.now()}`,
          email: "nochange-manager@test.com",
          password: "hashedpassword",
          firstName: "No",
          lastName: "Change",
          phoneNumber: "8888888888",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: `ID-NOCHANGE-${Date.now()}`,
          address: validAddress,
        },
        allUserRoles: ["Employee"],
      });

      const managerEmployee = await Employee.create({
        businessId: business._id,
        userId: managerUser._id,
        taxNumber: `EMP-NOCHANGE-${Date.now()}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Manager"],
        currentShiftRole: "Manager",
        onDuty: true,
        active: true,
      });

      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "nochange@business.com",
        type: "business",
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nNo Change Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nNo Change Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\nnochange@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-NOCHANGE-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
          "x-correlation-id": "corr-route-no-change-001",
          "x-idempotency-key": "op-route-no-change-001",
        },
        payload,
      });

      expect(response.statusCode).toBe(200);

      // Because route dispatch is intentionally fire-and-forget, poll briefly
      // for any unexpected profile-update notification that would indicate
      // skip logic failed on no-change payloads.
      let notifications: Array<{ message: string }> = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        notifications = (await Notification.find({
          businessId: business._id,
          employeesRecipientsIds: managerEmployee._id,
        }).lean()) as Array<{ message: string }>;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      expect(
        notifications.some((n) => n.message.includes("Business profile updated")),
      ).toBe(false);

      if (previousEmailToggle === undefined) {
        delete process.env.COMMUNICATIONS_EMAIL_ENABLED;
      } else {
        process.env.COMMUNICATIONS_EMAIL_ENABLED = previousEmailToggle;
      }
    });
  });

  describe("DELETE /api/v1/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessId!");
    });
  });
});
