/**
 * SalesPoints Routes Tests — read routes.
 *
 * The unsafe legacy mutations are retired until their build-order row lands.
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.ts";
import { injectWithRouteAuth } from "../helpers/auth.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";

describe("SalesPoints Routes", () => {
  let businessId: Types.ObjectId;

  beforeEach(async () => {
    const business = await createTestBusiness({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: `test${Date.now()}@restaurant.com`,
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

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/salesPoints",
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No salesPoints found!");
    });

    it("returns a validation problem for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/salesPoints?includeDeleted=maybe",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "includeDeleted" }),
        ]),
      );
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/salesPoints/${salesPoint._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.salesPointName).toBe("Table 5");
    });

    it("returns a validation problem for an invalid ID format", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
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

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/salesPoints/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No salesPoint found!");
    });
  });




});
