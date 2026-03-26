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

describe("DailySalesReports routes - Task T2 integration", () => {
  const addr = {
    country: "USA",
    state: "CA",
    city: "Los Angeles",
    street: "Main St",
    buildingNumber: "123",
    postCode: "90001",
  };

  const createTestBusiness = async () =>
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
    expect(blocked.statusCode).toBe(400);

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
    expect(invalidExact.statusCode).toBe(400);

    const invalidFrom = await app.inject({
      method: "GET",
      url: `/api/v1/dailySalesReports/business/${business._id}?dailyReferenceNumberFrom=1.2`,
      headers: { authorization: token },
    });
    expect(invalidFrom.statusCode).toBe(400);

    const invalidRange = await app.inject({
      method: "GET",
      url: `/api/v1/dailySalesReports/business/${business._id}?dailyReferenceNumberFrom=2000&dailyReferenceNumberTo=1000`,
      headers: { authorization: token },
    });
    expect(invalidRange.statusCode).toBe(400);
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
    expect(crossTenant.statusCode).toBe(403);
  });
});
