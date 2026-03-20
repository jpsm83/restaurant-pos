/**
 * BusinessGoods Routes Tests - Phase 1 Module 3 + Phase 5 Task 5.3
 * Tests for business goods CRUD endpoints
 * Phase 5: Cloudinary tests for image uploads (skipped - ESM mocking limitation)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import Business from "../../src/models/business.ts";

describe("BusinessGoods Routes", () => {
  let businessId: Types.ObjectId;

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: "TAX-001",
      currencyTrade: "USD",
      address: {
        country: "USA",
        state: "CA",
        city: "LA",
        street: "Main St",
        buildingNumber: "123",
        postCode: "90001",
      },
    });
    businessId = business._id;
  });

  describe("GET /api/v1/businessGoods", () => {
    it("lists all business goods", async () => {
      const app = await getTestApp();

      await BusinessGood.create({
        businessId,
        name: "Burger",
        keyword: "burger",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 12.99,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/businessGoods",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].name).toBe("Burger");
    });

    it("returns 404 when no business goods exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/businessGoods",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/v1/businessGoods/:businessGoodId", () => {
    it("gets business good by ID", async () => {
      const app = await getTestApp();

      const businessGood = await BusinessGood.create({
        businessId,
        name: "Pizza",
        keyword: "pizza",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 15.99,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/businessGoods/${businessGood._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("Pizza");
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/businessGoods/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessGoodId!");
    });

    it("returns 404 for non-existent business good", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/businessGoods/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/v1/businessGoods", () => {
    it("creates business good with valid data", async () => {
      const app = await getTestApp();

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"\r\n\r\nNew Burger',
        `--${boundary}`,
        'Content-Disposition: form-data; name="keyword"\r\n\r\nnewburger',
        `--${boundary}`,
        'Content-Disposition: form-data; name="mainCategory"\r\n\r\nFood',
        `--${boundary}`,
        'Content-Disposition: form-data; name="onMenu"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="available"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="sellingPrice"\r\n\r\n14.99',
        `--${boundary}`,
        `Content-Disposition: form-data; name="businessId"\r\n\r\n${businessId}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const created = await BusinessGood.findOne({ name: "New Burger" });
      expect(created).not.toBeNull();
    });

    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"\r\n\r\nIncomplete Item',
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"\r\n\r\nTest Item',
        `--${boundary}`,
        'Content-Disposition: form-data; name="keyword"\r\n\r\ntestitem',
        `--${boundary}`,
        'Content-Disposition: form-data; name="mainCategory"\r\n\r\nFood',
        `--${boundary}`,
        'Content-Disposition: form-data; name="onMenu"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="available"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="sellingPrice"\r\n\r\n10.00',
        `--${boundary}`,
        'Content-Disposition: form-data; name="businessId"\r\n\r\ninvalid-id',
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Business ID is not valid!");
    });

    it("returns 400 for invalid mainCategory", async () => {
      const app = await getTestApp();

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"\r\n\r\nTest Item',
        `--${boundary}`,
        'Content-Disposition: form-data; name="keyword"\r\n\r\ntestitem',
        `--${boundary}`,
        'Content-Disposition: form-data; name="mainCategory"\r\n\r\nInvalidCategory',
        `--${boundary}`,
        'Content-Disposition: form-data; name="onMenu"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="available"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="sellingPrice"\r\n\r\n10.00',
        `--${boundary}`,
        `Content-Disposition: form-data; name="businessId"\r\n\r\n${businessId}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid main category!");
    });

    it("returns 400 for duplicate business good name", async () => {
      const app = await getTestApp();

      await BusinessGood.create({
        businessId,
        name: "Existing Item",
        keyword: "existingitem",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 10.00,
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"\r\n\r\nExisting Item',
        `--${boundary}`,
        'Content-Disposition: form-data; name="keyword"\r\n\r\nexistingitem',
        `--${boundary}`,
        'Content-Disposition: form-data; name="mainCategory"\r\n\r\nFood',
        `--${boundary}`,
        'Content-Disposition: form-data; name="onMenu"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="available"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="sellingPrice"\r\n\r\n10.00',
        `--${boundary}`,
        `Content-Disposition: form-data; name="businessId"\r\n\r\n${businessId}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("already exists");
    });
  });

  describe("PATCH /api/v1/businessGoods/:businessGoodId", () => {
    it("returns 400 for invalid businessGoodId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/businessGoods/invalid-id",
        headers: { "content-type": "multipart/form-data; boundary=----formdata" },
        payload: "------formdata--\r\n",
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 404 for non-existent business good", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"\r\n\r\nUpdated Item',
        `--${boundary}`,
        'Content-Disposition: form-data; name="keyword"\r\n\r\nupdateditem',
        `--${boundary}`,
        'Content-Disposition: form-data; name="mainCategory"\r\n\r\nFood',
        `--${boundary}`,
        'Content-Disposition: form-data; name="onMenu"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="available"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="sellingPrice"\r\n\r\n15.00',
        `--${boundary}`,
        `Content-Disposition: form-data; name="businessId"\r\n\r\n${businessId}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/businessGoods/${fakeId}`,
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(404);
    });

    it("updates business good successfully", async () => {
      const app = await getTestApp();

      const businessGood = await BusinessGood.create({
        businessId,
        name: "Original Item",
        keyword: "originalitem",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 10.00,
      });

      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="name"\r\n\r\nUpdated Item',
        `--${boundary}`,
        'Content-Disposition: form-data; name="keyword"\r\n\r\noriginalitem',
        `--${boundary}`,
        'Content-Disposition: form-data; name="mainCategory"\r\n\r\nFood',
        `--${boundary}`,
        'Content-Disposition: form-data; name="onMenu"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="available"\r\n\r\ntrue',
        `--${boundary}`,
        'Content-Disposition: form-data; name="sellingPrice"\r\n\r\n15.00',
        `--${boundary}`,
        `Content-Disposition: form-data; name="businessId"\r\n\r\n${businessId}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/businessGoods/${businessGood._id}`,
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload,
      });

      expect(response.statusCode).toBe(200);

      const updated = await BusinessGood.findById(businessGood._id);
      expect(updated?.name).toBe("Updated Item");
      expect(updated?.sellingPrice).toBe(15.00);
    });
  });

  describe("DELETE /api/v1/businessGoods/:businessGoodId", () => {
    it("returns 400 for invalid businessGoodId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/businessGoods/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessGoodId!");
    });
  });

  describe("GET /api/v1/businessGoods/business/:businessId", () => {
    it("lists business goods by business", async () => {
      const app = await getTestApp();

      await BusinessGood.create([
        {
          businessId,
          name: "Item 1",
          keyword: "item1",
          mainCategory: "Food",
          onMenu: true,
          available: true,
          sellingPrice: 10.00,
        },
        {
          businessId,
          name: "Item 2",
          keyword: "item2",
          mainCategory: "Beverage",
          onMenu: true,
          available: true,
          sellingPrice: 5.00,
        },
      ]);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/businessGoods/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(2);
    });

    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/businessGoods/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessId!");
    });

    it("returns 404 when business has no goods", async () => {
      const app = await getTestApp();
      const emptyBusinessId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/businessGoods/business/${emptyBusinessId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  /**
   * Phase 5 Task 5.3: Cloudinary Integration Tests
   * These tests call the REAL Cloudinary API (requires valid credentials in .env)
   */
  const hasCloudinaryCredentials = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  describe.skipIf(!hasCloudinaryCredentials)("Cloudinary Integration - POST /api/v1/businessGoods", () => {
    it("creates business good with image uploads", async () => {
      const app = await getTestApp();

      // Create a simple PNG image buffer (1x1 pixel)
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );

      const form = new FormData();
      form.append("name", `Cloud Product ${Date.now()}`);
      form.append("keyword", `cloudproduct${Date.now()}`);
      form.append("mainCategory", "Food");
      form.append("onMenu", "true");
      form.append("available", "true");
      form.append("sellingPrice", "12.99");
      form.append("businessId", businessId.toString());
      form.append("images", new Blob([pngBuffer], { type: "image/png" }), "product.png");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/businessGoods",
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(201);

      // Verify business good was created with image URL
      const created = await BusinessGood.findOne({ businessId }).sort({ _id: -1 }).lean();
      expect(created).not.toBeNull();
      expect(created?.imagesUrl).toBeDefined();
      expect(created?.imagesUrl?.length).toBeGreaterThan(0);
      expect(created?.imagesUrl?.[0]).toContain("cloudinary.com");
    });
  });

  describe.skipIf(!hasCloudinaryCredentials)("Cloudinary Integration - PATCH /api/v1/businessGoods/:businessGoodId", () => {
    it("updates business good with additional images", async () => {
      const app = await getTestApp();

      // Create business good first
      const businessGood = await BusinessGood.create({
        businessId,
        name: `Cloud Product ${Date.now()}`,
        keyword: `cloudproduct${Date.now()}`,
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 12.99,
        imagesUrl: ["https://existing-image.com/img.png"],
      });

      // Create a simple PNG image buffer
      const pngBuffer = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      );

      const form = new FormData();
      form.append("name", businessGood.name);
      form.append("keyword", businessGood.keyword);
      form.append("mainCategory", "Food");
      form.append("onMenu", "true");
      form.append("available", "true");
      form.append("sellingPrice", "12.99");
      form.append("businessId", businessId.toString());
      form.append("images", new Blob([pngBuffer], { type: "image/png" }), "additional.png");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/businessGoods/${businessGood._id}`,
        payload: form,
        headers: { "content-type": "multipart/form-data" },
      });

      expect(response.statusCode).toBe(200);

      // Verify image was added
      const updated = await BusinessGood.findById(businessGood._id).lean();
      expect(updated?.imagesUrl?.length).toBe(2);
      expect(updated?.imagesUrl?.some((url: string) => url.includes("cloudinary.com"))).toBe(true);
    });
  });
});
