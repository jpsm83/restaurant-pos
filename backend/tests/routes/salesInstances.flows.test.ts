/**
 * SalesInstances flow regression tests — Task 12 (POS / QR self-order / PATCH)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
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
    app = await getTestApp();
    const business = await Business.create({
      tradeName: "Flow Biz",
      legalName: "Flow LLC",
      email: `flow-${Date.now()}@t.com`,
      password: "hashed",
      phoneNumber: "1",
      taxNumber: `TAX-FLOW-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      currencyTrade: "USD",
      address: addr,
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
});
