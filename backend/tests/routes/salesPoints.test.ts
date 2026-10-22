/**
 * SalesPoints Routes Tests - Phase 1 Module 6 + Phase 5 Task 5.1
 * Tests for sales points CRUD endpoints
 *
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 *
 * Phase 5 Note: Cloudinary integration tests are skipped due to ESM module caching
 * limitation in Vitest. See describe.skipIf blocks at the end for details.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import Business from "../../src/models/business.ts";

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

  const expectProblem = (
    response: {
      statusCode: number;
      headers: Record<string, unknown>;
      json: () => any;
    },
    status: number,
    typeSlug: string,
  ) => {
    expect(response.statusCode).toBe(status);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    const body = response.json();
    expect(body.type).toBe(`https://restaurant-pos.app/errors/${typeSlug}`);
    expect(body.status).toBe(status);
    return body;
  };

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

    it("returns a not-found problem when no sales points exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/salesPoints",
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No salesPoints found!");
    });
  });

  describe("POST /api/v1/salesPoints", () => {
    it("returns a validation problem for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {},
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "salesPointName" }),
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {
          salesPointName: "New Table",
          businessId: "invalid-id",
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "businessId" })]),
      );
    });

    it("returns a validation problem for an invalid salesPointType", async () => {
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

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "salesPointType" }),
        ]),
      );
    });

    it("rejects the server-owned qrCode as an unknown key", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {
          salesPointName: "New Table",
          businessId: businessId.toString(),
          qrCode: "https://example.com/qr.png",
        },
      });

      expectProblem(response, 400, "validation");
    });

    it("returns a conflict problem for a duplicate sales point name", async () => {
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

      const body = expectProblem(response, 409, "conflict");
      expect(body.detail).toBe("SalesPoint already exists!");
    });

    it("returns a conflict problem for a second delivery sales point", async () => {
      const app = await getTestApp();

      await SalesPoint.create({
        businessId,
        salesPointName: "Delivery",
        salesPointType: "delivery",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {
          salesPointName: "Delivery 2",
          businessId: businessId.toString(),
          salesPointType: "delivery",
        },
      });

      const body = expectProblem(response, 409, "conflict");
      expect(body.detail).toBe(
        "This business already has a delivery sales point.",
      );
    });

    it("creates a delivery sales point and normalizes the type", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesPoints",
        payload: {
          salesPointName: "  <b>Delivery</b>  1 ",
          businessId: businessId.toString(),
          salesPointType: "DELIVERY",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().message).toBe("Sales Point created");

      const created = await SalesPoint.findOne({
        salesPointName: "Delivery 1",
      }).lean();
      expect(created).not.toBeNull();
      expect(created?.salesPointType).toBe("delivery");
      expect(created?.selfOrdering).toBe(false);
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

    it("returns a validation problem for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/salesPoints/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "salesPointId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent sales point", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/salesPoints/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No salesPoint found!");
    });
  });

  describe("PATCH /api/v1/salesPoints/:salesPointId", () => {
    it("returns a validation problem for an invalid salesPointId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/salesPoints/invalid-id",
        payload: { salesPointName: "Updated Name" },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "salesPointId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent sales point", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesPoints/${fakeId}`,
        payload: { salesPointName: "Updated Name" },
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("SalesPoint not found!");
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

    it("updates selfOrdering alone without a duplicate-name conflict", async () => {
      const app = await getTestApp();

      const salesPoint = await SalesPoint.create({
        businessId,
        salesPointName: "Table 9",
        salesPointType: "table",
      });
      await SalesPoint.create({
        businessId,
        salesPointName: "Table 10",
        salesPointType: "table",
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesPoints/${salesPoint._id}`,
        payload: { selfOrdering: true },
      });

      expect(response.statusCode).toBe(200);

      const updated = await SalesPoint.findById(salesPoint._id);
      expect(updated?.selfOrdering).toBe(true);
    });

    it("returns a conflict problem for a duplicate sales point name on update", async () => {
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

      const body = expectProblem(response, 409, "conflict");
      expect(body.detail).toBe("SalesPointName already exists!");
    });
  });

  describe("DELETE /api/v1/salesPoints/:salesPointId", () => {
    it("returns a validation problem for an invalid salesPointId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/salesPoints/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "salesPointId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent sales point", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/salesPoints/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("SalesPoint not found!");
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

      const deleted = await SalesPoint.findById(salesPoint._id).lean();
      expect(deleted?.deleted).toBe(true);
      expect(deleted?.deletedAt).toBeDefined();
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

      // Verify it was soft-deleted in database
      const deleted = await SalesPoint.findById(salesPoint?._id).lean();
      expect(deleted?.deleted).toBe(true);
      expect(deleted?.deletedAt).toBeDefined();
    });
  });
});
