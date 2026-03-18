/**
 * Orders Routes Tests - Phase 1 Module 4
 * Tests for order CRUD endpoints
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import { getTestApp } from "../setup.js";
import Order from "../../src/models/order.js";
import Business from "../../src/models/business.js";
import BusinessGood from "../../src/models/businessGood.js";
import SalesInstance from "../../src/models/salesInstance.js";
import SalesPoint from "../../src/models/salesPoint.js";
import User from "../../src/models/user.js";

describe("Orders Routes", () => {
  let businessId: Types.ObjectId;
  let businessGoodId: Types.ObjectId;
  let salesInstanceId: Types.ObjectId;
  let salesPointId: Types.ObjectId;
  let userId: Types.ObjectId;

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

    it("returns 404 when no orders exist", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/orders",
      });

      expect(response.statusCode).toBe(404);
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

    it("returns 400 for invalid ID format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/orders/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("OrderId not valid!");
    });

    it("returns 404 for non-existent order", async () => {
      const app = await getTestApp();
      const fakeId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/orders/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/v1/orders", () => {
    it("returns 401 without authentication", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          ordersArr: [],
          salesInstanceId: salesInstanceId.toString(),
          businessId: businessId.toString(),
          dailyReferenceNumber: "1",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 400 for missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: "Bearer invalid-token" },
        payload: {},
      });

      expect(response.statusCode).toBe(401);
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

    it("returns 400 for invalid salesInstanceId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/orders/salesInstance/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("SalesInstanceId is not valid!");
    });

    it("returns 404 when no orders found", async () => {
      const app = await getTestApp();
      const emptySalesInstanceId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/orders/salesInstance/${emptySalesInstanceId}`,
      });

      expect(response.statusCode).toBe(404);
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

    it("returns 400 for invalid userId", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/orders/user/invalid-id",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid userId");
    });

    it("returns 404 when user has no orders", async () => {
      const app = await getTestApp();
      const emptyUserId = new Types.ObjectId();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/orders/user/${emptyUserId}`,
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
