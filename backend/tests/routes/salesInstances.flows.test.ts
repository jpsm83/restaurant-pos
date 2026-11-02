/**
 * SalesInstances flow regression tests — Task 12 (POS / QR self-order)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken, resetTestApp } from "../setup.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";
import Promotion from "../../src/models/promotion.ts";
import { createTestBusiness } from "../helpers/fixtures.ts";

vi.mock("../../src/inventories/updateDynamicCountSupplierGood.ts", () => ({
  default: vi.fn(async () => true as const),
}));

// Synthetic retired codes prove the HTTP rejection without retiring a product
// code in this slice.
vi.mock("restaurant-pos-packages/operationalReasons", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("restaurant-pos-packages/operationalReasons")
    >();
  const catalogues = {
    ...actual.OPERATIONAL_REASON_CATALOGUES,
    void: [
      ...actual.OPERATIONAL_REASON_CATALOGUES.void,
      {
        code: "retiredVoidReason",
        label: "Retired void reason",
        retired: true,
        allowsNote: false,
      },
    ],
    invitation: [
      ...actual.OPERATIONAL_REASON_CATALOGUES.invitation,
      {
        code: "retiredInvitationReason",
        label: "Retired invitation reason",
        retired: true,
        allowsNote: false,
      },
    ],
  };

  return {
    ...actual,
    OPERATIONAL_REASON_CATALOGUES: catalogues,
    resolveOperationalReason: (
      act: string | null | undefined,
      code: string | null | undefined,
      note?: string | null,
    ) => actual.resolveOperationalReason(act, code, note, catalogues),
  };
});

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

async function createEmployeeActor(
  businessId: Types.ObjectId,
  role: "Manager" | "Waiter",
) {
  const suffix = Math.random().toString(36).slice(2);
  const user = await User.create({
    personalDetails: {
      email: `${role}-${Date.now()}-${suffix}@t.com`,
      firstName: role,
      lastName: "Actor",
      phoneNumber: "555",
      birthDate: new Date("1990-01-01"),
      gender: "Man",
      nationality: "USA",
      address: addr,
      idNumber: "ID",
      idType: "Passport",
      username: role,
    },
    allUserRoles: [role],
  });
  const employee = await Employee.create({
    businessId,
    userId: user._id,
    allEmployeeRoles: [role],
    taxNumber: `TAX-${role}-${Date.now()}-${suffix}`,
    joinDate: new Date(),
    active: true,
    onDuty: true,
    vacationDaysPerYear: 20,
  });
  const token = await generateTestToken({
    id: user._id.toString(),
    email: user.personalDetails.email,
    type: "user",
    role,
  });
  return { user, employee, token };
}

const createManagerActor = (businessId: Types.ObjectId) =>
  createEmployeeActor(businessId, "Manager");

async function createCustomerActor() {
  const user = await User.create({
    personalDetails: {
      email: `cust-${Date.now()}-${Math.random().toString(36).slice(2)}@t.com`,
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
    role: "Customer",
  });
  return { user, token };
}

describe("SalesInstances flows (Task 12)", () => {
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
    const business = await createTestBusiness({
      tradeName: "Flow Biz",
      legalName: "Flow LLC",
      email: `flow-${Date.now()}@t.com`,
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

    const otherBiz = await createTestBusiness({
      tradeName: "Foreign Biz",
      legalName: "Foreign LLC",
      email: `foreign-${Date.now()}@t.com`,
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
      expect(body.detail).toMatch(/does not belong to this business/i);
    });

    it("rejects a malformed salesPointId as a validation problem", async () => {
      const { token } = await createManagerActor(businessId);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances",
        headers: { authorization: token },
        payload: {
          salesPointId: "not-an-id",
          guests: 2,
          businessId: businessId.toString(),
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(res.body);
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "salesPointId" }),
        ]),
      );
    });
  });

  describe("PATCH /api/v1/salesInstances/:id/transferSalesPoint", () => {
    it("rejects an invalid salesPointId as a validation problem", async () => {
      const { token } = await createManagerActor(businessId);

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/salesInstances/${salesPointId}/transferSalesPoint`,
        headers: { authorization: token },
        payload: { salesPointId: "not-an-id" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(res.body);
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "salesPointId" }),
        ]),
      );
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

    it("defaults guests to 1 when omitted", async () => {
      const { token } = await createManagerActor(businessId);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/salesInstances/selfOrderingLocation/${salesPointId}/openTable`,
        headers: { authorization: token },
        payload: { businessId: businessId.toString() },
      });

      expect(res.statusCode, res.body).toBe(201);
      expect(JSON.parse(res.body).guests).toBe(1);
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
      expect(res.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(res.body);
      expect(body.type).toBe("https://restaurant-pos.app/errors/forbidden");
      expect(body.detail).toMatch(/employees cannot start customer self-order/i);
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

    it("accepts a self-order that applies a promotion (server-generated discount is not client-settable)", async () => {
      const { token } = await createCustomerActor();

      await Promotion.create({
        businessId,
        promotionName: "Self half off",
        promotionPeriod: {
          start: new Date(Date.now() - 86400000),
          end: new Date(Date.now() + 86400000),
        },
        weekDays: [...allWeekDays],
        activePromotion: true,
        promotionType: { discountPercent: 50 },
        applyToDelivery: false,
        businessGoodsToApplyIds: [goodId],
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/salesInstances/selfOrderingLocation/${selfPointId}`,
        headers: { authorization: token },
        payload: {
          businessId: businessId.toString(),
          paymentId: `pay-promo-${Date.now()}`,
          ordersArr: [
            {
              businessGoodId: goodId.toString(),
              orderGrossPrice: 10,
              orderNetPrice: 5,
              orderCostPrice: 3,
              promotionApplyed: "Self half off",
            },
          ],
          paymentMethodArr: [
            {
              paymentMethodType: "Cash",
              methodBranch: "Cash",
              methodSalesTotal: 5,
            },
          ],
        },
      });

      expect(res.statusCode, res.body).toBe(201);
    });

  });






  describe("flow DTO validation (problem details)", () => {
    const expectValidationProblem = (res: {
      statusCode: number;
      headers: Record<string, unknown>;
      body: string;
    }) => {
      expect(res.statusCode).toBe(400);
      expect(res.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const body = JSON.parse(res.body);
      expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
      expect(body.status).toBe(400);
      expect(Array.isArray(body.errors)).toBe(true);
      return body;
    };

    const validOrderLine = () => ({
      businessGoodId: salesPointId.toString(),
      orderGrossPrice: 1,
      orderNetPrice: 1,
      orderCostPrice: 1,
    });

    const validPaymentLine = () => ({
      paymentMethodType: "Cash",
      methodBranch: "Cash",
      methodSalesTotal: 1,
    });

    it("rejects a delivery body that omits paymentId", async () => {
      const { token } = await createCustomerActor();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances/delivery",
        headers: { authorization: token },
        payload: {
          businessId: businessId.toString(),
          ordersArr: [validOrderLine()],
          paymentMethodArr: [validPaymentLine()],
        },
      });

      const body = expectValidationProblem(res);
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "paymentId" }),
        ]),
      );
    });

    it("rejects a delivery body with a malformed order id", async () => {
      const { token } = await createCustomerActor();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances/delivery",
        headers: { authorization: token },
        payload: {
          businessId: businessId.toString(),
          ordersArr: [{ ...validOrderLine(), businessGoodId: "not-an-id" }],
          paymentMethodArr: [validPaymentLine()],
          paymentId: `pay-bad-${Date.now()}`,
        },
      });

      const body = expectValidationProblem(res);
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "ordersArr.0.businessGoodId" }),
        ]),
      );
    });

    it("rejects a delivery body carrying a server-owned field", async () => {
      const { token } = await createCustomerActor();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances/delivery",
        headers: { authorization: token },
        payload: {
          businessId: businessId.toString(),
          ordersArr: [validOrderLine()],
          paymentMethodArr: [validPaymentLine()],
          paymentId: `pay-owned-${Date.now()}`,
          openedByUserId: businessId.toString(),
        },
      });

      expectValidationProblem(res);
    });

    it("rejects a self-order body missing ordersArr", async () => {
      const { token } = await createCustomerActor();

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/salesInstances/selfOrderingLocation/${salesPointId}`,
        headers: { authorization: token },
        payload: {
          businessId: businessId.toString(),
          paymentMethodArr: [validPaymentLine()],
          paymentId: `pay-self-${Date.now()}`,
        },
      });

      const body = expectValidationProblem(res);
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "ordersArr" }),
        ]),
      );
    });

    it("rejects a non-ObjectId selfOrderingLocationId param", async () => {
      const { token } = await createCustomerActor();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/salesInstances/selfOrderingLocation/not-an-id",
        headers: { authorization: token },
        payload: {
          businessId: businessId.toString(),
          ordersArr: [validOrderLine()],
          paymentMethodArr: [validPaymentLine()],
          paymentId: `pay-param-${Date.now()}`,
        },
      });

      const body = expectValidationProblem(res);
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "selfOrderingLocationId" }),
        ]),
      );
    });

    it("rejects an openTable body with a malformed businessId", async () => {
      const { token } = await createManagerActor(businessId);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/salesInstances/selfOrderingLocation/${salesPointId}/openTable`,
        headers: { authorization: token },
        payload: {
          businessId: "not-an-id",
          guests: 2,
        },
      });

      const body = expectValidationProblem(res);
      expect(body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "businessId" }),
        ]),
      );
    });
  });
});
