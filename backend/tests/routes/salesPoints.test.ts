/**
 * SalesPoints Routes Tests - Phase 1 Module 6 + Phase 5 Task 5.1
 * Tests for sales points CRUD endpoints
 * 
 * Phase 5 Note: Cloudinary integration tests are skipped due to ESM module caching
 * limitation in Vitest. See describe.skip blocks at the end for details.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.js";
import SalesPoint from "../../src/models/salesPoint.js";
import Business from "../../src/models/business.js";

describe("SalesPoints Routes", () => {
  let businessId: Types.ObjectId;

  beforeEach(async () => {
    const business = await Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: `test${Date.now()}@restaurant.com`,
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: `TAX-${Date.now()}`,
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

  describe("GET /api/v1/salesPoints", () => {
    it("lists all sales points", async () => {
      const app = await getTestApp();

      await SalesPoint.create({
        businessId,
        salesPointName: "Table 1",
        salesPointType: "table",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/salesPoints",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].salesPointName).toBe("Table 1");
    });

    it("returns 400 when no sales points exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/salesPoints",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No salesPoints found!");
    });
  });

  describe("POST /api/v1/salesPoints", () => {
    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("SalesPointName and businessId are required!");
    });

    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {
          salesPointName: "New Table",
          businessId: "invalid-id",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessId!");
    });

    it("returns 400 for invalid salesPointType", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {
          salesPointName: "New Table",
          businessId: businessId.toString(),
          salesPointType: "InvalidType",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("salesPointType must be one of");
    });

    it("returns 400 for duplicate sales point name", async () => {
      const app = await getTestApp();

      await SalesPoint.create({
        businessId,
        salesPointName: "Existing Table",
        salesPointType: "table",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {
          salesPointName: "Existing Table",
          businessId: businessId.toString(),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("SalesPoint already exists!");
    });
  });

  describe("GET /api/v1/salesPoints/:salesPointId", () => {
    it("gets sales point by ID", async () => {
      const app = await getTestApp();

      const salesPoint = await SalesPoint.create({
        businessId,
        salesPointName: "Table 5",
        salesPointType: "table",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/salesPoints/${salesPoint._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.salesPointName).toBe("Table 5");
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/salesPoints/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid salesPointId!");
    });

    it("returns 400 for non-existent sales point", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/salesPoints/${fakeId}`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("No salesPoint found!");
    });
  });

  describe("PATCH /api/v1/salesPoints/:salesPointId", () => {
    it("returns 400 for invalid salesPointId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/salesPoints/invalid-id",
        payload: { salesPointName: "Updated Name" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid salesPointId!");
    });

    it("returns 404 for non-existent sales point", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesPoints/${fakeId}`,
        payload: { salesPointName: "Updated Name" },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("SalesPoint not found!");
    });

    it("updates sales point successfully", async () => {
      const app = await getTestApp();

      const salesPoint = await SalesPoint.create({
        businessId,
        salesPointName: "Original Table",
        salesPointType: "table",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesPoints/${salesPoint._id}`,
        payload: { salesPointName: "Updated Table" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Sales point updated successfully!");

      const updated = await SalesPoint.findById(salesPoint._id);
      expect(updated?.salesPointName).toBe("Updated Table");
    });

    it("returns 400 for duplicate sales point name on update", async () => {
      const app = await getTestApp();

      await SalesPoint.create({
        businessId,
        salesPointName: "Table A",
        salesPointType: "table",
      });

      const salesPointB = await SalesPoint.create({
        businessId,
        salesPointName: "Table B",
        salesPointType: "table",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesPoints/${salesPointB._id}`,
        payload: { salesPointName: "Table A" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("SalesPointName already exists!");
    });
  });

  describe("DELETE /api/v1/salesPoints/:salesPointId", () => {
    it("returns 400 for invalid salesPointId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/salesPoints/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid salesPointId!");
    });

    it("returns 404 for non-existent sales point", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/salesPoints/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("SalesPoint not found!");
    });

    it("deletes sales point successfully", async () => {
      const app = await getTestApp();

      const salesPoint = await SalesPoint.create({
        businessId,
        salesPointName: "To Delete",
        salesPointType: "table",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/salesPoints/${salesPoint._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Sales point deleted successfully");

      const deleted = await SalesPoint.findById(salesPoint._id);
      expect(deleted).toBeNull();
    });
  });

  /**
   * Phase 5 Task 5.1: Cloudinary Integration Tests
   * These tests call the REAL Cloudinary API (requires valid credentials in .env)
   */
  const hasCloudinaryCredentials = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  describe.skipIf(!hasCloudinaryCredentials)("Cloudinary Integration - POST /api/v1/salesPoints", () => {
    it("creates sales point with QR code generation", async () => {
      const app = await getTestApp();
      const salesPointName = `Table QR ${Date.now()}`;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {
          salesPointName,
          businessId: businessId.toString(),
          salesPointType: "table",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("created");

      // Verify QR code was generated and saved
      const created = await SalesPoint.findOne({ salesPointName }).lean();
      expect(created).not.toBeNull();
      expect(created?.qrCode).toBeDefined();
      expect(created?.qrCode).toContain("cloudinary.com");
    });

    it("skips QR code generation for delivery sales point", async () => {
      const app = await getTestApp();
      const salesPointName = `Delivery ${Date.now()}`;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {
          salesPointName,
          businessId: businessId.toString(),
          salesPointType: "delivery",
        },
      });

      expect(response.statusCode).toBe(201);

      // Verify no QR code for delivery type
      const created = await SalesPoint.findOne({ salesPointName }).lean();
      expect(created).not.toBeNull();
      expect(created?.qrCode).toBeUndefined();
    });
  });

  describe.skipIf(!hasCloudinaryCredentials)("Cloudinary Integration - DELETE /api/v1/salesPoints/:salesPointId", () => {
    it("deletes sales point and cleans up QR code", async () => {
      const app = await getTestApp();
      const salesPointName = `ToDelete ${Date.now()}`;

      // First create a sales point with QR code
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {
          salesPointName,
          businessId: businessId.toString(),
          salesPointType: "table",
        },
      });

      expect(createResponse.statusCode).toBe(201);

      // Get the created sales point
      const salesPoint = await SalesPoint.findOne({ salesPointName }).lean();
      expect(salesPoint).not.toBeNull();
      expect(salesPoint?.qrCode).toContain("cloudinary.com");

      // Delete the sales point
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/salesPoints/${salesPoint?._id}`,
      });

      expect(deleteResponse.statusCode).toBe(200);
      const body = JSON.parse(deleteResponse.body);
      expect(body.message).toBe("Sales point deleted successfully");

      // Verify it was deleted from database
      const deleted = await SalesPoint.findById(salesPoint?._id);
      expect(deleted).toBeNull();
    });
  });
});
