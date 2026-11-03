/**
 * Printers Routes Tests — read routes.
 *
 * The unsafe legacy mutations are retired until their build-order row lands.
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import { injectWithRouteAuth } from "../helpers/auth.ts";
import Printer from "../../src/models/printer.ts";
import { createTestBusiness as createCompanyAwareBusiness } from "../helpers/fixtures.ts";

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
    return await createCompanyAwareBusiness({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: `test${Date.now()}@restaurant.com`,
      phoneNumber: "1234567890",
      taxNumber: `TAX-${Date.now()}`,
      currencyTrade: "USD",
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

  const createTestPrinter = async (
    businessId: Types.ObjectId,
    alias?: string,
    opts?: { deleted?: boolean },
  ) => {
    return await Printer.create({
      businessId,
      printerAlias: alias || `Printer-${Date.now()}`,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      port: 9100,
      printerStatus: "Offline",
      deleted: opts?.deleted,
      deletedAt: opts?.deleted ? new Date() : undefined,
    });
  };

  describe("GET /api/v1/printers", () => {
    it("lists all printers", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPrinter(business._id as Types.ObjectId);
      await createTestPrinter(
        business._id as Types.ObjectId,
        "Deleted Printer",
        { deleted: true },
      );

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/printers",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("includes deleted printers when includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPrinter(business._id as Types.ObjectId);
      await createTestPrinter(
        business._id as Types.ObjectId,
        "Deleted Printer",
        { deleted: true },
      );

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/printers?includeDeleted=true",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBe(2);
    });

    it("returns a not-found problem when no printers exist", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/printers",
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toContain("No printers");
    });

    it("returns a validation problem for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/printers?includeDeleted=maybe",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "includeDeleted" }),
        ]),
      );
    });
  });


  describe("GET /api/v1/printers/:printerId", () => {
    it("returns a validation problem for an invalid ID", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/printers/${printer._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body._id).toBe(printer._id.toString());
    });

    it("returns not-found for soft-deleted printer by default", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const printer = await createTestPrinter(
        business._id as Types.ObjectId,
        "Soft Deleted Printer",
        { deleted: true },
      );

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/printers/${printer._id}`,
      });
      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Printer not found!");
    });

    it("returns soft-deleted printer when includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const printer = await createTestPrinter(
        business._id as Types.ObjectId,
        "Soft Deleted Printer",
        { deleted: true },
      );

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/printers/${printer._id}?includeDeleted=true`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().deleted).toBe(true);
    });
  });






  describe("GET /api/v1/printers/business/:businessId", () => {
    it("returns a validation problem for an invalid businessId", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
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
      await createTestPrinter(
        business._id as Types.ObjectId,
        "Deleted Printer",
        { deleted: true },
      );

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/printers/business/${business._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("lists deleted printers by business when includeDeleted=true", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      await createTestPrinter(business._id as Types.ObjectId);
      await createTestPrinter(
        business._id as Types.ObjectId,
        "Deleted Printer",
        { deleted: true },
      );

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/printers/business/${business._id}?includeDeleted=true`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().length).toBe(2);
    });
  });

});
