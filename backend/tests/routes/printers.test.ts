/**
 * Printers Routes Tests - Phase 1 Module 21 + Phase 4 Task 4.9
 * Tests for printers CRUD endpoints with transaction verification
 * Phase 4: Full transaction tests for DELETE with backup cleanup (requires replica set)
 *
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import Printer from "../../src/models/printer.ts";
import Business from "../../src/models/business.ts";

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
  expect(response.headers["content-type"]).toContain("application/problem+json");
  const body = response.json();
  expect(body.type).toBe(`https://restaurant-pos.app/errors/${typeSlug}`);
  expect(body.status).toBe(status);
  return body;
};

describe("Printers Routes", () => {
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

  const createTestPrinter = async (businessId: Types.ObjectId, alias?: string) => {
    return await Printer.create({
      businessId,
      printerAlias: alias || `Printer-${Date.now()}`,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      port: 9100,
      printerStatus: "Offline",
    });
  };

  describe("GET /api/v1/printers", () => {
    it("lists all printers", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPrinter(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/printers",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it("returns a not-found problem when no printers exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/printers",
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toContain("No printers");
    });
  });

  describe("POST /api/v1/printers", () => {
    it("returns a validation problem for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/printers",
        payload: { printerAlias: "Test Printer" },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "ipAddress" }),
          expect.objectContaining({ path: "port" }),
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });

    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/printers",
        payload: {
          printerAlias: "Test Printer",
          ipAddress: "192.168.1.100",
          port: 9100,
          businessId: "invalid-id",
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "businessId" })]),
      );
    });

    it("returns a validation problem for an invalid backupPrinterId", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/printers",
        payload: {
          printerAlias: "Test Printer",
          ipAddress: "192.168.1.100",
          port: 9100,
          businessId: business._id,
          backupPrinterId: "invalid-id",
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "backupPrinterId" }),
        ]),
      );
    });

    it("returns a validation problem for invalid employeesAllowedToPrintDataIds", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/printers",
        payload: {
          printerAlias: "Test Printer",
          ipAddress: "192.168.1.100",
          port: 9100,
          businessId: business._id,
          employeesAllowedToPrintDataIds: ["invalid-id"],
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "employeesAllowedToPrintDataIds.0",
          }),
        ]),
      );
    });

    it("returns a validation problem for unknown keys", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/printers",
        payload: {
          printerAlias: "Test Printer",
          ipAddress: "192.168.1.100",
          port: 9100,
          businessId: business._id,
          printerStatus: "Online",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
    });

    it("returns a conflict problem for a duplicate printer", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPrinter(business._id as Types.ObjectId, "Duplicate Printer");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/printers",
        payload: {
          printerAlias: "Duplicate Printer",
          ipAddress: "192.168.1.200",
          port: 9100,
          businessId: business._id,
        },
      });

      const body = expectProblem(response, 409, "conflict");
      expect(body.detail).toContain("already exists");
    });
  });

  describe("GET /api/v1/printers/:printerId", () => {
    it("returns a validation problem for an invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/printers/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "printerId" })]),
      );
    });

    it("returns a not-found problem for a non-existent printer", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/printers/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Printer not found!");
    });

    it("gets printer by ID", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const printer = await createTestPrinter(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/printers/${printer._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(printer._id.toString());
    });
  });

  describe("PATCH /api/v1/printers/:printerId", () => {
    it("returns a validation problem for an invalid printerId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/printers/invalid-id",
        payload: { printerAlias: "Updated" },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "printerId" })]),
      );
    });

    it("returns a not-found problem for a non-existent printer", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${fakeId}`,
        payload: { printerAlias: "Updated" },
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Printer not found!");
    });

    it("returns a validation problem for an invalid backupPrinterId", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const printer = await createTestPrinter(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${printer._id}`,
        payload: { backupPrinterId: "invalid-id" },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "backupPrinterId" }),
        ]),
      );
    });

    it("updates a printer", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const printer = await createTestPrinter(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${printer._id}`,
        payload: { printerAlias: "Renamed Printer" },
      });

      expect(response.statusCode).toBe(200);
      const updated = await Printer.findById(printer._id).lean();
      expect(updated?.printerAlias).toBe("Renamed Printer");
    });
  });

  describe("DELETE /api/v1/printers/:printerId", () => {
    it("returns a validation problem for an invalid printerId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/printers/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "printerId" })]),
      );
    });
  });

  describe("PATCH /api/v1/printers/:printerId/addConfigurationSetup", () => {
    it("returns a validation problem for an invalid printerId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/printers/invalid-id/addConfigurationSetup",
        payload: {
          mainCategory: "Food",
          salesPointIds: [new Types.ObjectId()],
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "printerId" })]),
      );
    });

    it("returns a validation problem for missing salesPointIds", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${fakeId}/addConfigurationSetup`,
        payload: {
          mainCategory: "Food",
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "salesPointIds" })]),
      );
    });

    it("returns a validation problem for an invalid excludeEmployeeIds", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${fakeId}/addConfigurationSetup`,
        payload: {
          mainCategory: "Food",
          salesPointIds: [new Types.ObjectId()],
          excludeEmployeeIds: ["invalid-id"],
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "excludeEmployeeIds.0" }),
        ]),
      );
    });

    it("returns a validation problem for a mainCategory outside the enum", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${fakeId}/addConfigurationSetup`,
        payload: {
          mainCategory: "Bogus",
          salesPointIds: [new Types.ObjectId()],
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "mainCategory" })]),
      );
    });

    it("returns a not-found problem when the printer does not exist", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${fakeId}/addConfigurationSetup`,
        payload: {
          mainCategory: "Food",
          salesPointIds: [new Types.ObjectId()],
        },
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("PrinterId not found!");
    });
  });

  describe("PATCH /api/v1/printers/:printerId/deleteConfigurationSetup/:configId", () => {
    it("returns a validation problem for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/printers/invalid-id/deleteConfigurationSetup/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "printerId" }),
          expect.objectContaining({ path: "configId" }),
        ]),
      );
    });

    it("returns a not-found problem for a non-existent printer", async () => {
      const app = await getTestApp();
      const fakeId1 = new Types.ObjectId();
      const fakeId2 = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${fakeId1}/deleteConfigurationSetup/${fakeId2}`,
      });

      expectProblem(response, 404, "not-found");
    });
  });

  describe("PATCH /api/v1/printers/:printerId/editConfigurationSetup/:configId", () => {
    it("returns a validation problem for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/printers/invalid-id/editConfigurationSetup/invalid-id",
        payload: {
          mainCategory: "Food",
          salesPointIds: [new Types.ObjectId()],
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "printerId" }),
          expect.objectContaining({ path: "configId" }),
        ]),
      );
    });

    it("returns a validation problem for missing salesPointIds", async () => {
      const app = await getTestApp();
      const fakeId1 = new Types.ObjectId();
      const fakeId2 = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${fakeId1}/editConfigurationSetup/${fakeId2}`,
        payload: {
          mainCategory: "Food",
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "salesPointIds" })]),
      );
    });
  });

  describe("GET /api/v1/printers/business/:businessId", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/printers/business/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "businessId" })]),
      );
    });

    it("returns a not-found problem when no printers for business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/printers/business/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toContain("No printers");
    });

    it("lists printers by business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPrinter(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/printers/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Phase 4 Task 4.9: Transaction Tests for DELETE with backup cleanup
  describe("Transaction Tests - DELETE /api/v1/printers/:printerId", () => {
    it("deletes printer successfully", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const printer = await createTestPrinter(business._id as Types.ObjectId, "ToDelete");

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/printers/${printer._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("deleted");

      // Verify printer was actually deleted
      const deletedPrinter = await Printer.findById(printer._id);
      expect(deletedPrinter).toBeNull();
    });

    it("deletes printer and clears backup references", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();

      // Create backup printer
      const backupPrinter = await Printer.create({
        businessId: business._id,
        printerAlias: "Backup Printer",
        ipAddress: "192.168.1.50",
        port: 9100,
        printerStatus: "Offline",
      });

      // Create main printer with backup reference
      const mainPrinter = await Printer.create({
        businessId: business._id,
        printerAlias: "Main Printer",
        ipAddress: "192.168.1.51",
        port: 9100,
        printerStatus: "Offline",
        backupPrinterId: backupPrinter._id,
      });

      // Verify backup reference exists
      const printerBefore = await Printer.findById(mainPrinter._id).lean();
      expect(printerBefore?.backupPrinterId?.toString()).toBe(backupPrinter._id.toString());

      // Delete the backup printer
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/printers/${backupPrinter._id}`,
      });

      expect(response.statusCode).toBe(200);

      // Verify backup reference was cleared from main printer
      const printerAfter = await Printer.findById(mainPrinter._id).lean();
      expect(printerAfter?.backupPrinterId).toBeUndefined();
    });

    it("returns a not-found problem for a non-existent printer", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/printers/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Printer not found!");
    });
  });
});
