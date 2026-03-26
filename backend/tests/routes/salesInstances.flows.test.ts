/**
 * SalesInstances flow regression tests — Task 12 (POS / QR self-order / PATCH)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken, resetTestApp } from "../setup.ts";
import Business from "../../src/models/business.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import SalesInstance from "../../src/models/salesInstance.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Order from "../../src/models/order.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";

vi.mock("../../src/inventories/updateDynamicCountSupplierGood.ts", () => ({
  default: vi.fn(async () => true as const),
}));

const addr = {
  country: "USA",
  state: "CA",
  city: "LA",
  street: "Main",
  buildingNumber: "1",
  postCode: "90001",
};

const allWeekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const deliveryWindowsAllDays = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  windows: [{ openTime: "00:00", closeTime: "23:59" }],
}));

async function createManagerActor(businessId: Types.ObjectId) {
  const user = await User.create({
    personalDetails: {
      email: `mgr-${Date.now()}-${Math.random().toString(36).slice(2)}@t.com`,
      password: "hashed",
      firstName: "M",
      lastName: "R",
      phoneNumber: "555",
      birthDate: new Date("1990-01-01"),
      gender: "Man",
      nationality: "USA",
      address: addr,
      idNumber: "ID",
      idType: "Passport",
      username: "mgr",
    },
    allUserRoles: ["Manager"],
  });
  const employee = await Employee.create({
    businessId,
    userId: user._id,
    allEmployeeRoles: ["Manager"],
    taxNumber: `TAX-MGR-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    joinDate: new Date(),
    active: true,
    onDuty: true,
    vacationDaysPerYear: 20,
  });
  user.employeeDetails = employee._id;
  await user.save();
  const token = await generateTestToken({
    id: user._id.toString(),
    email: user.personalDetails.email,
    type: "user",
  });
  return { user, employee, token };
}

async function createCustomerActor() {
  const user = await User.create({
    personalDetails: {
      email: `cust-${Date.now()}-${Math.random().toString(36).slice(2)}@t.com`,
      password: "hashed",
      firstName: "C",
      lastName: "U",
      phoneNumber: "556",
      birthDate: new Date("1990-01-01"),
      gender: "Man",
      nationality: "USA",
      address: addr,
      idNumber: "ID2",
      idType: "Passport",
      username: "cust",
    },
    allUserRoles: ["Customer"],
  });
  const token = await generateTestToken({
    id: user._id.toString(),
    email: user.personalDetails.email,
    type: "user",
  });
  return { user, token };
}

describe.sequential("SalesInstances flows (Task 12)", () => {
  let app: Awaited<ReturnType<typeof getTestApp>>;
  let businessId: Types.ObjectId;
  let salesPointId: Types.ObjectId;
  let otherBusinessId: Types.ObjectId;
  let otherSalesPointId: Types.ObjectId;

  beforeEach(async () => {
    await resetTestApp();
    app = await getTestApp();
    const alwaysOpenHours = allWeekDays.map((_, dayOfWeek) => ({
      dayOfWeek,
      openTime: "00:00",
      closeTime: "23:59",
    }));
    const business = await Business.create({
      tradeName: "Flow Biz",
      legalName: "Flow LLC",
      email: `flow-${Date.now()}@t.com`,
      password: "hashed",
      phoneNumber: "1",
      taxNumber: `TAX-FLOW-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      currencyTrade: "USD",
      address: addr,
      acceptsDelivery: true,
      businessOpeningHours: alwaysOpenHours,
      deliveryOpeningWindows: deliveryWindowsAllDays,
    });
    businessId = business._id;

    const sp = await SalesPoint.create({
      businessId,
      salesPointName: "T1",
      salesPointType: "Table",
    });
    salesPointId = sp._id;

    const otherBiz = await Business.create({
      tradeName: "Foreign Biz",
      legalName: "Foreign LLC",
      email: `foreign-${Date.now()}@t.com`,
      password: "hashed",
      phoneNumber: "2",
      taxNumber: `TAX-FOR-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      currencyTrade: "USD",
      address: addr,
    });
    otherBusinessId = otherBiz._id;
    const osp = await SalesPoint.create({
      businessId: otherBusinessId,
      salesPointName: "Foreign table",
      salesPointType: "Table",
    });
    otherSalesPointId = osp._id;
  });

  describe("POST /api/v1/salesInstances (POS open)", () => {
    it("returns 404 when salesPointId is not in the given business", async () => {
      const { token } = await createManagerActor(businessId);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances",
        headers: { authorization: token },
        payload: {
          salesPointId: otherSalesPointId.toString(),
          guests: 2,
          businessId: businessId.toString(),
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.message).toMatch(/does not belong to this business/i);
    });
  });

  describe("POST .../selfOrderingLocation/:id/openTable", () => {
    it("returns 409 when employee open already exists for the point", async () => {
      const a = await createManagerActor(businessId);
      const b = await createManagerActor(businessId);

      const first = await app.inject({
        method: "POST",
        url: `/api/v1/salesInstances/selfOrderingLocation/${salesPointId}/openTable`,
        headers: { authorization: a.token },
        payload: {
          businessId: businessId.toString(),
          guests: 2,
        },
      });
      expect(first.statusCode).toBe(201);

      const second = await app.inject({
        method: "POST",
        url: `/api/v1/salesInstances/selfOrderingLocation/${salesPointId}/openTable`,
        headers: { authorization: b.token },
        payload: {
          businessId: businessId.toString(),
          guests: 2,
        },
      });

      expect(second.statusCode).toBe(409);
    });
  });

  describe("POST .../selfOrderingLocation/:id (customer self-order)", () => {
    let selfPointId: Types.ObjectId;
    let goodId: Types.ObjectId;

    beforeEach(async () => {
      const p = await SalesPoint.create({
        businessId,
        salesPointName: "QR",
        salesPointType: "Table",
        selfOrdering: true,
      });
      selfPointId = p._id;

      const g = await BusinessGood.create({
        businessId,
        name: "Burger",
        keyword: "burger",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 10,
        costPrice: 3,
      });
      goodId = g._id;

      // Open daily report so self-order skips createDailySalesReport (fewer transaction locks on DailySalesReport in CI).
      const dailyReferenceNumber =
        Math.floor(Date.now() * 1000) + (Math.random() * 10000 | 0);
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
        selfOrderingSalesReport: [],
      });
    });

    const paymentPayload = (paymentId: string, net = 10) => ({
      businessId: businessId.toString(),
      paymentId,
      ordersArr: [
        {
          businessGoodId: goodId.toString(),
          orderGrossPrice: 10,
          orderNetPrice: net,
          orderCostPrice: 3,
        },
      ],
      paymentMethodArr: [
        {
          paymentMethodType: "Cash",
          methodBranch: "Cash",
          methodSalesTotal: net,
        },
      ],
    });

    it("returns 403 when an on-duty employee scans the customer QR", async () => {
      const { token } = await createManagerActor(businessId);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/salesInstances/selfOrderingLocation/${selfPointId}`,
        headers: { authorization: token },
        payload: paymentPayload(`pay-emp-${Date.now()}`),
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.message).toMatch(/employees cannot start customer self-order/i);
    });

    it("returns 409 when staff already has an employee-open instance on the table", async () => {
      const mgr = await createManagerActor(businessId);
      const cust = await createCustomerActor();

      const openRes = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances",
        headers: { authorization: mgr.token },
        payload: {
          salesPointId: selfPointId.toString(),
          guests: 2,
          businessId: businessId.toString(),
        },
      });
      expect(openRes.statusCode).toBe(201);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/salesInstances/selfOrderingLocation/${selfPointId}`,
        headers: { authorization: cust.token },
        payload: paymentPayload(`pay-block-${Date.now()}`),
      });

      expect(res.statusCode).toBe(409);
    });

  });

  describe("PATCH /api/v1/salesInstances/:id", () => {
    it("returns 409 when closing with payment on a customer-open instance", async () => {
      const cust = await createCustomerActor();
      const good = await BusinessGood.create({
        businessId,
        name: "X",
        keyword: "x",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 5,
        costPrice: 1,
      });

      const si = await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: cust.user._id,
        openedAsRole: "customer",
      });

      const order = await Order.create({
        businessId,
        businessGoodId: good._id,
        salesInstanceId: si._id,
        createdByUserId: cust.user._id,
        dailyReferenceNumber: 1,
        billingStatus: "Open",
        orderGrossPrice: 5,
        orderNetPrice: 5,
        orderCostPrice: 1,
        orderStatus: "Sent",
      });
      await SalesInstance.updateOne(
        { _id: si._id },
        {
          $set: {
            salesGroup: [{ orderCode: "POS-T2-1", ordersIds: [order._id] }],
          },
        },
      );

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${si._id}`,
        headers: { authorization: cust.token },
        payload: {
          ordersIdsArr: [order._id.toString()],
          paymentMethodArr: [
            {
              paymentMethodType: "Cash",
              methodBranch: "Cash",
              methodSalesTotal: 5,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.message).toMatch(/only employee-open SalesInstances/i);
    });

    it("returns 404 when ordersIdsArr contains an order from another sales instance", async () => {
      const { token } = await createManagerActor(businessId);

      const sp2 = await SalesPoint.create({
        businessId,
        salesPointName: "T2",
        salesPointType: "Table",
      });

      const siA = await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber: 1,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedAsRole: "employee",
      });
      const siB = await SalesInstance.create({
        businessId,
        salesPointId: sp2._id,
        dailyReferenceNumber: 1,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedAsRole: "employee",
      });

      const good = await BusinessGood.create({
        businessId,
        name: "Y",
        keyword: "y",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 4,
        costPrice: 1,
      });

      const orderOnA = await Order.create({
        businessId,
        businessGoodId: good._id,
        salesInstanceId: siA._id,
        dailyReferenceNumber: 1,
        billingStatus: "Open",
        orderGrossPrice: 4,
        orderNetPrice: 4,
        orderCostPrice: 1,
        orderStatus: "Sent",
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${siB._id}`,
        headers: { authorization: token },
        payload: {
          ordersIdsArr: [orderOnA._id.toString()],
          paymentMethodArr: [
            {
              paymentMethodType: "Cash",
              methodBranch: "Cash",
              methodSalesTotal: 4,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("Task T2 integration - actor rows update immediately", () => {
    it("POS payment close updates employee actor row immediately", async () => {
      const manager = await createManagerActor(businessId);
      const dailyReferenceNumber = Math.floor(Date.now() * 1000);
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
        selfOrderingSalesReport: [],
      });

      const good = await BusinessGood.create({
        businessId,
        name: "POS Item",
        keyword: "pos-item",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 20,
        costPrice: 7,
      });

      const si = await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: manager.user._id,
        openedAsRole: "employee",
        salesGroup: [{ orderCode: "POS-T2-1", ordersIds: [] }],
      });

      const order = await Order.create({
        businessId,
        businessGoodId: good._id,
        salesInstanceId: si._id,
        createdByUserId: manager.user._id,
        dailyReferenceNumber,
        billingStatus: "Open",
        orderGrossPrice: 20,
        orderNetPrice: 18,
        orderTips: 2,
        orderCostPrice: 7,
        orderStatus: "Sent",
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${si._id}`,
        headers: { authorization: manager.token },
        payload: {
          ordersIdsArr: [order._id.toString()],
          paymentMethodArr: [
            {
              paymentMethodType: "Card",
              methodBranch: "Visa",
              methodSalesTotal: 18,
            },
          ],
        },
      });

      expect(res.statusCode, res.body).toBe(200);
      const report = await DailySalesReport.findOne({
        businessId,
        dailyReferenceNumber,
      }).lean();
      expect(report?.employeesDailySalesReport?.length).toBe(1);
      expect(report?.employeesDailySalesReport?.[0]?.totalNetPaidAmount).toBe(18);
    });

    it("delivery-attributed close flow updates delivery actor row immediately", async () => {
      const customer = await createCustomerActor();
      const manager = await createManagerActor(businessId);
      const dailyReferenceNumber = Math.floor(Date.now() * 1000) + 1;
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
        selfOrderingSalesReport: [],
      });
      await SalesPoint.create({
        businessId,
        salesPointName: "Delivery Point",
        salesPointType: "delivery",
      });
      const good = await BusinessGood.create({
        businessId,
        name: "Delivery Item",
        keyword: "delivery-item",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 15,
        costPrice: 5,
      });

      const si = await SalesInstance.create({
        businessId,
        salesPointId: (
          await SalesPoint.findOne({
            businessId,
            salesPointType: "delivery",
          }).lean()
        )!._id,
        dailyReferenceNumber,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: manager.user._id,
        openedAsRole: "employee",
        salesGroup: [{ orderCode: "DEL-T2-1", ordersIds: [] }],
      });
      const order = await Order.create({
        businessId,
        businessGoodId: good._id,
        salesInstanceId: si._id,
        createdByUserId: customer.user._id,
        dailyReferenceNumber,
        billingStatus: "Open",
        orderGrossPrice: 15,
        orderNetPrice: 15,
        orderCostPrice: 5,
        orderStatus: "Sent",
      });
      await SalesInstance.updateOne(
        { _id: si._id },
        { $set: { "salesGroup.0.ordersIds": [order._id] } },
      );

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${si._id}`,
        headers: { authorization: manager.token },
        payload: {
          ordersIdsArr: [order._id.toString()],
          paymentMethodArr: [
            {
              paymentMethodType: "Card",
              methodBranch: "Visa",
              methodSalesTotal: 15,
            },
          ],
        },
      });

      expect(res.statusCode, res.body).toBe(200);
      const report = await DailySalesReport.findOne({
        businessId,
        dailyReferenceNumber,
      }).lean();
      expect(report?.deliveryDailySalesReport?.totalNetPaidAmount).toBe(15);
    });

    it("self-order-attributed close flow updates self-order actor row immediately", async () => {
      const customer = await createCustomerActor();
      const manager = await createManagerActor(businessId);
      const dailyReferenceNumber = Math.floor(Date.now() * 1000) + 2;
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
        selfOrderingSalesReport: [],
      });
      const selfPoint = await SalesPoint.create({
        businessId,
        salesPointName: "Self Point",
        salesPointType: "table",
        selfOrdering: true,
      });
      const good = await BusinessGood.create({
        businessId,
        name: "Self Item",
        keyword: "self-item",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 12,
        costPrice: 4,
      });

      const si = await SalesInstance.create({
        businessId,
        salesPointId: selfPoint._id,
        dailyReferenceNumber,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: manager.user._id,
        openedAsRole: "employee",
        salesGroup: [{ orderCode: "SELF-T2-1", ordersIds: [] }],
      });
      const order = await Order.create({
        businessId,
        businessGoodId: good._id,
        salesInstanceId: si._id,
        createdByUserId: customer.user._id,
        dailyReferenceNumber,
        billingStatus: "Open",
        orderGrossPrice: 12,
        orderNetPrice: 12,
        orderCostPrice: 4,
        orderStatus: "Sent",
      });
      await SalesInstance.updateOne(
        { _id: si._id },
        { $set: { "salesGroup.0.ordersIds": [order._id] } },
      );

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${si._id}`,
        headers: { authorization: manager.token },
        payload: {
          ordersIdsArr: [order._id.toString()],
          paymentMethodArr: [
            {
              paymentMethodType: "Card",
              methodBranch: "Visa",
              methodSalesTotal: 12,
            },
          ],
        },
      });

      expect(res.statusCode, res.body).toBe(200);
      const report = await DailySalesReport.findOne({
        businessId,
        dailyReferenceNumber,
      }).lean();
      expect(report?.selfOrderingSalesReport?.length).toBe(1);
      expect(report?.selfOrderingSalesReport?.[0]?.totalNetPaidAmount).toBe(12);
    });
  });

  describe("Task T3 regression - existing behavior unchanged", () => {
    it("still closes employee sales instance when all open orders are paid", async () => {
      const manager = await createManagerActor(businessId);
      const dailyReferenceNumber = Math.floor(Date.now() * 1000) + 3;
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
        selfOrderingSalesReport: [],
      });

      const good = await BusinessGood.create({
        businessId,
        name: "Close Check Item",
        keyword: "close-check-item",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 9,
        costPrice: 3,
      });

      const si = await SalesInstance.create({
        businessId,
        salesPointId,
        dailyReferenceNumber,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: manager.user._id,
        openedAsRole: "employee",
        salesGroup: [{ orderCode: "T3-CLOSE-1", ordersIds: [] }],
      });

      const order = await Order.create({
        businessId,
        businessGoodId: good._id,
        salesInstanceId: si._id,
        createdByUserId: manager.user._id,
        dailyReferenceNumber,
        billingStatus: "Open",
        orderGrossPrice: 9,
        orderNetPrice: 9,
        orderCostPrice: 3,
        orderStatus: "Sent",
      });
      await SalesInstance.updateOne(
        { _id: si._id },
        { $set: { "salesGroup.0.ordersIds": [order._id] } },
      );

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${si._id}`,
        headers: { authorization: manager.token },
        payload: {
          ordersIdsArr: [order._id.toString()],
          paymentMethodArr: [
            {
              paymentMethodType: "Card",
              methodBranch: "Visa",
              methodSalesTotal: 9,
            },
          ],
        },
      });

      expect(res.statusCode, res.body).toBe(200);
      const refreshed = await SalesInstance.findById(si._id).lean();
      expect(refreshed?.salesInstanceStatus).toBe("Closed");
    });
  });

  describe("R1 integration - Open->Void/Open->Invitation hooks", () => {
    it("route-level Open->Void updates actor row immediately and retries are idempotent", async () => {
      const manager = await createManagerActor(businessId);
      const customer = await createCustomerActor();
      const dailyReferenceNumber = Math.floor(Date.now() * 1000) + 4;
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
        selfOrderingSalesReport: [],
      });
      const deliveryPoint = await SalesPoint.create({
        businessId,
        salesPointName: "R1 Delivery",
        salesPointType: "delivery",
      });
      const good = await BusinessGood.create({
        businessId,
        name: "R1 Void Item",
        keyword: "r1-void-item",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 40,
        costPrice: 12,
      });
      const si = await SalesInstance.create({
        businessId,
        salesPointId: deliveryPoint._id,
        dailyReferenceNumber,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: manager.user._id,
        openedAsRole: "employee",
        salesGroup: [{ orderCode: "R1-V-1", ordersIds: [] }],
      });
      const order = await Order.create({
        businessId,
        businessGoodId: good._id,
        salesInstanceId: si._id,
        createdByUserId: customer.user._id,
        dailyReferenceNumber,
        billingStatus: "Open",
        orderGrossPrice: 40,
        orderNetPrice: 40,
        orderCostPrice: 12,
        orderStatus: "Sent",
      });
      await SalesInstance.updateOne(
        { _id: si._id },
        { $set: { "salesGroup.0.ordersIds": [order._id] } },
      );

      const first = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${si._id}`,
        headers: { authorization: manager.token },
        payload: {
          ordersIdsArr: [order._id.toString()],
          ordersNewBillingStatus: "Void",
        },
      });
      expect(first.statusCode, first.body).toBe(200);

      const reportAfterFirst = await DailySalesReport.findOne({
        businessId,
        dailyReferenceNumber,
      }).lean();
      expect(
        (reportAfterFirst?.deliveryDailySalesReport as any)?.totalVoidValue,
      ).toBe(40);

      const second = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${si._id}`,
        headers: { authorization: manager.token },
        payload: {
          ordersIdsArr: [order._id.toString()],
          ordersNewBillingStatus: "Void",
        },
      });
      expect(second.statusCode, second.body).toBe(400);

      const reportAfterSecond = await DailySalesReport.findOne({
        businessId,
        dailyReferenceNumber,
      }).lean();
      expect(
        (reportAfterSecond?.deliveryDailySalesReport as any)?.totalVoidValue,
      ).toBe(40);
    });

    it("route-level Open->Invitation updates actor row immediately and retries are idempotent", async () => {
      const manager = await createManagerActor(businessId);
      const customer = await createCustomerActor();
      const dailyReferenceNumber = Math.floor(Date.now() * 1000) + 5;
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
        selfOrderingSalesReport: [],
      });
      const selfPoint = await SalesPoint.create({
        businessId,
        salesPointName: "R1 Self",
        salesPointType: "table",
        selfOrdering: true,
      });
      const good = await BusinessGood.create({
        businessId,
        name: "R1 Invite Item",
        keyword: "r1-invite-item",
        mainCategory: "Food",
        onMenu: true,
        available: true,
        sellingPrice: 22,
        costPrice: 8,
      });
      const si = await SalesInstance.create({
        businessId,
        salesPointId: selfPoint._id,
        dailyReferenceNumber,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: manager.user._id,
        openedAsRole: "employee",
        salesGroup: [{ orderCode: "R1-I-1", ordersIds: [] }],
      });
      const order = await Order.create({
        businessId,
        businessGoodId: good._id,
        salesInstanceId: si._id,
        createdByUserId: customer.user._id,
        dailyReferenceNumber,
        billingStatus: "Open",
        orderGrossPrice: 22,
        orderNetPrice: 22,
        orderCostPrice: 8,
        orderStatus: "Sent",
      });
      await SalesInstance.updateOne(
        { _id: si._id },
        { $set: { "salesGroup.0.ordersIds": [order._id] } },
      );

      const first = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${si._id}`,
        headers: { authorization: manager.token },
        payload: {
          ordersIdsArr: [order._id.toString()],
          ordersNewBillingStatus: "Invitation",
        },
      });
      expect(first.statusCode, first.body).toBe(200);

      const reportAfterFirst = await DailySalesReport.findOne({
        businessId,
        dailyReferenceNumber,
      }).lean();
      expect(
        (reportAfterFirst?.selfOrderingSalesReport?.[0] as any)?.totalInvitedValue,
      ).toBe(22);

      const second = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${si._id}`,
        headers: { authorization: manager.token },
        payload: {
          ordersIdsArr: [order._id.toString()],
          ordersNewBillingStatus: "Invitation",
        },
      });
      expect(second.statusCode, second.body).toBe(400);

      const reportAfterSecond = await DailySalesReport.findOne({
        businessId,
        dailyReferenceNumber,
      }).lean();
      expect(
        (reportAfterSecond?.selfOrderingSalesReport?.[0] as any)?.totalInvitedValue,
      ).toBe(22);
    });
  });
});
