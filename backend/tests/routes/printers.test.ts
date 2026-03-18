/**
 * Printers Routes Tests - Phase 1 Module 21 + Phase 4 Task 4.9
 * Tests for printers CRUD endpoints with transaction verification
 * Phase 4: Full transaction tests for DELETE with backup cleanup (requires replica set)
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.js";
import Printer from "../../src/models/printer.js";
import Business from "../../src/models/business.js";

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

    it("returns 404 when no printers exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/printers",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No printers");
    });
  });

  describe("POST /api/v1/printers", () => {
    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/printers",
        payload: { printerAlias: "Test Printer" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("required");
    });

    it("returns 400 for invalid businessId", async () => {
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

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessId!");
    });

    it("returns 400 for invalid backupPrinterId", async () => {
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

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid backupPrinterId!");
    });

    it("returns 400 for invalid employeesAllowedToPrintDataIds", async () => {
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

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("EmployeesAllowedToPrintDataIds");
    });

    it("returns 400 for duplicate printer", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const existingPrinter = await createTestPrinter(business._id as Types.ObjectId, "Duplicate Printer");

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

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("already exists");
    });
  });

  describe("GET /api/v1/printers/:printerId", () => {
    it("returns 400 for invalid ID", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/printers/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid printerId!");
    });

    it("returns 404 for non-existent printer", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/printers/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Printer not found!");
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
    it("returns 400 for invalid printerId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/printers/invalid-id",
        payload: { printerAlias: "Updated" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid printerId!");
    });

    it("returns 404 for non-existent printer", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${fakeId}`,
        payload: { printerAlias: "Updated" },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Printer not found!");
    });

    it("returns 400 for invalid backupPrinterId", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const printer = await createTestPrinter(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${printer._id}`,
        payload: { backupPrinterId: "invalid-id" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid backupPrinterId!");
    });
  });

  describe("DELETE /api/v1/printers/:printerId", () => {
    it("returns 400 for invalid printerId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/printers/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid printerId!");
    });
  });

  describe("PATCH /api/v1/printers/:printerId/addConfigurationSetup", () => {
    it("returns 400 for invalid printerId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/printers/invalid-id/addConfigurationSetup",
        payload: {
          mainCategory: "Food",
          salesPointIds: [new Types.ObjectId()],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid printId!");
    });

    it("returns 400 for missing salesPointIds", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${fakeId}/addConfigurationSetup`,
        payload: {
          mainCategory: "Food",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("salesPointIds");
    });

    it("returns 400 for invalid excludeEmployeeIds", async () => {
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

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("ExcludeEmployeeIds");
    });
  });

  describe("PATCH /api/v1/printers/:printerId/deleteConfigurationSetup/:configId", () => {
    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/printers/invalid-id/deleteConfigurationSetup/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid");
    });

    it("returns 404 for non-existent printer/config", async () => {
      const app = await getTestApp();
      const fakeId1 = new Types.ObjectId();
      const fakeId2 = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/printers/${fakeId1}/deleteConfigurationSetup/${fakeId2}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/v1/printers/:printerId/editConfigurationSetup/:configId", () => {
    it("returns 400 for invalid IDs", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/printers/invalid-id/editConfigurationSetup/invalid-id",
        payload: {
          mainCategory: "Food",
          salesPointIds: [new Types.ObjectId()],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("Invalid");
    });

    it("returns 400 for missing salesPointIds", async () => {
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

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("salesPointIds");
    });
  });

  describe("GET /api/v1/printers/business/:businessId", () => {
    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/printers/business/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid businessId!");
    });

    it("returns 404 when no printers for business", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/printers/business/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toContain("No printers");
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

    it("returns 404 for non-existent printer", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/printers/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Printer not found!");
    });
  });
});
