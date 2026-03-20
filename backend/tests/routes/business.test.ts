/**
 * Business Routes Tests - Phase 1 Module 2
 * Tests for business CRUD endpoints
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import Business from "../../src/models/business.ts";

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
      expect(body.message).toContain("Password must contain");
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

    it("returns 404 for non-existent business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

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
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
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
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const updated = await Business.findById(business._id);
      expect(updated?.tradeName).toBe("Updated Business");
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
