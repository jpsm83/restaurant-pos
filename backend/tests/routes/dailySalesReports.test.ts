import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { getTestApp, generateTestToken } from "../setup.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";
import Business from "../../src/models/business.ts";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Order from "../../src/models/order.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import SalesInstance from "../../src/models/salesInstance.ts";
import BusinessGood from "../../src/models/businessGood.ts";
import WeeklyBusinessReport from "../../src/models/weeklyBusinessReport.ts";
import MonthlyBusinessReport from "../../src/models/monthlyBusinessReport.ts";
import { buildReconciledDailyPayload } from "../../src/dailySalesReports/reconciliationCore.ts";
import {
  resolveLocalDate,
  resolveWeekBounds,
  resolveMonthBounds,
} from "../../src/utils/timezoneResolver.ts";

/**
 * Every error response is an RFC 9457 `application/problem+json` document
 * produced by the global handler, so assertions are on the problem-details
 * shape rather than a bare `{ message }`.
 */
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

const fieldPaths = (body: { errors?: Array<{ path: string }> }): string[] =>
  (body.errors ?? []).map((e) => e.path);

describe("DailySalesReports routes - Task T2 integration", () => {
  const addr = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  const createTestBusiness = async (
    overrides: Record<string, unknown> = {},
  ) =>
    Business.create({
      tradeName: "Test Restaurant",
      legalName: "Test Restaurant LLC",
      email: `test${Date.now()}@restaurant.com`,
      password: "hashedpassword",
      phoneNumber: "1234567890",
      taxNumber: `TAX-${Date.now()}`,
      currencyTrade: "USD",
      subscription: "Free",
      address: addr,
      ...overrides,
    });

  const createManagerToken = async (businessId: Types.ObjectId) => {
    const user = await User.create({
      personalDetails: {
        email: `manager-${Date.now()}@test.com`,
        password: "hashed",
        firstName: "Manager",
        lastName: "User",
        phoneNumber: "999",
        birthDate: new Date("1990-01-01"),
        gender: "Man",
        nationality: "USA",
        address: addr,
        idNumber: `MGR-${Date.now()}`,
        idType: "Passport",
        username: `manager-${Date.now()}`,
      },
      allUserRoles: ["Manager"],
    });
    const employee = await Employee.create({
      businessId,
      userId: user._id,
      allEmployeeRoles: ["Manager"],
      taxNumber: `MGR-TAX-${Date.now()}`,
      joinDate: new Date(),
      active: true,
      onDuty: false,
      vacationDaysPerYear: 20,
    });
    user.employeeDetails = employee._id;
    await user.save();
    return generateTestToken({
      id: user._id.toString(),
      email: user.personalDetails.email,
      type: "user",
      role: "Manager",
    });
  };

  const createActorSeededReport = async (businessId: Types.ObjectId) =>
    DailySalesReport.create({
      businessId,
      dailyReferenceNumber: Date.now(),
      isDailyReportOpen: true,
      timeCountdownToClose: 3600,
      employeesDailySalesReport: [
        {
          userId: new Types.ObjectId(),
          totalSalesBeforeAdjustments: 100,
          totalNetPaidAmount: 90,
          totalTipsReceived: 10,
          totalCostOfGoodsSold: 40,
          employeePaymentMethods: [
            {
              paymentMethodType: "Card",
              methodBranch: "Visa",
              methodSalesTotal: 90,
            },
          ],
          soldGoods: [],
          voidedGoods: [],
          invitedGoods: [],
        },
      ],
      deliveryDailySalesReport: {
        userId: new Types.ObjectId(),
        totalSalesBeforeAdjustments: 30,
        totalNetPaidAmount: 30,
        totalTipsReceived: 0,
        totalCostOfGoodsSold: 12,
        employeePaymentMethods: [
          {
            paymentMethodType: "Card",
            methodBranch: "Visa",
            methodSalesTotal: 30,
          },
        ],
        soldGoods: [],
        voidedGoods: [],
        invitedGoods: [],
      },
      selfOrderingSalesReport: [
        {
          userId: new Types.ObjectId(),
          salesPointId: new Types.ObjectId(),
          totalSalesBeforeAdjustments: 20,
          totalNetPaidAmount: 20,
          totalTipsReceived: 0,
          totalCostOfGoodsSold: 8,
          employeePaymentMethods: [
            {
              paymentMethodType: "Card",
              methodBranch: "Visa",
              methodSalesTotal: 20,
            },
          ],
          soldGoods: [],
          voidedGoods: [],
          invitedGoods: [],
        },
      ],
      businessPaymentMethods: [],
      dailyTotalSalesBeforeAdjustments: 0,
      dailyNetPaidAmount: 0,
      dailyTipsReceived: 0,
      dailyCostOfGoodsSold: 0,
      dailyProfit: 0,
      dailyCustomersServed: 0,
      dailyTotalVoidValue: 0,
      dailyTotalInvitedValue: 0,
    });

  const waitFor = async <T>(
    read: () => Promise<T>,
    isReady: (value: T) => boolean,
    timeoutMs = 3000,
  ): Promise<T> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const value = await read();
      if (isReady(value)) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return read();
  };

  it("manager calculate aggregates from actor rows (without order recompute dependency)", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness();
    const token = await createManagerToken(business._id as Types.ObjectId);
    const report = await createActorSeededReport(business._id as Types.ObjectId);

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/dailySalesReports/${report._id}/calculateBusinessReport`,
      headers: { authorization: token },
    });

    expect(response.statusCode).toBe(200);
    const refreshed = await DailySalesReport.findById(report._id).lean();
    expect(refreshed?.dailyTotalSalesBeforeAdjustments).toBe(150);
    expect(refreshed?.dailyNetPaidAmount).toBe(140);
    expect(refreshed?.dailyCostOfGoodsSold).toBe(60);
    expect(refreshed?.dailyTipsReceived).toBe(10);
  });

  it("manager close validates open orders, then aggregates and closes", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness();
    const token = await createManagerToken(business._id as Types.ObjectId);
    const report = await createActorSeededReport(business._id as Types.ObjectId);
    const sp = await SalesPoint.create({
      businessId: business._id,
      salesPointName: "T1",
      salesPointType: "table",
    });
    const si = await SalesInstance.create({
      businessId: business._id,
      salesPointId: sp._id,
      dailyReferenceNumber: report.dailyReferenceNumber,
      guests: 1,
      salesInstanceStatus: "Occupied",
      openedAsRole: "employee",
    });
    const good = await BusinessGood.create({
      businessId: business._id,
      name: "Close guard item",
      keyword: "close-guard-item",
      mainCategory: "Food",
      onMenu: true,
      available: true,
      sellingPrice: 5,
      costPrice: 2,
    });
    const order = await Order.create({
      businessId: business._id,
      businessGoodId: good._id,
      salesInstanceId: si._id,
      dailyReferenceNumber: report.dailyReferenceNumber,
      billingStatus: "Open",
      orderStatus: "Sent",
      orderGrossPrice: 5,
      orderNetPrice: 5,
      orderCostPrice: 2,
    });

    const blocked = await app.inject({
      method: "PATCH",
      url: `/api/v1/dailySalesReports/${report._id}/close`,
      headers: { authorization: token },
    });
    const blockedBody = expectProblem(blocked, 400, "bad-request");
    expect(blockedBody.detail).toBe(
      "You can't close the daily sales because there are open orders!",
    );

    await Order.updateOne({ _id: order._id }, { $set: { billingStatus: "Paid" } });

    const success = await app.inject({
      method: "PATCH",
      url: `/api/v1/dailySalesReports/${report._id}/close`,
      headers: { authorization: token },
    });
    expect(success.statusCode).toBe(200);

    const refreshed = await DailySalesReport.findById(report._id).lean();
    expect(refreshed?.isDailyReportOpen).toBe(false);
    expect(refreshed?.dailyTotalSalesBeforeAdjustments).toBe(150);
    expect(refreshed?.dailyNetPaidAmount).toBe(140);
  });

  it("weekly/monthly aggregates remain consistent after daily calculate updates", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness();
    const token = await createManagerToken(business._id as Types.ObjectId);
    const report = await createActorSeededReport(business._id as Types.ObjectId);

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/dailySalesReports/${report._id}/calculateBusinessReport`,
      headers: { authorization: token },
    });
    expect(response.statusCode).toBe(200);

    const daily = await DailySalesReport.findById(report._id).lean();
    expect(daily?.dailyTotalSalesBeforeAdjustments).toBe(150);
    expect(daily?.dailyNetPaidAmount).toBe(140);

    const weekly = await waitFor(
      () =>
        WeeklyBusinessReport.findOne({ businessId: business._id })
          .sort({ createdAt: -1 })
          .lean(),
      (doc) =>
        Boolean(
          doc &&
            doc.financialSummary?.totalSalesForWeek === 150 &&
            doc.financialSummary?.totalNetRevenue === 140,
        ),
    );
    expect(weekly?.financialSummary?.totalSalesForWeek).toBe(150);
    expect(weekly?.financialSummary?.totalNetRevenue).toBe(140);

    const monthly = await waitFor(
      () =>
        MonthlyBusinessReport.findOne({ businessId: business._id })
          .sort({ createdAt: -1 })
          .lean(),
      (doc) =>
        Boolean(
          doc &&
            doc.financialSummary?.totalSalesForMonth === 150 &&
            doc.financialSummary?.totalNetRevenue === 140,
        ),
    );
    expect(monthly?.financialSummary?.totalSalesForMonth).toBe(150);
    expect(monthly?.financialSummary?.totalNetRevenue).toBe(140);
  });

  it("repeated calculate calls are idempotent for weekly/monthly rollups", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness();
    const token = await createManagerToken(business._id as Types.ObjectId);
    const report = await createActorSeededReport(business._id as Types.ObjectId);

    const first = await app.inject({
      method: "PATCH",
      url: `/api/v1/dailySalesReports/${report._id}/calculateBusinessReport`,
      headers: { authorization: token },
    });
    expect(first.statusCode, first.body).toBe(200);

    const second = await app.inject({
      method: "PATCH",
      url: `/api/v1/dailySalesReports/${report._id}/calculateBusinessReport`,
      headers: { authorization: token },
    });
    expect(second.statusCode, second.body).toBe(200);

    const weekly = await waitFor(
      () =>
        WeeklyBusinessReport.findOne({ businessId: business._id })
          .sort({ createdAt: -1 })
          .lean(),
      (doc) =>
        Boolean(
          doc &&
            doc.financialSummary?.totalSalesForWeek === 150 &&
            doc.financialSummary?.totalNetRevenue === 140,
        ),
    );
    expect(weekly?.financialSummary?.totalSalesForWeek).toBe(150);
    expect(weekly?.financialSummary?.totalNetRevenue).toBe(140);

    const monthly = await waitFor(
      () =>
        MonthlyBusinessReport.findOne({ businessId: business._id })
          .sort({ createdAt: -1 })
          .lean(),
      (doc) =>
        Boolean(
          doc &&
            doc.financialSummary?.totalSalesForMonth === 150 &&
            doc.financialSummary?.totalNetRevenue === 140,
        ),
    );
    expect(monthly?.financialSummary?.totalSalesForMonth).toBe(150);
    expect(monthly?.financialSummary?.totalNetRevenue).toBe(140);
  });

  it("repeated close calls are idempotent and keep rollups stable", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness();
    const token = await createManagerToken(business._id as Types.ObjectId);
    const report = await createActorSeededReport(business._id as Types.ObjectId);

    const firstClose = await app.inject({
      method: "PATCH",
      url: `/api/v1/dailySalesReports/${report._id}/close`,
      headers: { authorization: token },
    });
    expect(firstClose.statusCode, firstClose.body).toBe(200);

    const secondClose = await app.inject({
      method: "PATCH",
      url: `/api/v1/dailySalesReports/${report._id}/close`,
      headers: { authorization: token },
    });
    expect(secondClose.statusCode, secondClose.body).toBe(200);

    const refreshed = await DailySalesReport.findById(report._id).lean();
    expect(refreshed?.isDailyReportOpen).toBe(false);
    expect(refreshed?.dailyTotalSalesBeforeAdjustments).toBe(150);
    expect(refreshed?.dailyNetPaidAmount).toBe(140);

    const weekly = await waitFor(
      () =>
        WeeklyBusinessReport.findOne({ businessId: business._id })
          .sort({ createdAt: -1 })
          .lean(),
      (doc) =>
        Boolean(
          doc &&
            doc.financialSummary?.totalSalesForWeek === 150 &&
            doc.financialSummary?.totalNetRevenue === 140,
        ),
    );
    expect(weekly?.financialSummary?.totalSalesForWeek).toBe(150);
    expect(weekly?.financialSummary?.totalNetRevenue).toBe(140);

    const monthly = await waitFor(
      () =>
        MonthlyBusinessReport.findOne({ businessId: business._id })
          .sort({ createdAt: -1 })
          .lean(),
      (doc) =>
        Boolean(
          doc &&
            doc.financialSummary?.totalSalesForMonth === 150 &&
            doc.financialSummary?.totalNetRevenue === 140,
        ),
    );
    expect(monthly?.financialSummary?.totalSalesForMonth).toBe(150);
    expect(monthly?.financialSummary?.totalNetRevenue).toBe(140);
  });

  it("manual reconcile endpoint matches shared reconciliation core output for mixed statuses", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness();
    const token = await createManagerToken(business._id as Types.ObjectId);
    const customer = await User.create({
      personalDetails: {
        email: `cust-${Date.now()}@test.com`,
        password: "hashed",
        firstName: "Customer",
        lastName: "User",
        phoneNumber: "888",
        birthDate: new Date("1992-01-01"),
        gender: "Man",
        nationality: "USA",
        address: addr,
        idNumber: `CUST-${Date.now()}`,
        idType: "Passport",
        username: `cust-${Date.now()}`,
      },
      allUserRoles: ["Customer"],
    });
    const report = await DailySalesReport.create({
      businessId: business._id,
      dailyReferenceNumber: Date.now() + 100,
      isDailyReportOpen: true,
      timeCountdownToClose: Date.now() + 86400000,
      employeesDailySalesReport: [],
      selfOrderingSalesReport: [],
    });

    const deliveryPoint = await SalesPoint.create({
      businessId: business._id,
      salesPointName: "Delivery reconcile",
      salesPointType: "delivery",
    });
    const selfPoint = await SalesPoint.create({
      businessId: business._id,
      salesPointName: "Self reconcile",
      salesPointType: "table",
      selfOrdering: true,
    });
    const deliveryGood = await BusinessGood.create({
      businessId: business._id,
      name: "Delivery good",
      keyword: "delivery-good",
      mainCategory: "Food",
      onMenu: true,
      available: true,
      sellingPrice: 30,
      costPrice: 12,
    });
    const selfGood = await BusinessGood.create({
      businessId: business._id,
      name: "Self good",
      keyword: "self-good",
      mainCategory: "Food",
      onMenu: true,
      available: true,
      sellingPrice: 20,
      costPrice: 8,
    });
    const inviteGood = await BusinessGood.create({
      businessId: business._id,
      name: "Invite good",
      keyword: "invite-good",
      mainCategory: "Food",
      onMenu: true,
      available: true,
      sellingPrice: 10,
      costPrice: 4,
    });

    const deliverySI = await SalesInstance.create({
      businessId: business._id,
      salesPointId: deliveryPoint._id,
      dailyReferenceNumber: report.dailyReferenceNumber,
      guests: 1,
      salesInstanceStatus: "Occupied",
      openedAsRole: "customer",
      openedByUserId: customer._id,
    });
    const selfSI = await SalesInstance.create({
      businessId: business._id,
      salesPointId: selfPoint._id,
      dailyReferenceNumber: report.dailyReferenceNumber,
      guests: 1,
      salesInstanceStatus: "Occupied",
      openedAsRole: "customer",
      openedByUserId: customer._id,
    });

    await Order.create({
      businessId: business._id,
      businessGoodId: deliveryGood._id,
      salesInstanceId: deliverySI._id,
      createdByUserId: customer._id,
      dailyReferenceNumber: report.dailyReferenceNumber,
      billingStatus: "Paid",
      orderStatus: "Sent",
      orderGrossPrice: 30,
      orderNetPrice: 30,
      orderCostPrice: 12,
      paymentMethod: [
        { paymentMethodType: "Card", methodBranch: "Visa", methodSalesTotal: 30 },
      ],
    });
    await Order.create({
      businessId: business._id,
      businessGoodId: selfGood._id,
      salesInstanceId: selfSI._id,
      createdByUserId: customer._id,
      dailyReferenceNumber: report.dailyReferenceNumber,
      billingStatus: "Void",
      orderStatus: "Sent",
      orderGrossPrice: 20,
      orderNetPrice: 20,
      orderCostPrice: 8,
    });
    await Order.create({
      businessId: business._id,
      businessGoodId: inviteGood._id,
      salesInstanceId: selfSI._id,
      createdByUserId: customer._id,
      dailyReferenceNumber: report.dailyReferenceNumber,
      billingStatus: "Invitation",
      orderStatus: "Sent",
      orderGrossPrice: 10,
      orderNetPrice: 10,
      orderCostPrice: 4,
    });

    const reconcileResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/dailySalesReports/${report._id}/reconcile`,
      headers: { authorization: token },
    });
    expect(reconcileResponse.statusCode, reconcileResponse.body).toBe(200);

    const populatedOrders = await Order.find({
      businessId: business._id,
      dailyReferenceNumber: report.dailyReferenceNumber,
      billingStatus: { $in: ["Paid", "Void", "Invitation"] },
    })
      .select(
        "createdByUserId businessId dailyReferenceNumber salesInstanceId billingStatus orderGrossPrice orderNetPrice orderTips orderCostPrice paymentMethod businessGoodId addOns",
      )
      .populate({
        path: "salesInstanceId",
        select: "salesPointId",
        model: SalesInstance,
        populate: {
          path: "salesPointId",
          model: SalesPoint,
          select: "salesPointType",
        },
      })
      .lean();

    const expected = await buildReconciledDailyPayload({
      orders: populatedOrders as any,
      subscription: "Free",
    });
    const refreshed = await DailySalesReport.findById(report._id).lean();
    expect(refreshed?.dailyTotalSalesBeforeAdjustments).toBe(
      expected.dailyTotalSalesBeforeAdjustments,
    );
    expect(refreshed?.dailyNetPaidAmount).toBe(expected.dailyNetPaidAmount);
    expect(refreshed?.dailyTotalVoidValue).toBe(expected.dailyTotalVoidValue);
    expect(refreshed?.dailyTotalInvitedValue).toBe(
      expected.dailyTotalInvitedValue,
    );
  });

  it("R4: dailyReferenceNumber filters support exact/from/to/range and invalid inputs", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness();
    const token = await createManagerToken(business._id as Types.ObjectId);

    const r1 = await DailySalesReport.create({
      businessId: business._id,
      dailyReferenceNumber: 1001,
      isDailyReportOpen: true,
      timeCountdownToClose: Date.now() + 86400000,
      employeesDailySalesReport: [],
      selfOrderingSalesReport: [],
    });
    const r2 = await DailySalesReport.create({
      businessId: business._id,
      dailyReferenceNumber: 1002,
      isDailyReportOpen: true,
      timeCountdownToClose: Date.now() + 86400000,
      employeesDailySalesReport: [],
      selfOrderingSalesReport: [],
    });
    const r3 = await DailySalesReport.create({
      businessId: business._id,
      dailyReferenceNumber: 1003,
      isDailyReportOpen: true,
      timeCountdownToClose: Date.now() + 86400000,
      employeesDailySalesReport: [],
      selfOrderingSalesReport: [],
    });
    void r1;
    void r2;
    void r3;

    const exact = await app.inject({
      method: "GET",
      url: `/api/v1/dailySalesReports/business/${business._id}?dailyReferenceNumber=1002`,
      headers: { authorization: token },
    });
    expect(exact.statusCode, exact.body).toBe(200);
    const exactBody = JSON.parse(exact.body);
    expect(exactBody).toHaveLength(1);
    expect(exactBody[0].dailyReferenceNumber).toBe(1002);

    const fromOnly = await app.inject({
      method: "GET",
      url: `/api/v1/dailySalesReports/business/${business._id}?dailyReferenceNumberFrom=1002`,
      headers: { authorization: token },
    });
    expect(fromOnly.statusCode, fromOnly.body).toBe(200);
    const fromBody = JSON.parse(fromOnly.body) as Array<{ dailyReferenceNumber: number }>;
    expect(fromBody.every((x) => x.dailyReferenceNumber >= 1002)).toBe(true);

    const toOnly = await app.inject({
      method: "GET",
      url: `/api/v1/dailySalesReports/business/${business._id}?dailyReferenceNumberTo=1002`,
      headers: { authorization: token },
    });
    expect(toOnly.statusCode, toOnly.body).toBe(200);
    const toBody = JSON.parse(toOnly.body) as Array<{ dailyReferenceNumber: number }>;
    expect(toBody.every((x) => x.dailyReferenceNumber <= 1002)).toBe(true);

    const range = await app.inject({
      method: "GET",
      url: `/api/v1/dailySalesReports/business/${business._id}?dailyReferenceNumberFrom=1002&dailyReferenceNumberTo=1003`,
      headers: { authorization: token },
    });
    expect(range.statusCode, range.body).toBe(200);
    const rangeBody = JSON.parse(range.body) as Array<{ dailyReferenceNumber: number }>;
    expect(rangeBody.every((x) => x.dailyReferenceNumber >= 1002 && x.dailyReferenceNumber <= 1003)).toBe(true);

    const invalidExact = await app.inject({
      method: "GET",
      url: `/api/v1/dailySalesReports/business/${business._id}?dailyReferenceNumber=abc`,
      headers: { authorization: token },
    });
    const invalidExactBody = expectProblem(invalidExact, 400, "validation");
    expect(fieldPaths(invalidExactBody)).toContain("dailyReferenceNumber");

    const invalidFrom = await app.inject({
      method: "GET",
      url: `/api/v1/dailySalesReports/business/${business._id}?dailyReferenceNumberFrom=1.2`,
      headers: { authorization: token },
    });
    const invalidFromBody = expectProblem(invalidFrom, 400, "validation");
    expect(fieldPaths(invalidFromBody)).toContain("dailyReferenceNumberFrom");

    const invalidRange = await app.inject({
      method: "GET",
      url: `/api/v1/dailySalesReports/business/${business._id}?dailyReferenceNumberFrom=2000&dailyReferenceNumberTo=1000`,
      headers: { authorization: token },
    });
    const invalidRangeBody = expectProblem(invalidRange, 400, "bad-request");
    expect(invalidRangeBody.detail).toBe(
      "Invalid dailyReferenceNumber range, from must be <= to!",
    );
  });

  it("R4: date + operational-day filters combine and tenant scope is enforced", async () => {
    const app = await getTestApp();
    const business = await createTestBusiness();
    const token = await createManagerToken(business._id as Types.ObjectId);
    const otherBusiness = await createTestBusiness();
    const otherToken = await createManagerToken(otherBusiness._id as Types.ObjectId);

    const sameDayRef = 7001;
    const reportA = await DailySalesReport.create({
      businessId: business._id,
      dailyReferenceNumber: sameDayRef,
      isDailyReportOpen: true,
      timeCountdownToClose: Date.now() + 86400000,
      employeesDailySalesReport: [],
      selfOrderingSalesReport: [],
    });
    const reportB = await DailySalesReport.create({
      businessId: business._id,
      dailyReferenceNumber: 7002,
      isDailyReportOpen: true,
      timeCountdownToClose: Date.now() + 86400000,
      employeesDailySalesReport: [],
      selfOrderingSalesReport: [],
    });
    const currentDate = new Date().toISOString().slice(0, 10);

    const combined = await app.inject({
      method: "GET",
      url:
        `/api/v1/dailySalesReports/business/${business._id}` +
        `?startDate=${currentDate}&endDate=${currentDate}&dailyReferenceNumber=${sameDayRef}`,
      headers: { authorization: token },
    });
    expect(combined.statusCode, combined.body).toBe(200);
    const combinedBody = JSON.parse(combined.body);
    expect(combinedBody).toHaveLength(1);
    expect(combinedBody[0].dailyReferenceNumber).toBe(sameDayRef);

    const crossTenant = await app.inject({
      method: "GET",
      url: `/api/v1/dailySalesReports/business/${business._id}?dailyReferenceNumber=${sameDayRef}`,
      headers: { authorization: otherToken },
    });
    const crossTenantBody = expectProblem(crossTenant, 403, "forbidden");
    expect(crossTenantBody.detail).toBe("Forbidden");
  });

  describe("business-local date filters", () => {
    const seedReportAt = (
      businessId: Types.ObjectId,
      dailyReferenceNumber: number,
      createdAt: string,
    ) =>
      DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
        selfOrderingSalesReport: [],
        createdAt: new Date(createdAt),
      });

    const listByDay = (
      app: Awaited<ReturnType<typeof getTestApp>>,
      businessId: unknown,
      token: string,
      day: string,
    ) =>
      app.inject({
        method: "GET",
        url: `/api/v1/dailySalesReports/business/${businessId}?startDate=${day}&endDate=${day}`,
        headers: { authorization: token },
      });

    it("resolves a day in the business's timezone, not the server's", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness({ timezone: "Asia/Tokyo" });
      const token = await createManagerToken(business._id as Types.ObjectId);

      // 2026-10-12 05:00 in Tokyo (2026-10-11 20:00 UTC).
      await seedReportAt(
        business._id as Types.ObjectId,
        8001,
        "2026-10-11T20:00:00.000Z",
      );
      // 2026-10-13 00:00 in Tokyo (2026-10-12 15:00 UTC).
      await seedReportAt(
        business._id as Types.ObjectId,
        8002,
        "2026-10-12T15:00:00.000Z",
      );

      const response = await listByDay(app, business._id, token, "2026-10-12");
      expect(response.statusCode, response.body).toBe(200);
      const body = JSON.parse(response.body) as Array<{
        dailyReferenceNumber: number;
      }>;
      expect(body.map((r) => r.dailyReferenceNumber)).toEqual([8001]);
    });

    it("falls back to UTC when the business has no timezone", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const token = await createManagerToken(business._id as Types.ObjectId);

      await seedReportAt(
        business._id as Types.ObjectId,
        8101,
        "2026-10-11T20:00:00.000Z",
      );

      const response = await listByDay(app, business._id, token, "2026-10-11");
      expect(response.statusCode, response.body).toBe(200);
      const body = JSON.parse(response.body) as Array<{
        dailyReferenceNumber: number;
      }>;
      expect(body.map((r) => r.dailyReferenceNumber)).toEqual([8101]);
    });

    it("falls back to UTC without crashing when the stored timezone is invalid", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness({ timezone: "Not/AZone" });
      const token = await createManagerToken(business._id as Types.ObjectId);

      await seedReportAt(
        business._id as Types.ObjectId,
        8201,
        "2026-10-11T20:00:00.000Z",
      );

      const response = await listByDay(app, business._id, token, "2026-10-11");
      expect(response.statusCode, response.body).toBe(200);
      const body = JSON.parse(response.body) as Array<{
        dailyReferenceNumber: number;
      }>;
      expect(body.map((r) => r.dailyReferenceNumber)).toEqual([8201]);
    });

    it("rejects a date-time filter with a validation problem", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const token = await createManagerToken(business._id as Types.ObjectId);

      for (const value of [
        "2026-10-11T15:30:00.000Z",
        "2026-10-11T15:30:00",
      ]) {
        const response = await app.inject({
          method: "GET",
          url:
            `/api/v1/dailySalesReports/business/${business._id}` +
            `?startDate=${encodeURIComponent(value)}`,
          headers: { authorization: token },
        });
        const body = expectProblem(response, 400, "validation");
        expect(fieldPaths(body)).toContain("startDate");
      }
    });

    it("rejects a reversed date range as a named cross-field problem", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const token = await createManagerToken(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url:
          `/api/v1/dailySalesReports/business/${business._id}` +
          `?startDate=2026-10-12&endDate=2026-10-11`,
        headers: { authorization: token },
      });
      const body = expectProblem(response, 400, "bad-request");
      expect(body.detail).toBe(
        "Invalid date range, start date must be before end date!",
      );
    });
  });

  describe("DTO validation and problem-details errors", () => {
    it("returns 400 validation for a malformed report id", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const token = await createManagerToken(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dailySalesReports/not-an-object-id",
        headers: { authorization: token },
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("dailySalesReportId");
    });

    it("returns 400 validation for a malformed business id", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const token = await createManagerToken(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dailySalesReports/business/not-an-object-id",
        headers: { authorization: token },
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("businessId");
    });

    it("returns 400 validation when calculateUsersReport userIds are missing", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const token = await createManagerToken(business._id as Types.ObjectId);
      const report = await createActorSeededReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/dailySalesReports/${report._id}/calculateUsersReport`,
        headers: { authorization: token },
        payload: {},
      });

      const body = expectProblem(response, 400, "validation");
      expect(fieldPaths(body)).toContain("userIds");
    });

    it("returns 400 validation when calculateUsersReport userIds are empty or malformed", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const token = await createManagerToken(business._id as Types.ObjectId);
      const report = await createActorSeededReport(business._id as Types.ObjectId);

      const empty = await app.inject({
        method: "PATCH",
        url: `/api/v1/dailySalesReports/${report._id}/calculateUsersReport`,
        headers: { authorization: token },
        payload: { userIds: [] },
      });
      const emptyBody = expectProblem(empty, 400, "validation");
      expect(fieldPaths(emptyBody)).toContain("userIds");

      const malformed = await app.inject({
        method: "PATCH",
        url: `/api/v1/dailySalesReports/${report._id}/calculateUsersReport`,
        headers: { authorization: token },
        payload: { userIds: ["not-an-object-id"] },
      });
      const malformedBody = expectProblem(malformed, 400, "validation");
      expect(
        fieldPaths(malformedBody).some((path) => path.startsWith("userIds")),
      ).toBe(true);
    });

    it("rejects server-owned or unknown body fields", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const token = await createManagerToken(business._id as Types.ObjectId);
      const report = await createActorSeededReport(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/dailySalesReports/${report._id}/calculateUsersReport`,
        headers: { authorization: token },
        payload: {
          userIds: [new Types.ObjectId().toString()],
          dailyReferenceNumber: 1234,
        },
      });

      expectProblem(response, 400, "validation");
    });

    it("returns 404 when a report does not exist", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const token = await createManagerToken(business._id as Types.ObjectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/dailySalesReports/${new Types.ObjectId()}`,
        headers: { authorization: token },
      });

      const body = expectProblem(response, 404, "not-found");
      expect(body.detail).toBe("Daily report not found!");
    });

    it("returns 403 when a report belongs to another business", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const otherBusiness = await createTestBusiness();
      const token = await createManagerToken(business._id as Types.ObjectId);
      const otherReport = await createActorSeededReport(
        otherBusiness._id as Types.ObjectId,
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/dailySalesReports/${otherReport._id}`,
        headers: { authorization: token },
      });

      const body = expectProblem(response, 403, "forbidden");
      expect(body.detail).toBe("Forbidden");
    });

    it("returns 401 without authentication", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/dailySalesReports",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("business-local rollup boundaries", () => {
    const seedClosedReport = (
      businessId: Types.ObjectId,
      dailyReferenceNumber: number,
      createdAt: Date,
      netPaid: number,
    ) =>
      DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: false,
        timeCountdownToClose: Date.now() + 86400000,
        dailyTotalSalesBeforeAdjustments: netPaid,
        dailyNetPaidAmount: netPaid,
        businessPaymentMethods: [],
        dailySoldGoods: [],
        dailyVoidedGoods: [],
        dailyInvitedGoods: [],
        createdAt,
      });

    const createOpenTriggerReport = (
      businessId: Types.ObjectId,
      dailyReferenceNumber: number,
    ) =>
      DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
        selfOrderingSalesReport: [],
        businessPaymentMethods: [],
        dailySoldGoods: [],
        dailyVoidedGoods: [],
        dailyInvitedGoods: [],
      });

    /**
     * Seeds four closed reports straddling a period's UTC bounds (just before
     * the start, exactly at the start, exactly at the end, just after the end)
     * plus one open trigger report used to drive the rollup through the route.
     * The two interior reports are the ones the period should contain.
     */
    const seedPeriodAndTrigger = async (
      businessId: Types.ObjectId,
      bounds: { start: Date; end: Date },
      numbers: [number, number, number, number, number],
    ) => {
      await Promise.all([
        seedClosedReport(
          businessId,
          numbers[0],
          new Date(bounds.start.getTime() - 1),
          1000,
        ),
        seedClosedReport(businessId, numbers[1], bounds.start, 2000),
        seedClosedReport(businessId, numbers[2], bounds.end, 4000),
        seedClosedReport(
          businessId,
          numbers[3],
          new Date(bounds.end.getTime() + 1),
          8000,
        ),
      ]);
      return createOpenTriggerReport(businessId, numbers[4]);
    };

    const closeReport = (
      app: Awaited<ReturnType<typeof getTestApp>>,
      reportId: Types.ObjectId,
      token: string,
    ) =>
      app.inject({
        method: "PATCH",
        url: `/api/v1/dailySalesReports/${reportId}/close`,
        headers: { authorization: token },
      });

    it("buckets a week on business-local boundaries east of UTC", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness({ timezone: "Asia/Tokyo" });
      const businessId = business._id as Types.ObjectId;
      const token = await createManagerToken(businessId);

      const bounds = resolveWeekBounds(
        resolveLocalDate(new Date(), "Asia/Tokyo"),
        "Asia/Tokyo",
        1,
      );
      const trigger = await seedPeriodAndTrigger(businessId, bounds, [
        9101, 9102, 9103, 9104, 9105,
      ]);

      const response = await closeReport(
        app,
        trigger._id as Types.ObjectId,
        token,
      );
      expect(response.statusCode, response.body).toBe(200);

      const weekly = await WeeklyBusinessReport.findOne({ businessId }).lean();
      expect(weekly?.financialSummary?.totalSalesForWeek).toBe(6000);
      expect(weekly?.financialSummary?.totalNetRevenue).toBe(6000);
    });

    it("honors the configured weekly start day", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness({
        timezone: "Asia/Tokyo",
        reportingConfig: { weeklyReportStartDay: 0 },
      });
      const businessId = business._id as Types.ObjectId;
      const token = await createManagerToken(businessId);

      const bounds = resolveWeekBounds(
        resolveLocalDate(new Date(), "Asia/Tokyo"),
        "Asia/Tokyo",
        0,
      );
      const trigger = await seedPeriodAndTrigger(businessId, bounds, [
        9201, 9202, 9203, 9204, 9205,
      ]);

      const response = await closeReport(
        app,
        trigger._id as Types.ObjectId,
        token,
      );
      expect(response.statusCode, response.body).toBe(200);

      const weekly = await WeeklyBusinessReport.findOne({ businessId }).lean();
      expect(weekly?.financialSummary?.totalSalesForWeek).toBe(6000);
    });

    it("falls back to UTC week boundaries when the business has no timezone", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const businessId = business._id as Types.ObjectId;
      const token = await createManagerToken(businessId);

      const bounds = resolveWeekBounds(resolveLocalDate(new Date(), "UTC"), "UTC", 1);
      const trigger = await seedPeriodAndTrigger(businessId, bounds, [
        9301, 9302, 9303, 9304, 9305,
      ]);

      const response = await closeReport(
        app,
        trigger._id as Types.ObjectId,
        token,
      );
      expect(response.statusCode, response.body).toBe(200);

      const weekly = await WeeklyBusinessReport.findOne({ businessId }).lean();
      expect(weekly?.financialSummary?.totalSalesForWeek).toBe(6000);
    });

    it("buckets a month on business-local boundaries west of UTC", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness({ timezone: "America/Bogota" });
      const businessId = business._id as Types.ObjectId;
      const token = await createManagerToken(businessId);

      const bounds = resolveMonthBounds(
        resolveLocalDate(new Date(), "America/Bogota"),
        "America/Bogota",
      );
      const trigger = await seedPeriodAndTrigger(businessId, bounds, [
        9401, 9402, 9403, 9404, 9405,
      ]);

      const response = await closeReport(
        app,
        trigger._id as Types.ObjectId,
        token,
      );
      expect(response.statusCode, response.body).toBe(200);

      const monthly = await MonthlyBusinessReport.findOne({ businessId }).lean();
      expect(monthly?.financialSummary?.totalSalesForMonth).toBe(6000);
      expect(monthly?.financialSummary?.totalNetRevenue).toBe(6000);
    });

    it("falls back to UTC month boundaries when the business has no timezone", async () => {
      const app = await getTestApp();
      const business = await createTestBusiness();
      const businessId = business._id as Types.ObjectId;
      const token = await createManagerToken(businessId);

      const bounds = resolveMonthBounds(resolveLocalDate(new Date(), "UTC"), "UTC");
      const trigger = await seedPeriodAndTrigger(businessId, bounds, [
        9501, 9502, 9503, 9504, 9505,
      ]);

      const response = await closeReport(
        app,
        trigger._id as Types.ObjectId,
        token,
      );
      expect(response.statusCode, response.body).toBe(200);

      const monthly = await MonthlyBusinessReport.findOne({ businessId }).lean();
      expect(monthly?.financialSummary?.totalSalesForMonth).toBe(6000);
    });
  });
});
