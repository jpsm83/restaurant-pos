/**
 * Orders Routes Tests - Phase 1 Module 4
 * Tests for order CRUD endpoints
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import Order from "../../src/models/order.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";
import Business from "../../src/models/business.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import Notification from "../../src/models/notification.ts";
import SalesInstance from "../../src/models/salesInstance.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Promotion from "../../src/models/promotion.ts";
import sendOrderConfirmation from "../../src/orderConfirmation/sendOrderConfirmation.ts";
import closeOrders from "../../src/orders/closeOrders.ts";
import finalizeOrdersBillingStatus from "../../src/orders/finalizeOrdersBillingStatus.ts";

vi.mock("../../src/inventories/updateDynamicCountSupplierGood.ts", () => ({
  default: vi.fn(async () => true as const),
}));

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
  let managerUserId: Types.ObjectId;
  let managerAuth: string;

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

    const manager = await User.create({
      personalDetails: {
        email: `manager-${Date.now()}@test.com`,
        password: "hashedpassword",
        firstName: "Manager",
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
        idNumber: "ID654321",
        idType: "Passport",
        username: "manager-user",
      },
      allUserRoles: ["Manager"],
    });
    managerUserId = manager._id;

    const managerEmployee = await Employee.create({
      businessId,
      userId: managerUserId,
      allEmployeeRoles: ["Manager"],
      taxNumber: `MGR-TAX-${Date.now()}`,
      joinDate: new Date(),
      active: true,
      onDuty: true,
      vacationDaysPerYear: 20,
    });

    manager.employeeDetails = managerEmployee._id;
    await manager.save();

    managerAuth = await generateTestToken({
      id: String(managerUserId),
      email: manager.personalDetails.email,
      type: "user",
      role: "Manager",
    });
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

    it.each(["deleted", "deletedAt", "deletedBy", "paymentId"] as const)(
      "rejects an unknown order-list query key %s",
      async (key) => {
        const app = await getTestApp();

        const response = await app.inject({
          method: "GET",
          url: `/api/v1/orders?${key}=true`,
        });

        expectProblem(response, 400, "validation");
      },
    );

    it("omits a deleted order from ordinary reads and returns it when includeDeleted is set", async () => {
      const app = await getTestApp();
      const active = await Order.create({
        businessId,
        businessGoodId,
        salesInstanceId,
        createdByUserId: userId,
        dailyReferenceNumber: 1,
        billingStatus: "Open",
        orderGrossPrice: 12.99,
        orderNetPrice: 12.99,
        orderCostPrice: 4,
        orderStatus: "Sent",
      });
      const deleted = await Order.create({
        businessId,
        businessGoodId,
        salesInstanceId,
        createdByUserId: userId,
        dailyReferenceNumber: 1,
        billingStatus: "Open",
        orderGrossPrice: 7.5,
        orderNetPrice: 7.5,
        orderCostPrice: 2,
        orderStatus: "Sent",
      });
      await Order.collection.updateOne(
        { _id: deleted._id },
        { $set: { deleted: true, deletedAt: new Date(), deletedBy: userId } },
      );

      const list = await app.inject({ method: "GET", url: "/api/v1/orders" });
      expect(list.statusCode).toBe(200);
      expect(list.headers["content-type"]).toContain("application/json");
      expect(list.json().map((order: { _id: string }) => order._id)).toEqual([
        String(active._id),
      ]);

      const listWithDeleted = await app.inject({
        method: "GET",
        url: "/api/v1/orders?includeDeleted=true",
      });
      expect(listWithDeleted.statusCode).toBe(200);
      expect(
        listWithDeleted.json().map((order: { _id: string }) => order._id),
      ).toEqual(expect.arrayContaining([String(active._id), String(deleted._id)]));
      expect(listWithDeleted.json()).toHaveLength(2);

      const hidden = await app.inject({
        method: "GET",
        url: `/api/v1/orders/${deleted._id}`,
      });
      expectProblem(hidden, 404, "not-found");

      const shown = await app.inject({
        method: "GET",
        url: `/api/v1/orders/${deleted._id}?includeDeleted=true`,
      });
      expect(shown.statusCode).toBe(200);
      expect(shown.json()._id).toBe(String(deleted._id));
      expect(shown.json().deleted).toBe(true);

      const byInstance = await app.inject({
        method: "GET",
        url: `/api/v1/orders/salesInstance/${salesInstanceId}`,
      });
      expect(byInstance.json().map((order: { _id: string }) => order._id)).toEqual([
        String(active._id),
      ]);

      const byInstanceWithDeleted = await app.inject({
        method: "GET",
        url: `/api/v1/orders/salesInstance/${salesInstanceId}?includeDeleted=true`,
      });
      expect(byInstanceWithDeleted.json()).toHaveLength(2);

      const byUser = await app.inject({
        method: "GET",
        url: `/api/v1/orders/user/${userId}`,
      });
      expect(byUser.json().map((order: { _id: string }) => order._id)).toEqual([
        String(active._id),
      ]);

      const byUserWithDeleted = await app.inject({
        method: "GET",
        url: `/api/v1/orders/user/${userId}?includeDeleted=true`,
      });
      expect(byUserWithDeleted.json()).toHaveLength(2);

      const stored = await Order.collection.findOne({ _id: deleted._id });
      expect(stored).not.toBeNull();
      expect(stored?.deleted).toBe(true);
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

    it("hides the billing reason fields from ordinary list and detail reads", async () => {
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
        orderStatus: "Sent",
      });
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            billingStatus: "Void",
            billingReasonCode: "wrongItem",
            billingReasonNote: "Staff-only context",
          },
        },
      );

      const detail = await app.inject({
        method: "GET",
        url: `/api/v1/orders/${order._id}`,
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json()).not.toHaveProperty("billingReasonCode");
      expect(detail.json()).not.toHaveProperty("billingReasonNote");

      const list = await app.inject({ method: "GET", url: "/api/v1/orders" });
      const listed = list
        .json()
        .find((candidate: { _id: string }) => candidate._id === String(order._id));
      expect(listed).toBeDefined();
      expect(listed).not.toHaveProperty("billingReasonCode");
      expect(listed).not.toHaveProperty("billingReasonNote");
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

    it.each(["deleted", "deletedAt", "deletedBy"] as const)(
      "rejects a create body that sets %s",
      async (field) => {
        const app = await getTestApp();
        const auth = await authFor(userId);
        const marker = field === "deleted" ? true : new Types.ObjectId().toString();

        const onBody = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          headers: { authorization: auth },
          payload: { ...validBody(), [field]: marker },
        });
        expectProblem(onBody, 400, "validation");

        const onLine = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          headers: { authorization: auth },
          payload: {
            ...validBody(),
            ordersArr: [{ ...validOrderItem(), [field]: marker }],
          },
        });
        expectProblem(onLine, 400, "validation");
        expect(await Order.countDocuments({ salesInstanceId })).toBe(0);
      },
    );

    it("returns a newly created order on an ordinary read", async () => {
      const app = await getTestApp();
      const auth = await authFor(userId);

      const created = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: auth },
        payload: validBody(),
      });

      expect(created.statusCode).toBe(201);
      expect(created.headers["content-type"]).toContain("application/json");

      const list = await app.inject({
        method: "GET",
        url: `/api/v1/orders/salesInstance/${salesInstanceId}`,
      });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toEqual([
        expect.objectContaining({
          orderGrossPrice: 12.99,
          billingStatus: "Open",
        }),
      ]);
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

    it("does not apply a soft-deleted promotion when creating an order", async () => {
      const app = await getTestApp();
      const now = new Date();
      const weekDays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      await Promotion.create({
        businessId,
        promotionName: "Retired 20% Off",
        activePromotion: true,
        promotionPeriod: {
          start: new Date(now.getTime() - 86_400_000),
          end: new Date(now.getTime() + 86_400_000),
        },
        weekDays,
        promotionType: { discountPercent: 20 },
        deleted: true,
        deletedAt: now,
      });

      const auth = await authFor(userId);
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: auth },
        payload: validBody(),
      });

      expect(response.statusCode, response.body).toBe(201);
      const stored = await Order.findOne({ salesInstanceId }).lean();
      expect(stored?.orderNetPrice).toBe(12.99);
      expect(stored?.promotionApplyed).toBeUndefined();
    });

    it("does not add an order to a soft-deleted sales instance", async () => {
      const app = await getTestApp();
      await SalesInstance.updateOne(
        { _id: salesInstanceId },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const auth = await authFor(userId);
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: auth },
        payload: validBody(),
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe("SalesInstance not found for this business!");
      expect(await Order.countDocuments({ salesInstanceId })).toBe(0);
    });

    it("does not add an order when the sales point is soft-deleted", async () => {
      const app = await getTestApp();
      await SalesPoint.updateOne(
        { _id: salesPointId },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const auth = await authFor(userId);
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { authorization: auth },
        payload: validBody(),
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe("SalesPoint not found for this business!");
      expect(await Order.countDocuments({ salesInstanceId })).toBe(0);
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

    it("erases a cancelled order (ADR exception) instead of retaining it", async () => {
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
        orderStatus: "Sent",
      });

      await SalesInstance.updateOne(
        { _id: salesInstanceId },
        { $set: { salesGroup: [{ orderCode: "ORD-DELETE-1", ordersIds: [order._id] }] } },
      );

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/orders/${order._id}`,
        headers: { authorization: managerAuth },
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().message).toBe("Order deleted successfully!");

      const erasedOrder = await Order.findById(order._id)
        .setOptions({ includeDeleted: true })
        .lean();
      expect(erasedOrder).toBeNull();
    });

    it("does not erase an open order that is already done", async () => {
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
        orderCostPrice: 4,
        orderStatus: "Done",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/orders/${order._id}`,
        headers: { authorization: managerAuth },
      });

      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe("Cannot cancel orders with status 'Done'!");
      const retained = await Order.findById(order._id)
        .setOptions({ includeDeleted: true })
        .lean();
      expect(retained).not.toBeNull();
      expect(retained?.billingStatus).toBe("Open");
      expect(retained?.orderStatus).toBe("Done");
    });

    it.each(["Void", "Invitation", "Paid"] as const)(
      "refuses to erase a %s order",
      async (billingStatus) => {
        const app = await getTestApp();
        const order = await Order.create({
          businessId,
          businessGoodId,
          salesInstanceId,
          createdByUserId: userId,
          dailyReferenceNumber: 1,
          billingStatus,
          orderGrossPrice: 12.99,
          orderNetPrice: 12.99,
          orderCostPrice: 4,
          orderStatus: "Sent",
        });

        const response = await app.inject({
          method: "DELETE",
          url: `/api/v1/orders/${order._id}`,
          headers: { authorization: managerAuth },
        });

        const body = expectProblem(response, 400, "bad-request");
        expect(body.detail).toBe(
          "Only orders with billing status Open can be cancelled.",
        );
        const retained = await Order.findById(order._id)
          .setOptions({ includeDeleted: true })
          .lean();
        expect(retained).not.toBeNull();
        expect(retained?.deleted).not.toBe(true);
        expect(retained?.billingStatus).toBe(billingStatus);
      },
    );
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

  describe("closing and finalizing billing", () => {
    const openOrder = () =>
      Order.create({
        businessId,
        businessGoodId,
        salesInstanceId,
        createdByUserId: userId,
        dailyReferenceNumber: 1,
        billingStatus: "Open",
        orderGrossPrice: 12.99,
        orderNetPrice: 12.99,
        orderCostPrice: 4,
        orderStatus: "Sent",
      });

    it("does not change a deleted order when closing it", async () => {
      const order = await openOrder();
      await Order.collection.updateOne(
        { _id: order._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const result = await closeOrders(
          [order._id],
          [
            {
              paymentMethodType: "Card",
              methodBranch: "Visa",
              methodSalesTotal: 12.99,
            },
          ],
          salesInstanceId,
          session,
        );
        expect(result).not.toBe(true);

        const stored = await Order.findById(order._id)
          .setOptions({ includeDeleted: true })
          .session(session)
          .lean();
        expect(stored?.billingStatus).toBe("Open");
        expect(stored?.deleted).toBe(true);
        expect(stored?.paymentMethod).toBeUndefined();
      } finally {
        await session.abortTransaction().catch(() => undefined);
        session.endSession();
      }
    });

    it("closes an open order and leaves a deleted order on the same sitting unchanged", async () => {
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber: 1,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86_400_000,
      });
      const active = await openOrder();
      const deleted = await openOrder();
      await Order.collection.updateOne(
        { _id: deleted._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );
      await SalesInstance.updateOne(
        { _id: salesInstanceId },
        {
          $set: {
            salesGroup: [
              { orderCode: "SIT-1", ordersIds: [active._id, deleted._id] },
            ],
          },
        },
      );

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const result = await closeOrders(
          [active._id],
          [
            {
              paymentMethodType: "Card",
              methodBranch: "Visa",
              methodSalesTotal: 12.99,
            },
          ],
          salesInstanceId,
          session,
        );
        expect(result).toBe(true);

        const storedActive = await Order.findById(active._id).session(session).lean();
        expect(storedActive?.billingStatus).toBe("Paid");

        const storedDeleted = await Order.findById(deleted._id)
          .setOptions({ includeDeleted: true })
          .session(session)
          .lean();
        expect(storedDeleted?.billingStatus).toBe("Open");
        expect(storedDeleted?.deleted).toBe(true);
      } finally {
        await session.abortTransaction().catch(() => undefined);
        session.endSession();
      }
    });

    it("does not change a deleted order when finalizing its billing status", async () => {
      const order = await openOrder();
      await Order.collection.updateOne(
        { _id: order._id },
        { $set: { deleted: true, deletedAt: new Date() } },
      );

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const result = await finalizeOrdersBillingStatus(
          [order._id],
          salesInstanceId,
          "Void",
          { code: "wrongItem" },
          session,
        );
        expect(result).not.toBe(true);

        const stored = await Order.findById(order._id)
          .setOptions({ includeDeleted: true })
          .session(session)
          .lean();
        expect(stored?.billingStatus).toBe("Open");
        expect(stored?.deleted).toBe(true);
      } finally {
        await session.abortTransaction().catch(() => undefined);
        session.endSession();
      }
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
