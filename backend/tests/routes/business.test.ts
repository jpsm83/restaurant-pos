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

vi.mock("../../src/cloudinary/deleteFolderCloudinary.ts", () => ({
  default: vi.fn().mockResolvedValue(true),
}));

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
          password: "hashedpassword",
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
          password: "hashedpassword",
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
    it("gets business by ID for the matching owner", async () => {
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
        pendingEmail: "gettest-new@business.com",
        pendingEmailToken: "gettest-pending-token",
        pendingEmailExpires: new Date(Date.now() + 3_600_000),
        pendingEmailRequestedAt: new Date(),
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "gettest@business.com",
        type: "business",
        role: "Tenant",
      });

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
      expect(body.pendingEmail).toBeUndefined();
      expect(body.pendingEmailToken).toBeUndefined();
      expect(body.pendingEmailExpires).toBeUndefined();
      expect(body.pendingEmailRequestedAt).toBeUndefined();
    });

    it("returns 401 when GET business without auth", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "No Auth Get",
        legalName: "No Auth Get LLC",
        email: "noauthget@business.com",
        password: "hashedpassword",
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

    it("returns 403 when GET business with a non-business session", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Employee Get",
        legalName: "Employee Get LLC",
        email: "employee-get@business.com",
        password: "hashedpassword",
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

    it("returns 403 when the business session id does not match the route param", async () => {
      const app = await getTestApp();

      const business = await Business.create({
        tradeName: "Mismatch Get",
        legalName: "Mismatch Get LLC",
        email: "mismatch-get@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-MISMATCH-GET-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "mismatch-get@business.com",
        type: "business",
        role: "Tenant",
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
        email: "any@business.com",
        type: "business",
        role: "Tenant",
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

    it("returns 404 for non-existent business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();
      const auth = await generateTestToken({
        id: fakeId.toString(),
        email: "ghost@business.com",
        type: "business",
        role: "Tenant",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${fakeId}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.detail).toBe("No business found!");
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
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "email",
      );
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
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "password",
      );
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

    it("creates a business with JSON-encoded discovery fields", async () => {
      const app = await getTestApp();

      const boundary = "----formdata";
      const openingHours = [
        { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00" },
      ];
      const deliveryWindows = [
        { dayOfWeek: 2, windows: [{ openTime: "10:00", closeTime: "14:00" }] },
      ];
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nDiscovery Co',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nDiscovery Co LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\ndiscovery@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="password"\r\n\r\nPassword123!',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-DISCOVERY-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}`,
        `Content-Disposition: form-data; name="cuisineType"\r\n\r\n${JSON.stringify(["Italian"])}`,
        `--${boundary}`,
        `Content-Disposition: form-data; name="categories"\r\n\r\n${JSON.stringify(["Pizza"])}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="acceptsDelivery"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="deliveryRadius"\r\n\r\n5',
        `--${boundary}`,
        'Content-Disposition: form-data; name="minOrder"\r\n\r\n10',
        `--${boundary}`,
        `Content-Disposition: form-data; name="businessOpeningHours"\r\n\r\n${JSON.stringify(openingHours)}`,
        `--${boundary}`,
        `Content-Disposition: form-data; name="deliveryOpeningWindows"\r\n\r\n${JSON.stringify(deliveryWindows)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(201);

      const created = await Business.findOne({
        email: "discovery@business.com",
      }).lean();
      expect(created?.cuisineType).toEqual(["Italian"]);
      expect(created?.categories).toEqual(["Pizza"]);
      expect(created?.acceptsDelivery).toBe(true);
      expect(created?.deliveryRadius).toBe(5);
      expect(created?.minOrder).toBe(10);
      expect(created?.businessOpeningHours).toMatchObject(openingHours);
      expect(created?.deliveryOpeningWindows).toMatchObject(deliveryWindows);
    });

    it("rejects server-owned fields on registration", async () => {
      const app = await getTestApp();

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nOwned Co',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nOwned Co LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="email"\r\n\r\nowned@business.com',
        `--${boundary}`,
        'Content-Disposition: form-data; name="password"\r\n\r\nPassword123!',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-OWNED-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="averageRating"\r\n\r\n5',
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(
        body.errors?.some((e: { message: string }) =>
          e.message.includes("averageRating"),
        ),
      ).toBe(true);

      const created = await Business.findOne({ email: "owned@business.com" });
      expect(created).toBeNull();
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

  describe("Business timezone", () => {
    function registrationPayload(
      boundary: string,
      options: {
        email: string;
        taxNumber: string;
        country: string;
        state: string;
      },
    ): string {
      const address = {
        ...validAddress,
        country: options.country,
        state: options.state,
      };
      return [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nTZ Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nTZ Business LLC',
        `--${boundary}`,
        `Content-Disposition: form-data; name="email"\r\n\r\n${options.email}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="password"\r\n\r\nPassword123!',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        `Content-Disposition: form-data; name="taxNumber"\r\n\r\n${options.taxNumber}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(address)}`,
        `--${boundary}--`,
      ].join("\r\n");
    }

    function profilePatchPayload(
      boundary: string,
      business: {
        taxNumber: string;
        country: string;
        state: string;
      },
    ): string {
      const address = {
        ...validAddress,
        country: business.country,
        state: business.state,
      };
      return [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nTZ Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nTZ Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        `Content-Disposition: form-data; name="taxNumber"\r\n\r\n${business.taxNumber}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(address)}`,
        `--${boundary}--`,
      ].join("\r\n");
    }

    it("derives the timezone from the address at registration and returns it on the profile read", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: registrationPayload(boundary, {
          email: "tz-create@business.com",
          taxNumber: "TAX-TZ-CREATE",
          country: "Colombia",
          state: "Antioquia",
        }),
      });

      expect(response.statusCode).toBe(201);

      const created = await Business.findOne({ email: "tz-create@business.com" });
      expect(created?.timezone).toBe("America/Bogota");
      const auth = await generateTestToken({
        id: created!._id.toString(),
        email: "tz-create@business.com",
        type: "business",
        role: "Tenant",
      });

      const read = await app.inject({
        method: "GET",
        url: `/api/v1/business/${created?._id}`,
        headers: { authorization: auth },
      });
      expect(read.statusCode).toBe(200);
      const body = JSON.parse(read.body);
      expect(body.timezone).toBe("America/Bogota");
      expect(body.timezoneIsDefault).toBe(false);
    });

    it("uses the state to disambiguate a multi-zone country at registration", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: registrationPayload(boundary, {
          email: "tz-us@business.com",
          taxNumber: "TAX-TZ-US",
          country: "USA",
          state: "California",
        }),
      });

      expect(response.statusCode).toBe(201);
      const created = await Business.findOne({ email: "tz-us@business.com" });
      expect(created?.timezone).toBe("America/Los_Angeles");
    });

    it("falls back to UTC and flags the default when the address cannot be mapped", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/business",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: registrationPayload(boundary, {
          email: "tz-unknown@business.com",
          taxNumber: "TAX-TZ-UNKNOWN",
          country: "Atlantis",
          state: "Nowhere",
        }),
      });

      expect(response.statusCode).toBe(201);
      const created = await Business.findOne({ email: "tz-unknown@business.com" });
      expect(created?.timezone).toBeUndefined();
      const auth = await generateTestToken({
        id: created!._id.toString(),
        email: "tz-unknown@business.com",
        type: "business",
        role: "Tenant",
      });

      const read = await app.inject({
        method: "GET",
        url: `/api/v1/business/${created?._id}`,
        headers: { authorization: auth },
      });
      const body = JSON.parse(read.body);
      expect(body.timezone).toBe("UTC");
      expect(body.timezoneIsDefault).toBe(true);
    });

    it("resolves a business with no timezone to UTC and flags it as default", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Legacy Business",
        legalName: "Legacy Business LLC",
        email: "legacy@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-LEGACY-TZ",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "legacy@business.com",
        type: "business",
        role: "Tenant",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.timezone).toBe("UTC");
      expect(body.timezoneIsDefault).toBe(true);
    });

    it("resolves an invalid stored timezone to UTC at read time", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Bad Zone Business",
        legalName: "Bad Zone Business LLC",
        email: "badzone@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-BADZONE-TZ",
        currencyTrade: "USD",
        timezone: "Not/AZone",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "badzone@business.com",
        type: "business",
        role: "Tenant",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.timezone).toBe("UTC");
      expect(body.timezoneIsDefault).toBe(true);
    });

    it("recomputes the timezone when the address changes on profile update", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const business = await Business.create({
        tradeName: "TZ Business",
        legalName: "TZ Business LLC",
        email: "tz-update@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-TZ-UPDATE",
        currencyTrade: "USD",
        timezone: "America/Bogota",
        address: { ...validAddress, country: "Colombia", state: "Antioquia" },
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "tz-update@business.com",
        type: "business",
        role: "Tenant",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: profilePatchPayload(boundary, {
          taxNumber: "TAX-TZ-UPDATE",
          country: "USA",
          state: "New York",
        }),
      });

      expect(response.statusCode).toBe(200);

      const read = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });
      const body = JSON.parse(read.body);
      expect(body.timezone).toBe("America/New_York");
      expect(body.timezoneIsDefault).toBe(false);
    });

    it("falls back to UTC when the address changes to an unmappable country", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const business = await Business.create({
        tradeName: "TZ Business",
        legalName: "TZ Business LLC",
        email: "tz-unmappable@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-TZ-UNMAPPABLE",
        currencyTrade: "USD",
        timezone: "America/Bogota",
        address: { ...validAddress, country: "Colombia", state: "Antioquia" },
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "tz-unmappable@business.com",
        type: "business",
        role: "Tenant",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: profilePatchPayload(boundary, {
          taxNumber: "TAX-TZ-UNMAPPABLE",
          country: "Atlantis",
          state: "Nowhere",
        }),
      });

      expect(response.statusCode).toBe(200);

      const stored = await Business.findById(business._id).lean();
      expect(stored?.timezone).toBeUndefined();

      const read = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });
      const body = JSON.parse(read.body);
      expect(body.timezone).toBe("UTC");
      expect(body.timezoneIsDefault).toBe(true);
    });

    it("leaves the timezone unchanged when the address is unchanged", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const business = await Business.create({
        tradeName: "TZ Business",
        legalName: "TZ Business LLC",
        email: "tz-same@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-TZ-SAME",
        currencyTrade: "USD",
        timezone: "America/Bogota",
        address: { ...validAddress, country: "Colombia", state: "Antioquia" },
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "tz-same@business.com",
        type: "business",
        role: "Tenant",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: profilePatchPayload(boundary, {
          taxNumber: "TAX-TZ-SAME",
          country: "Colombia",
          state: "Antioquia",
        }),
      });

      expect(response.statusCode).toBe(200);

      const stored = await Business.findById(business._id).lean();
      expect(stored?.timezone).toBe("America/Bogota");
    });
  });

  describe("Business reporting config", () => {
    async function createReportBusiness() {
      const business = await Business.create({
        tradeName: "Report Business",
        legalName: "Report Business LLC",
        email: "report@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-REPORT-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "report@business.com",
        type: "business",
        role: "Tenant",
      });
      return { business, auth };
    }

    function reportPatchPayload(boundary: string, reportingConfig: string): string {
      return [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nReport Business',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nReport Business LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        'Content-Disposition: form-data; name="taxNumber"\r\n\r\nTAX-REPORT-001',
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}`,
        `Content-Disposition: form-data; name="reportingConfig"\r\n\r\n${reportingConfig}`,
        `--${boundary}--`,
      ].join("\r\n");
    }

    it("persists the weekly report start day and returns it on profile read", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createReportBusiness();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: reportPatchPayload(
          boundary,
          JSON.stringify({ weeklyReportStartDay: 3 }),
        ),
      });

      expect(response.statusCode).toBe(200);

      const stored = await Business.findById(business._id).lean();
      expect(stored?.reportingConfig?.weeklyReportStartDay).toBe(3);

      const read = await app.inject({
        method: "GET",
        url: `/api/v1/business/${business._id}`,
        headers: { authorization: auth },
      });
      expect(read.statusCode).toBe(200);
      const body = JSON.parse(read.body);
      expect(body.reportingConfig?.weeklyReportStartDay).toBe(3);
    });

    it("rejects an out-of-range weekly report start day as a field-level problem", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createReportBusiness();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: reportPatchPayload(
          boundary,
          JSON.stringify({ weeklyReportStartDay: 7 }),
        ),
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "reportingConfig.weeklyReportStartDay",
      );

      const stored = await Business.findById(business._id).lean();
      expect(stored?.reportingConfig?.weeklyReportStartDay).toBeUndefined();
    });

    it("rejects a non-integer weekly report start day as a field-level problem", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createReportBusiness();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: reportPatchPayload(
          boundary,
          JSON.stringify({ weeklyReportStartDay: 1.5 }),
        ),
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "reportingConfig.weeklyReportStartDay",
      );
    });

    it("rejects a malformed reporting config as a field-level problem", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createReportBusiness();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: reportPatchPayload(boundary, "{not json"),
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "reportingConfig",
      );

      const stored = await Business.findById(business._id).lean();
      expect(stored?.reportingConfig?.weeklyReportStartDay).toBeUndefined();
    });
  });

  describe("PATCH /api/v1/business/:businessId profile fields", () => {
    // Reuses the shared fixture plus one optional field, to prove optional
    // address fields survive a partial address update.
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

    async function createProfileBusiness(
      overrides: Record<string, unknown> = {},
    ) {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const business = await Business.create({
        tradeName: "Profile Fields Biz",
        legalName: "Profile Fields Biz LLC",
        email: `profile-fields-${suffix}@business.com`,
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: `TAX-PF-${suffix}`,
        currencyTrade: "USD",
        subscription: "Free",
        address: fullAddress,
        ...overrides,
      });
      const auth = await generateTestToken({
        id: business._id.toString(),
        email: business.email,
        type: "business",
        role: "Tenant",
      });
      return { business, auth };
    }

    function profileFieldsPayload(
      boundary: string,
      business: { taxNumber: string },
      options: { address?: unknown; metrics?: string } = {},
    ): string {
      const parts = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nProfile Fields Biz',
        `--${boundary}`,
        'Content-Disposition: form-data; name="legalName"\r\n\r\nProfile Fields Biz LLC',
        `--${boundary}`,
        'Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890',
        `--${boundary}`,
        `Content-Disposition: form-data; name="taxNumber"\r\n\r\n${business.taxNumber}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(
          options.address ?? fullAddress,
        )}`,
      ];
      if (options.metrics !== undefined) {
        parts.push(
          `--${boundary}`,
          `Content-Disposition: form-data; name="metrics"\r\n\r\n${options.metrics}`,
        );
      }
      parts.push(`--${boundary}--`);
      return parts.join("\r\n");
    }

    it("preserves unchanged address fields when part of the address changes", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createProfileBusiness();
      const nextAddress = { ...fullAddress, country: "Canada", state: "Ontario" };

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: profileFieldsPayload(boundary, business, {
          address: nextAddress,
        }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.address).toMatchObject(nextAddress);
    });

    it("preserves unchanged metrics when one metric changes", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createProfileBusiness({
        metrics: fullMetrics,
      });
      const nextMetrics = { ...fullMetrics, foodCostPercentage: 42 };

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: profileFieldsPayload(boundary, business, {
          metrics: JSON.stringify(nextMetrics),
        }),
      });

      expect(response.statusCode).toBe(200);
      const stored = await Business.findById(business._id).lean();
      expect(stored?.metrics?.foodCostPercentage).toBe(42);
      expect(stored?.metrics?.beverageCostPercentage).toBe(17);
      expect(stored?.metrics?.laborCostPercentage).toBe(29);
      expect(stored?.metrics?.supplierGoodWastePercentage?.lowBudgetImpact).toBe(
        6,
      );
    });

    it("returns a field-level problem for malformed metrics JSON", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createProfileBusiness({
        metrics: fullMetrics,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: profileFieldsPayload(boundary, business, { metrics: "{not json" }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(response.body);
      expect(body.errors?.map((e: { path: string }) => e.path)).toContain(
        "metrics",
      );

      const stored = await Business.findById(business._id).lean();
      expect(stored?.metrics?.foodCostPercentage).toBe(31);
    });

    it("returns a field-level problem for an incomplete waste breakdown", async () => {
      const app = await getTestApp();
      const boundary = "----formdata";
      const { business, auth } = await createProfileBusiness({
        metrics: fullMetrics,
      });
      const { veryLowBudgetImpact: _drop, ...incompleteWaste } =
        fullMetrics.supplierGoodWastePercentage;

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload: profileFieldsPayload(boundary, business, {
          metrics: JSON.stringify({
            ...fullMetrics,
            supplierGoodWastePercentage: incompleteWaste,
          }),
        }),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(
        body.errors?.some((e: { path: string }) =>
          e.path.startsWith("metrics.supplierGoodWastePercentage"),
        ),
      ).toBe(true);
    });
  });

  describe("PATCH /api/v1/business/:businessId", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "any@business.com",
        type: "business",
        role: "Tenant",
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

    it("returns 404 for non-existent business when JWT matches URL id", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();
      const auth = await generateTestToken({
        id: fakeId.toString(),
        email: "ghost@business.com",
        type: "business",
        role: "Tenant",
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

    it("returns 403 when PATCH business with a non-business session", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Employee Patch",
        legalName: "Employee Patch LLC",
        email: "employee-patch@business.com",
        password: "hashedpassword",
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

    it("returns 403 when the business session id does not match the route param", async () => {
      const app = await getTestApp();
      const business = await Business.create({
        tradeName: "Mismatch Patch",
        legalName: "Mismatch Patch LLC",
        email: "mismatch-patch@business.com",
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-MISMATCH-001",
        currencyTrade: "USD",
        address: validAddress,
      });
      const auth = await generateTestToken({
        id: new Types.ObjectId().toString(),
        email: "mismatch-patch@business.com",
        type: "business",
        role: "Tenant",
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
        role: "Tenant",
      });

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
      expect(body.accessToken).toBeDefined();
      expect(body.user?.type).toBe("business");

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
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: "TAX-REJECT-EMAIL-001",
        currencyTrade: "USD",
        address: validAddress,
      });

      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "reject-email-patch@business.com",
        type: "business",
        role: "Tenant",
      });

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
        role: "Tenant",
      });

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
        role: "Tenant",
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

      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "nochange@business.com",
        type: "business",
        role: "Tenant",
      });

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
        password: "hashedpassword",
        phoneNumber: "1234567890",
        taxNumber: `TAX-CRED-REJECT-${Date.now()}`,
        currencyTrade: "USD",
        subscription: "Free",
        address: validAddress,
      });

      const auth = await generateTestToken({
        id: business._id.toString(),
        email: "cred-reject@business.com",
        type: "business",
        role: "Tenant",
      });

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
        password: "hashedpassword",
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
        password: "hashedpassword",
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
