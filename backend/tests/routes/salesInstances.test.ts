/**
 * SalesInstances Routes Tests - Phase 1 Module 5
 * Tests for sales instances CRUD endpoints
 *
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import { injectWithRouteAuth } from "../helpers/auth.ts";
import SalesInstance from "../../src/models/salesInstance.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";

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

describe("SalesInstances Routes", () => {
  let businessId: Types.ObjectId;
  let salesPointId: Types.ObjectId;
  let userId: Types.ObjectId;

  beforeEach(async () => {
    const business = await createTestBusiness({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: "test@restaurant.com",
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

    const salesPoint = await SalesPoint.create({
      businessId,
      salesPointName: "Table 1",
      salesPointType: "Table",
    });
    salesPointId = salesPoint._id;

    const user = await User.create({
      personalDetails: {
        email: "user@test.com",
        password: "hashedpassword",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "1234567890",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main St",
          buildingNumber: "123",
          postCode: "90001",
        },
        idNumber: "ID123456",
        idType: "Passport",
        username: "testuser",
      },
      allUserRoles: ["Customer"],
    });
    userId = user._id;
  });

  describe("GET /api/v1/salesInstances", () => {
    it("lists all sales instances", async () => {
      const app = await getTestApp();

      await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 4,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/salesInstances",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns 404 when no sales instances exist", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/salesInstances",
      });

      expect(response.statusCode).toBe(404);
    });

    it("returns a validation problem for an invalid includeDeleted query value", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/salesInstances?includeDeleted=maybe",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "includeDeleted" }),
        ]),
      );
    });
  });

  describe("GET /api/v1/salesInstances/:salesInstanceId", () => {
    it("gets sales instance by ID", async () => {
      const app = await getTestApp();

      const salesInstance = await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 2,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/salesInstances/${salesInstance._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.guests).toBe(2);
    });

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/salesInstances/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "salesInstanceId" }),
        ]),
      );
    });

    it("returns 404 for non-existent sales instance", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/salesInstances/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("SalesLocation not found!");
    });
  });

  describe("POST /api/v1/salesInstances", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances",
        payload: {
          salesPointId: salesPointId.toString(),
          guests: 4,
          businessId: businessId.toString(),
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("does not treat a soft-deleted sales instance as occupying the sales point", async () => {
      const app = await getTestApp();
      const manager = await User.create({
        personalDetails: {
          email: "opener@test.com",
          password: "hashedpassword",
          firstName: "Open",
          lastName: "Manager",
          phoneNumber: "1234567890",
          birthDate: new Date("1990-01-01"),
          gender: "Man",
          nationality: "USA",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main St",
            buildingNumber: "123",
            postCode: "90001",
          },
          idNumber: "ID-OPENER",
          idType: "Passport",
          username: "opener",
        },
      });
      await Employee.create({
        businessId,
        userId: manager._id,
        allEmployeeRoles: ["Manager"],
        taxNumber: "EMP-OPENER",
        joinDate: new Date(),
        active: true,
        onDuty: true,
        vacationDaysPerYear: 20,
      });
      const auth = await generateTestToken({
        id: String(manager._id),
        email: "opener@test.com",
        type: "user",
        role: "Manager",
      });

      await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 2,
        salesInstanceStatus: "Occupied",
        openedAsRole: "employee",
        openedByUserId: manager._id,
        deleted: true,
        deletedAt: new Date(),
      });

      const opened = await injectWithRouteAuth(app, {
        method: "POST",
        url: "/api/v1/salesInstances",
        headers: { authorization: auth },
        payload: {
          salesPointId: salesPointId.toString(),
          guests: 2,
          businessId: businessId.toString(),
        },
      });
      expect(opened.statusCode, opened.body).toBe(201);

      await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 2,
        guests: 2,
        salesInstanceStatus: "Occupied",
        openedAsRole: "employee",
        openedByUserId: manager._id,
      });

      const blocked = await injectWithRouteAuth(app, {
        method: "POST",
        url: "/api/v1/salesInstances",
        headers: { authorization: auth },
        payload: {
          salesPointId: salesPointId.toString(),
          guests: 2,
          businessId: businessId.toString(),
        },
      });
      const body = expectProblem(blocked, 409, "conflict");
      expect(body.detail).toBe(
        "SalesInstance already exists and it is not closed!",
      );
    });
  });



  describe("GET /api/v1/salesInstances/business/:businessId", () => {
    it("lists sales instances by business", async () => {
      const app = await getTestApp();

      await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 4,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/salesInstances/business/${businessId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
    });

    it("returns 400 for invalid businessId", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/salesInstances/business/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "businessId" })]),
      );
    });

    it("returns 404 when business has no sales instances", async () => {
      const app = await getTestApp();
      const emptyBusinessId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/salesInstances/business/${emptyBusinessId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No salesInstances found!");
    });
  });

  describe("GET /api/v1/salesInstances/user/:userId", () => {
    it("lists sales instances by user", async () => {
      const app = await getTestApp();

      await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 4,
        salesInstanceStatus: "Occupied",
        openedByUserId: userId,
      });

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/salesInstances/user/${userId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
    });

    it("returns 400 for invalid userId", async () => {
      const app = await getTestApp();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: "/api/v1/salesInstances/user/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "userId" })]),
      );
    });

    it("returns 404 when user has no sales instances", async () => {
      const app = await getTestApp();
      const emptyUserId = new Types.ObjectId();

      const response = await injectWithRouteAuth(app, {
        method: "GET",
        url: `/api/v1/salesInstances/user/${emptyUserId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No salesInstances found!");
    });
  });

  describe("PATCH /api/v1/salesInstances/:salesInstanceId/transferSalesPoint", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${fakeId}/transferSalesPoint`,
        payload: { salesPointId: salesPointId.toString() },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/salesInstances/delivery", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances/delivery",
        payload: {
          businessId: businessId.toString(),
          ordersArr: [],
          paymentMethodArr: [],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns the existing sitting when the same payment id is repeated, including after soft delete", async () => {
      const app = await getTestApp();
      const token = await generateTestToken({
        id: String(userId),
        email: "user@test.com",
        type: "user",
        role: "Customer",
      });
      const paymentId = "pay-delivery-retry";
      const sitting = await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 4,
        guests: 1,
        salesInstanceStatus: "Closed",
        openedAsRole: "customer",
        openedByUserId: userId,
        paymentId,
        deleted: true,
        deletedAt: new Date(),
        salesGroup: [{ orderCode: "DEL-1", ordersIds: [new Types.ObjectId()] }],
      });

      const response = await injectWithRouteAuth(app, {
        method: "POST",
        url: "/api/v1/salesInstances/delivery",
        headers: { authorization: token },
        payload: paymentRetryBody(businessId, paymentId),
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toEqual({
        message: "Delivery order already processed for this payment.",
        salesInstanceId: String(sitting._id),
      });
      expect(await SalesInstance.collection.countDocuments({ paymentId })).toBe(1);
    });
  });

  describe("POST /api/v1/salesInstances/selfOrderingLocation/:id", () => {
    it("returns the existing sitting when the same payment id is repeated, including after soft delete", async () => {
      const app = await getTestApp();
      const token = await generateTestToken({
        id: String(userId),
        email: "user@test.com",
        type: "user",
        role: "Customer",
      });
      const paymentId = "pay-self-retry";
      const sitting = await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 5,
        guests: 1,
        salesInstanceStatus: "Closed",
        openedAsRole: "customer",
        openedByUserId: userId,
        paymentId,
        deleted: true,
        deletedAt: new Date(),
        salesGroup: [{ orderCode: "SELF-1", ordersIds: [new Types.ObjectId()] }],
      });

      const response = await injectWithRouteAuth(app, {
        method: "POST",
        url: `/api/v1/salesInstances/selfOrderingLocation/${salesPointId}`,
        headers: { authorization: token },
        payload: paymentRetryBody(businessId, paymentId),
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toEqual({
        message: "Self-order already processed for this payment.",
        salesInstanceId: String(sitting._id),
      });
      expect(await SalesInstance.collection.countDocuments({ paymentId })).toBe(1);
    });
  });
});

function paymentRetryBody(businessId: Types.ObjectId, paymentId: string) {
  return {
    businessId: businessId.toString(),
    paymentId,
    ordersArr: [
      {
        businessGoodId: new Types.ObjectId().toString(),
        orderGrossPrice: 10,
        orderNetPrice: 10,
        orderCostPrice: 3,
      },
    ],
    paymentMethodArr: [
      {
        paymentMethodType: "Cash",
        methodBranch: "Cash",
        methodSalesTotal: 10,
      },
    ],
  };
}
