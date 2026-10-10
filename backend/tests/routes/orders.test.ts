/**
 * Orders Routes Tests - Phase 1 Module 4
 * Tests for order CRUD endpoints
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Order from "../../src/models/order.ts";
import Business from "../../src/models/business.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import Notification from "../../src/models/notification.ts";
import SalesInstance from "../../src/models/salesInstance.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import User from "../../src/models/user.ts";
import sendOrderConfirmation from "../../src/orderConfirmation/sendOrderConfirmation.ts";

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

const hasErrorPath = (
  body: { errors?: Array<{ path: string }> },
  fragment: string,
) => body.errors?.some((issue) => issue.path.includes(fragment)) ?? false;

describe("Orders Routes", () => {
  let businessId: Types.ObjectId;
  let businessGoodId: Types.ObjectId;
  let salesInstanceId: Types.ObjectId;
  let salesPointId: Types.ObjectId;
  let userId: Types.ObjectId;

  const authFor = (id: Types.ObjectId) =>
    generateTestToken({
      id: String(id),
      email: "user@test.com",
      type: "user",
      role: "Customer",
    });

  const validOrderItem = () => ({
    businessGoodId: businessGoodId.toString(),
    orderGrossPrice: 12.99,
    orderNetPrice: 12.99,
    orderCostPrice: 4,
  });

  const validBody = () => ({
    ordersArr: [validOrderItem()],
    salesInstanceId: salesInstanceId.toString(),
    businessId: businessId.toString(),
    dailyReferenceNumber: 1,
  });

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

    const salesPoint = await SalesPoint.create({
      businessId,
      salesPointName: "Main Counter",
      salesPointType: "Counter",
    });
    salesPointId = salesPoint._id;

    const salesInstance = await SalesInstance.create({
      businessId,
      salesPointId,
      dailyReferenceNumber: 1,
      guests: 2,
      salesInstanceStatus: "Occupied",
    });
    salesInstanceId = salesInstance._id;

    const businessGood = await BusinessGood.create({
      businessId,
      name: "Burger",
      keyword: "burger",
      mainCategory: "Food",
      onMenu: true,
      available: true,
      sellingPrice: 12.99,
      costPrice: 4.00,
    });
    businessGoodId = businessGood._id;

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

  describe("GET /api/v1/orders", () => {
    it("lists all orders", async () => {
      const app = await getTestApp();

      await Order.create({
        businessId,
        businessGoodId,
        salesInstanceId,
        createdByUserId: userId,
        dailyReferenceNumber: 1,
        billingStatus: "Open",
        orderGrossPrice: 12.99,
        orderNetPrice: 12.99,
        orderCostPrice: 4.00,
        orderStatus: "Done",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/orders",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
    });

    it("returns a not-found problem when no orders exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/orders",
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No orders found!");
    });
  });

  describe("GET /api/v1/orders/:orderId", () => {
    it("gets order by ID", async () => {
      const app = await getTestApp();

      const order = await Order.create({
        businessId,
        businessGoodId,
        salesInstanceId,
        createdByUserId: userId,
        dailyReferenceNumber: 1,
        billingStatus: "Open",
        orderGrossPrice: 12.99,
        orderNetPrice: 12.99,
        orderCostPrice: 4.00,
        orderStatus: "Done",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/orders/${order._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.orderGrossPrice).toBe(12.99);
    });

    it("returns a validation problem for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/orders/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(hasErrorPath(body, "orderId")).toBe(true);
    });

    it("returns a not-found problem for non-existent order", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/orders/${fakeId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Order not found!");
    });
  });

  describe("POST /api/v1/orders", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: validBody(),
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 401 with an invalid token", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: "Bearer invalid-token" },
        payload: validBody(),
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns a validation problem for missing required fields", async () => {
      const app = await getTestApp();
      const auth = await authFor(userId);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: auth },
        payload: {},
      });

      const body = expectProblem(response, 400, "validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "ordersArr" }),
          expect.objectContaining({ path: "salesInstanceId" }),
          expect.objectContaining({ path: "businessId" }),
          expect.objectContaining({ path: "dailyReferenceNumber" }),
        ]),
      );
    });

    it("returns a validation problem for an empty ordersArr", async () => {
      const app = await getTestApp();
      const auth = await authFor(userId);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: auth },
        payload: { ...validBody(), ordersArr: [] },
      });

      const body = expectProblem(response, 400, "validation");
      expect(hasErrorPath(body, "ordersArr")).toBe(true);
    });

    it("returns a validation problem for a malformed businessGoodId", async () => {
      const app = await getTestApp();
      const auth = await authFor(userId);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: auth },
        payload: {
          ...validBody(),
          ordersArr: [{ ...validOrderItem(), businessGoodId: "invalid-id" }],
        },
      });

      const body = expectProblem(response, 400, "validation");
      expect(hasErrorPath(body, "businessGoodId")).toBe(true);
    });

    it("rejects unknown keys", async () => {
      const app = await getTestApp();
      const auth = await authFor(userId);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: auth },
        payload: { ...validBody(), isAdmin: true },
      });

      expectProblem(response, 400, "validation");
    });

    it("rejects a server-owned order field", async () => {
      const app = await getTestApp();
      const auth = await authFor(userId);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: auth },
        payload: {
          ...validBody(),
          ordersArr: [{ ...validOrderItem(), billingStatus: "Paid" }],
        },
      });

      expectProblem(response, 400, "validation");
    });

    it("preserves the ordersArrValidation price-presence post-parse check", async () => {
      const app = await getTestApp();
      const auth = await authFor(userId);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: auth },
        payload: {
          ...validBody(),
          ordersArr: [{ ...validOrderItem(), orderGrossPrice: 0 }],
        },
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe("orderGrossPrice must have a value!");
    });
  });

  describe("DELETE /api/v1/orders/:orderId", () => {
    it("returns 401 without authentication for invalid orderId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/orders/invalid-id",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 401 without authentication for valid orderId", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/orders/${fakeId}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns a validation problem for an invalid orderId when authenticated", async () => {
      const app = await getTestApp();
      const auth = await authFor(userId);

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/orders/invalid-id",
        headers: { authorization: auth },
      });

      const body = expectProblem(response, 400, "validation");
      expect(hasErrorPath(body, "orderId")).toBe(true);
    });
  });

  describe("GET /api/v1/orders/salesInstance/:salesInstanceId", () => {
    it("lists orders by sales instance", async () => {
      const app = await getTestApp();

      await Order.create({
        businessId,
        businessGoodId,
        salesInstanceId,
        createdByUserId: userId,
        dailyReferenceNumber: 1,
        billingStatus: "Open",
        orderGrossPrice: 12.99,
        orderNetPrice: 12.99,
        orderCostPrice: 4.00,
        orderStatus: "Done",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/orders/salesInstance/${salesInstanceId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
    });

    it("returns a validation problem for invalid salesInstanceId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/orders/salesInstance/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(hasErrorPath(body, "salesInstanceId")).toBe(true);
    });

    it("returns a not-found problem when no orders found", async () => {
      const app = await getTestApp();
      const emptySalesInstanceId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/orders/salesInstance/${emptySalesInstanceId}`,
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("No orders found!");
    });
  });

  describe("GET /api/v1/orders/user/:userId", () => {
    it("lists orders by user", async () => {
      const app = await getTestApp();

      await Order.create({
        businessId,
        businessGoodId,
        salesInstanceId,
        createdByUserId: userId,
        dailyReferenceNumber: 1,
        billingStatus: "Open",
        orderGrossPrice: 12.99,
        orderNetPrice: 12.99,
        orderCostPrice: 4.00,
        orderStatus: "Done",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/orders/user/${userId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
    });

    it("returns a validation problem for invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/orders/user/invalid-id",
      });

      const body = expectProblem(response, 400, "validation");
      expect(hasErrorPath(body, "userId")).toBe(true);
    });

    it("returns a not-found problem when user has no orders", async () => {
      const app = await getTestApp();
      const emptyUserId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/orders/user/${emptyUserId}`,
      });

      expectProblem(response, 404, "not-found");
    });
  });

  describe("Order confirmation side-effects", () => {
    it("pushes an order-confirmation notification to User.notifications", async () => {
      const beforeUser = await User.findById(userId).lean();
      const beforeCount = beforeUser?.notifications?.length ?? 0;

      await sendOrderConfirmation(userId, businessId, {
        dailyReferenceNumber: 1,
        totalNetPaidAmount: 12.99,
        orderCount: 1,
        orderCode: "ORD-TEST-1",
      });

      const updatedUser = await User.findById(userId).lean();
      expect(updatedUser?.notifications?.length ?? 0).toBe(beforeCount + 1);

      const notificationsArray = updatedUser?.notifications ?? [];
      const latestEntry = notificationsArray[notificationsArray.length - 1];
      expect(latestEntry?.notificationId).toBeDefined();

      const notifDoc = await Notification.findById(latestEntry.notificationId).lean();
      expect(notifDoc).toBeDefined();
    });
  });
});
