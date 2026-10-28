/**
 * Business Routes Tests - Phase 1 Module 2
 * Tests for business CRUD endpoints
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Business from "../../src/models/business.ts";
import Company from "../../src/models/company.ts";
import Owner from "../../src/models/owner.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Notification from "../../src/models/notification.ts";
import emailChannel from "../../src/communications/channels/emailChannel.ts";

vi.mock("../../src/cloudinary/deleteFolderCloudinary.ts", () => ({
  default: vi.fn().mockResolvedValue(true),
}));


/**
 * Mint a User session with an active Employee membership for the venue, so the
 * business routes authorize through the signed-in User's access seam.
 */
async function businessAccessToken(
  app: Awaited<ReturnType<typeof getTestApp>>,
  businessId: string,
): Promise<string> {
  const userId = new Types.ObjectId();
  await User.create({
    _id: userId,
    personalDetails: {
      email: `staff-${userId}@test.com`,
      firstName: "Venue",
      lastName: "Staff",
    },
  });
  const employee = await Employee.create({
    businessId,
    userId,
    allEmployeeRoles: ["Manager"],
    currentShiftRole: "Manager",
    taxNumber: `EMP-${new Types.ObjectId()}`,
    joinDate: new Date(),
    vacationDaysPerYear: 20,
    active: true,
  });
  return generateTestToken({
    id: userId.toString(),
    email: `staff-${userId}@test.com`,
    type: "user",
    role: "Manager",
    businessId,
    employeeId: employee._id.toString(),
    canLogAsEmployee: true,
  });
}

/**
 * Mint a User session that reaches the venue through User → Owner → Company →
 * Business, with no Employee membership.
 */
async function businessOwnerToken(
  app: Awaited<ReturnType<typeof getTestApp>>,
  businessId: string,
): Promise<string> {
  const userId = new Types.ObjectId();
  await User.create({
    _id: userId,
    personalDetails: {
      email: `owner-${userId}@test.com`,
      firstName: "Venue",
      lastName: "Owner",
    },
  });
  const owner = await Owner.create({ userId, country: "USA" });
  const company = await Company.create({ ownerId: owner._id, country: "USA" });
  await Business.updateOne(
    { _id: businessId },
    { $set: { companyId: company._id } },
  );
  return generateTestToken({
    id: userId.toString(),
    email: `owner-${userId}@test.com`,
    type: "user",
    role: "Customer",
  });
}

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
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.detail).toBe("No business found!");
    });

    it("filters by cuisineType", async () => {
      const app = await getTestApp();

      await Business.create([
        {
          tradeName: "Italian Place",
          legalName: "Italian Place LLC",
          email: "italian@test.com",
          phoneNumber: "1234567890",
          taxNumber: "TAX-IT-001",
          currencyTrade: "USD",
          address: validAddress,
          cuisineType: ["Italian"],
        },
        {
          tradeName: "Mexican Place",
          legalName: "Mexican Place LLC",
          email: "mexican@test.com",
          phoneNumber: "1234567891",
          taxNumber: "TAX-MX-001",
          currencyTrade: "USD",
          address: validAddress,
          cuisineType: ["Mexican"],
        },
      ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business?cuisineType=Italian",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
      expect(body[0].cuisineType).toEqual(["Italian"]);
    });

    it("filters by name (tradeName)", async () => {
      const app = await getTestApp();

      await Business.create([
        {
          tradeName: "Pizza Paradise",
          legalName: "Pizza Paradise LLC",
          email: "pizza@test.com",
          phoneNumber: "1234567890",
          taxNumber: "TAX-PIZ-001",
          currencyTrade: "USD",
          address: validAddress,
        },
        {
          tradeName: "Burger Barn",
          legalName: "Burger Barn LLC",
          email: "burger@test.com",
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

    it("returns 400 for an out-of-range rating", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business?rating=6",
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "rating",
      );
    });
  });

  describe("GET /api/v1/business/:businessId", () => {
    it("gets business by ID for an owning User", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Get Test Business",
        legalName: "Get Test Business LLC",
        email: "gettest@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-GET-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await businessOwnerToken(app, business._id.toString());

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tradeName).toBe("Get Test Business");
      expect(body.password).toBeUndefined();
      expect(body.verificationToken).toBeUndefined();
      expect(body.resetPasswordToken).toBeUndefined();
      expect(body.resetPasswordExpires).toBeUndefined();
    });

    it("returns 401 when GET business without auth", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "No Auth Get",
        legalName: "No Auth Get LLC",
        email: "noauthget@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-NOAUTHGET-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
    });

    it("returns 403 when GET business with a User without venue access", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Employee Get",
        legalName: "Employee Get LLC",
        email: "employee-get@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-EMP-GET-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "employee-get@business.com",
        type: "user",
        role: "Manager",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
    });

    it("returns 403 when the User has no access to the route business", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Mismatch Get",
        legalName: "Mismatch Get LLC",
        email: "mismatch-get@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-MISMATCH-GET-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/business/invalid-id",
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "businessId",
      );
    });

    it("returns 403 when the User has no access to a non-existent business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${fakeId}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.detail).toBe("Forbidden");
    });
  });

  describe("PATCH /api/v1/business/:businessId", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/business/invalid-id",
        headers: {
          "content-type": "multipart/form-data; boundary=----formdata",
          authorization: auth,
        },
        payload: "------formdata--\r\n",
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "businessId",
      );
    });

    it("returns 403 for a non-existent business without venue access", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nUpdated Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nUpdated Business LLC',
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

      expect(response.statusCode).toBe(403);
    });

    it("returns 401 when PATCH business without auth", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "No Auth Patch",
        legalName: "No Auth Patch LLC",
        email: "noauthpatch@business.com",
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

    it("returns 403 when PATCH business with a User without venue access", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Employee Patch",
        legalName: "Employee Patch LLC",
        email: "employee-patch@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-EMP-PATCH-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "employee-patch@business.com",
        type: "user",
        role: "Manager",
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nX',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nEmployee Patch LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-EMP-PATCH-001',
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

      expect(response.statusCode).toBe(403);
    });

    it("returns 403 when the User has no access to the route business", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Mismatch Patch",
        legalName: "Mismatch Patch LLC",
        email: "mismatch-patch@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-MISMATCH-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "no-access@test.com",
        type: "user",
        role: "Customer",
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nX',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nMismatch Patch LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-MISMATCH-001',
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

      expect(response.statusCode).toBe(403);
    });

    it("updates business successfully", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Original Business",
        legalName: "Original Business LLC",
        email: "original@business.com",
        phoneNumber: "1234567890",
        taxNumber: "TAX-ORIG-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const auth = await businessAccessToken(app, business._id.toString());

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nUpdated Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nOriginal Business LLC',
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
      expect(body.message).toBe("Business updated successfully");
      expect(body.accessToken).toBeUndefined();
      expect(response.cookies.find((cookie) => cookie.name === "refresh_token")).toBeUndefined();

      const updated = await Business.findById(business._id);
      expect(updated?.tradeName).toBe("Updated Business");
    });

    it("rejects a submitted sign-in email as an unknown key", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Reject Email Co",
        legalName: "Reject Email Co LLC",
        email: "reject-email-patch@business.com",
        emailVerified: true,
        phoneNumber: "1234567890",
        taxNumber: "TAX-REJECT-EMAIL-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const auth = await businessAccessToken(app, business._id.toString());

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nReject Email Co',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nReject Email Co LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\nnew-reject-email@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-REJECT-EMAIL-001',
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

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const messages = (JSON.parse(response.body).errors ?? []).map(
        (e: { message: string }) => e.message,
      );
      expect(messages.some((m: string) => m.includes("email"))).toBe(true);

      const stored = await Business.findById(business._id).lean();
      expect(stored?.email).toBe("reject-email-patch@business.com");
      expect(stored?.emailVerified).toBe(true);
    });

    it("dispatches BUSINESS_PROFILE_UPDATED to manager recipients after successful patch", async () => {
      const app = await getTestApp();
      const previousEmailToggle = process.env.COMMUNICATIONS_EMAIL_ENABLED;
      process.env.COMMUNICATIONS_EMAIL_ENABLED = "false";

      const business = await Business.create({
        tradeName: "Notify Business",
        legalName: "Notify Business LLC",
        email: "notify@business.com",
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

      const auth = await businessAccessToken(app, business._id.toString());

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nNotify Business Updated',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nNotify Business LLC',
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

      const auth = await businessAccessToken(app, business._id.toString());

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
        phoneNumber: "1234567890",
        taxNumber: "TAX-NOCHANGE-001",
        currencyTrade: "USD",
        subscription: "Free",
        timezone: "America/Los_Angeles",
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

      const auth = await businessAccessToken(app, business._id.toString());

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nNo Change Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nNo Change Business LLC',
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

    it("rejects password and currentPassword as unknown keys", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Credential Reject Business",
        legalName: "Credential Reject Business LLC",
        email: "cred-reject@business.com",
        phoneNumber: "1234567890",
        taxNumber: `TAX-CRED-REJECT-${Date.now()}`,
        currencyTrade: "USD",
        subscription: "Free",
        address: validAddress,
      });

      const auth = await businessAccessToken(app, business._id.toString());

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nCredential Reject Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nCredential Reject Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\n' +
          String(business.taxNumber),
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="password"\r\n\r\nNewPass1!b',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currentPassword"\r\n\r\nOldPass1!a',
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

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const messages = (JSON.parse(response.body).errors ?? []).map(
        (e: { message: string }) => e.message,
      );
      expect(messages.some((m: string) => m.includes("password"))).toBe(true);
      expect(messages.some((m: string) => m.includes("currentPassword"))).toBe(
        true,
      );
    });
  });

  describe("PATCH venue profile fields", () => {
    const fullAddress = { ...validAddress, complement: "Suite 5" };
    const fullMetrics = {
      foodCostPercentage: 31,
      beverageCostPercentage: 17,
      laborCostPercentage: 29,
      fixedCostPercentage: 23,
      supplierGoodWastePercentage: {
        veryLowBudgetImpact: 8,
        lowBudgetImpact: 6,
        mediumBudgetImpact: 4,
        hightBudgetImpact: 2,
        veryHightBudgetImpact: 1,
      },
    };

    async function createVenue(
      app: Awaited<ReturnType<typeof getTestApp>>,
      overrides: Record<string, unknown> = {},
    ) {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const business = await Business.create({
        tradeName: "Profile Fields Biz",
        legalName: "Profile Fields Biz LLC",
        email: `profile-fields-${suffix}@business.com`,
        phoneNumber: "1234567890",
        taxNumber: `TAX-PF-${suffix}`,
        currencyTrade: "USD",
        subscription: "Free",
        address: fullAddress,
        ...overrides,
      });
      const auth = await businessAccessToken(app, business._id.toString());
      return { business, auth };
    }

    function patchPayload(
      boundary: string,
      business: { tradeName: string; legalName: string; taxNumber: string },
      options: {
        address?: unknown;
        metrics?: unknown;
        reportingConfig?: unknown;
      } = {},
    ): string {
      const parts = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="tradeName"\r\n\r\n${business.tradeName}`,
        `--${boundary}`,
        `Content-Disposition: form-data; name="legalName"\r\n\r\n${business.legalName}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        `Content-Disposition: form-data; name="taxNumber"\r\n\r\n${business.taxNumber}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(options.address ?? fullAddress)}`,
      ];
      if (options.metrics !== undefined) {
        parts.push(
          `--${boundary}`,
          `Content-Disposition: form-data; name="metrics"\r\n\r\n${JSON.stringify(options.metrics)}`,
        );
      }
      if (options.reportingConfig !== undefined) {
        parts.push(
          `--${boundary}`,
          `Content-Disposition: form-data; name="reportingConfig"\r\n\r\n${JSON.stringify(options.reportingConfig)}`,
        );
      }
      parts.push(`--${boundary}--`);
      return parts.join("\r\n");
    }

    it("recomputes the timezone when the address changes", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app, {
        timezone: "America/Bogota",
        address: { ...fullAddress, country: "Colombia", state: "Antioquia" },
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, {
          address: { ...fullAddress, country: "USA", state: "New York" },
        }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.timezone).toBe("America/New_York");
    });

    it("clears the timezone when the address becomes unmappable", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app, {
        timezone: "America/Bogota",
        address: { ...fullAddress, country: "Colombia", state: "Antioquia" },
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, {
          address: { ...fullAddress, country: "Atlantis", state: "Nowhere" },
        }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.timezone).toBeUndefined();
    });

    it("preserves unchanged address fields when part of the address changes", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app);
      const nextAddress = { ...fullAddress, country: "Canada", state: "Ontario" };

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, { address: nextAddress }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.address).toMatchObject(nextAddress);
      expect(stored?.address.complement).toBe("Suite 5");
    });

    it("preserves unchanged metrics when one metric changes", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app, { metrics: fullMetrics });
      const nextMetrics = { ...fullMetrics, foodCostPercentage: 42 };

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, { metrics: nextMetrics }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.metrics?.foodCostPercentage).toBe(42);
      expect(stored?.metrics?.beverageCostPercentage).toBe(17);
      expect(
        stored?.metrics?.supplierGoodWastePercentage?.lowBudgetImpact,
      ).toBe(6);
    });

    it("persists the weekly report start day", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createVenue(app);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: patchPayload(boundary, business, {
          reportingConfig: { weeklyReportStartDay: 3 },
        }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.reportingConfig?.weeklyReportStartDay).toBe(3);
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
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "businessId",
      );
    });

    it("closes the business via soft delete and retains dependent records", async () => {
      const app = await getTestApp();
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const business = await Business.create({
        tradeName: "Delete Test Business",
        legalName: "Delete Test Business LLC",
        email: `delete-business-${suffix}@business.com`,
        phoneNumber: "1234567890",
        taxNumber: `TAX-DELETE-${suffix}`,
        currencyTrade: "USD",
        address: validAddress,
      });

      const user = await User.create({
        personalDetails: {
          username: `delete-user-${suffix}`,
          email: `delete-user-${suffix}@test.com`,
          password: "hashedpassword",
          firstName: "Delete",
          lastName: "User",
          phoneNumber: "9999999999",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          idType: "National ID",
          idNumber: `ID-DELETE-${suffix}`,
          address: validAddress,
        },
        allUserRoles: ["Employee"],
      });

      const employee = await Employee.create({
        businessId: business._id,
        userId: user._id,
        taxNumber: `EMP-DELETE-${suffix}`,
        joinDate: new Date(),
        vacationDaysPerYear: 20,
        vacationDaysLeft: 20,
        allEmployeeRoles: ["Manager"],
        currentShiftRole: "Manager",
        onDuty: false,
        active: true,
      });

      const notification = await Notification.create({
        notificationType: "Info",
        message: "Delete route retention test",
        businessId: business._id,
        employeesRecipientsIds: [employee._id],
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        message: "Business deleted successfully",
      });

      const deletedBusiness = await Business.findById(business._id)
        .setOptions({ includeDeleted: true })
        .select("deleted deletedAt")
        .lean();
      expect(deletedBusiness?.deleted).toBe(true);
      expect(deletedBusiness?.deletedAt).toBeInstanceOf(Date);

      const retainedEmployee = await Employee.findById(employee._id)
        .select("deleted")
        .lean();
      expect(retainedEmployee?.deleted).toBe(false);

      const retainedNotification = await Notification.findById(notification._id)
        .select("deleted")
        .lean();
      expect(retainedNotification?.deleted).toBe(false);
    });

    it("excludes a closed business from active-default reads", async () => {
      const app = await getTestApp();
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const business = await Business.create({
        tradeName: "Closed Discovery Business",
        legalName: "Closed Discovery Business LLC",
        email: `closed-discovery-${suffix}@business.com`,
        phoneNumber: "1234567890",
        taxNumber: `TAX-CLOSED-${suffix}`,
        currencyTrade: "USD",
        address: validAddress,
      });

      const closeResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/business/${business._id}`,
      });
      expect(closeResponse.statusCode).toBe(200);

      const defaultRead = await app.inject({
        method: "GET",
        url: "/api/v1/business",
      });
      expect(defaultRead.statusCode).toBe(400);
      expect(defaultRead.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(JSON.parse(defaultRead.body).detail).toBe("No business found!");

      const includeDeletedRead = await app.inject({
        method: "GET",
        url: "/api/v1/business?includeDeleted=true",
      });
      expect(includeDeletedRead.statusCode).toBe(200);
      expect(
        JSON.parse(includeDeletedRead.body).some(
          (entry: { _id: string }) => entry._id === business._id.toString(),
        ),
      ).toBe(true);
    });
  });
});
