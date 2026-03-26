/**
 * Daily Sales Report Helpers Tests - Task 0.8
 * Tests for createDailySalesReport and updateEmployeeDailySalesReport
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Types } from "mongoose";
import reconcileEmployeesDailySalesReport from "../../src/dailySalesReports/updateEmployeeDailySalesReport.ts";
import applyOrderFinalizationToActorReport from "../../src/dailySalesReports/applyOrderFinalizationToActorReport.ts";
import closeOrders from "../../src/orders/closeOrders.ts";
import finalizeOrdersBillingStatus from "../../src/orders/finalizeOrdersBillingStatus.ts";
import {
  mergeGoods,
  mergePaymentMethods,
  updateTopLevelFromActorRows,
} from "../../src/dailySalesReports/reconciliationCore.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";
import Business from "../../src/models/business.ts";
import User from "../../src/models/user.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import SalesInstance from "../../src/models/salesInstance.ts";
import Order from "../../src/models/order.ts";
import Reservation from "../../src/models/reservation.ts";

describe("Daily Sales Report Helpers", () => {
  const businessId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  describe("createDailySalesReport", () => {
    it("function exists and is callable", async () => {
      const { default: createDailySalesReport } = await import(
        "../../src/dailySalesReports/createDailySalesReport.ts"
      );
      expect(typeof createDailySalesReport).toBe("function");
    });
  });

  describe("updateEmployeesDailySalesReport", () => {
    beforeEach(async () => {
      const dailyReferenceNumber = Date.now();
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
      });
    });

    it("returns error for invalid userIds", async () => {
      const result = await reconcileEmployeesDailySalesReport(
        ["invalid-id"] as any,
        Date.now()
      );

      expect(result.errors).toContain("Invalid userIds!");
      expect(result.updatedEmployees).toHaveLength(0);
    });

    it("returns error when dailyReferenceNumber is missing", async () => {
      const result = await reconcileEmployeesDailySalesReport(
        [userId],
        0 // falsy value
      );

      expect(result.errors).toContain("UserIds and dailyReferenceNumber are required!");
      expect(result.updatedEmployees).toHaveLength(0);
    });

    it("returns empty report for user with no sales instances", async () => {
      const dailyRefNum = Date.now();
      
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber: dailyRefNum,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
      });

      const result = await reconcileEmployeesDailySalesReport([userId], dailyRefNum);

      expect(result.errors).toHaveLength(0);
      expect(result.updatedEmployees).toHaveLength(1);
      expect(result.updatedEmployees[0].userId.toString()).toBe(userId.toString());
      expect(result.updatedEmployees[0].totalNetPaidAmount).toBe(0);
      expect(result.updatedEmployees[0].totalTipsReceived).toBe(0);
      expect(result.updatedEmployees[0].totalCustomersServed).toBe(0);
    });

    it("handles multiple users", async () => {
      const dailyRefNum = Date.now() + 1;
      const userId2 = new Types.ObjectId();
      
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber: dailyRefNum,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
      });

      const result = await reconcileEmployeesDailySalesReport(
        [userId, userId2],
        dailyRefNum
      );

      expect(result.errors).toHaveLength(0);
      expect(result.updatedEmployees).toHaveLength(2);
    });

    it("initializes employee report with correct default values", async () => {
      const dailyRefNum = Date.now() + 2;
      
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber: dailyRefNum,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
        employeesDailySalesReport: [],
      });

      const result = await reconcileEmployeesDailySalesReport([userId], dailyRefNum);

      expect(result.updatedEmployees).toHaveLength(1);
      const report = result.updatedEmployees[0];
      
      expect(report.hasOpenSalesInstances).toBe(false);
      expect(report.employeePaymentMethods).toEqual([]);
      expect(report.totalSalesBeforeAdjustments).toBe(0);
      expect(report.totalNetPaidAmount).toBe(0);
      expect(report.totalTipsReceived).toBe(0);
      expect(report.totalCostOfGoodsSold).toBe(0);
      expect(report.totalCustomersServed).toBe(0);
      expect(report.averageCustomerExpenditure).toBe(0);
    });
  });

  describe("applyOrderFinalizationToActorReport (T1 delta unit tests)", () => {
    it("Paid event updates payment/gross/net/tips/cogs/sold goods", async () => {
      const dailyReferenceNumber = Date.now() + 10;
      const salesPointId = new Types.ObjectId();
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
      });

      const result = await applyOrderFinalizationToActorReport({
        businessId,
        dailyReferenceNumber,
        targetBucket: "employeesDailySalesReport",
        attribution: { userId },
        order: {
          billingStatus: "Paid",
          orderGrossPrice: 100,
          orderNetPrice: 90,
          orderTips: 10,
          orderCostPrice: 40,
          paymentMethod: [
            {
              paymentMethodType: "Card",
              methodBranch: "Visa",
              methodSalesTotal: 90,
            },
          ],
          goods: [
            {
              businessGoodId: salesPointId,
              quantity: 1,
              totalPrice: 90,
              totalCostPrice: 40,
            },
          ],
        },
      });

      expect(result.applied).toBe(true);

      const report = await DailySalesReport.findOne({
        businessId,
        dailyReferenceNumber,
      }).lean();
      const row = report?.employeesDailySalesReport?.[0] as any;
      expect(row.totalSalesBeforeAdjustments).toBe(100);
      expect(row.totalNetPaidAmount).toBe(90);
      expect(row.totalTipsReceived).toBe(10);
      expect(row.totalCostOfGoodsSold).toBe(40);
      expect(row.employeePaymentMethods?.[0]?.methodSalesTotal).toBe(90);
      expect(row.soldGoods?.[0]?.quantity).toBe(1);
    });

    it("Void and Invitation update correct buckets and values", async () => {
      const dailyReferenceNumber = Date.now() + 11;
      const businessGoodId = new Types.ObjectId();
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
      });

      const voidResult = await applyOrderFinalizationToActorReport({
        businessId,
        dailyReferenceNumber,
        targetBucket: "employeesDailySalesReport",
        attribution: { userId },
        order: {
          billingStatus: "Void",
          orderCostPrice: 15,
          goods: [
            {
              businessGoodId,
              quantity: 1,
              totalPrice: 25,
              totalCostPrice: 15,
            },
          ],
        },
      });
      expect(voidResult.applied).toBe(true);

      const invitationResult = await applyOrderFinalizationToActorReport({
        businessId,
        dailyReferenceNumber,
        targetBucket: "employeesDailySalesReport",
        attribution: { userId },
        order: {
          billingStatus: "Invitation",
          orderCostPrice: 8,
          goods: [
            {
              businessGoodId,
              quantity: 2,
              totalPrice: 30,
              totalCostPrice: 8,
            },
          ],
        },
      });
      expect(invitationResult.applied).toBe(true);

      const report = await DailySalesReport.findOne({
        businessId,
        dailyReferenceNumber,
      }).lean();
      const row = report?.employeesDailySalesReport?.[0] as any;
      expect(row.voidedGoods?.length).toBe(1);
      expect(row.invitedGoods?.length).toBe(1);
      expect(row.totalVoidValue).toBe(25);
      expect(row.totalInvitedValue).toBe(30);
      expect(row.totalCostOfGoodsSold).toBe(23);
    });

    it("Cancel policy is excluded (no mutation applied)", async () => {
      const dailyReferenceNumber = Date.now() + 12;
      await DailySalesReport.create({
        businessId,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
      });

      const result = await applyOrderFinalizationToActorReport({
        businessId,
        dailyReferenceNumber,
        targetBucket: "employeesDailySalesReport",
        attribution: { userId },
        order: {
          billingStatus: "Cancel",
          orderGrossPrice: 100,
          orderNetPrice: 80,
        },
      });

      expect(result.applied).toBe(false);
      expect(result.reason).toContain("Cancel");
      const report = await DailySalesReport.findOne({
        businessId,
        dailyReferenceNumber,
      }).lean();
      expect(report?.employeesDailySalesReport).toBeUndefined();
    });
  });

  describe("Idempotency guard (T1 duplicate event)", () => {
    it("duplicate close attempt does not double count actor totals", async () => {
      const session = await (await import("mongoose")).default.startSession();
      const unique = Date.now().toString();
      const managerUserId = new Types.ObjectId();
      const businessGoodId = new Types.ObjectId();

      const createdBusiness = await Business.create({
        tradeName: "B",
        legalName: "B LLC",
        email: `b${unique}@x.com`,
        password: "hashed",
        phoneNumber: "1111111111",
        taxNumber: `TAX-B-${unique}`,
        currencyTrade: "USD",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main",
          buildingNumber: "1",
          postCode: "90001",
        },
      });

      await User.create({
        _id: managerUserId,
        personalDetails: {
          firstName: "A",
          lastName: "B",
          phoneNumber: "1111111112",
          birthDate: new Date("1990-01-01"),
          email: `u${unique}@x.com`,
          username: `user-${unique}`,
          password: "hashed-password",
          idType: "National ID",
          idNumber: `ID-${unique}`,
          nationality: "US",
          gender: "Other",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main",
            buildingNumber: "10",
            postCode: "90001",
          },
        },
      });

      const salesPoint = await SalesPoint.create({
        salesPointName: "T1",
        salesPointType: "table",
        businessId: createdBusiness._id,
      });

      const dailyReferenceNumber = Number(unique.slice(-8));
      await DailySalesReport.create({
        businessId: createdBusiness._id,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
      });

      const orderDoc = await Order.create({
        dailyReferenceNumber,
        billingStatus: "Open",
        orderStatus: "Sent",
        orderGrossPrice: 100,
        orderNetPrice: 90,
        orderCostPrice: 40,
        createdByUserId: managerUserId,
        createdAsRole: "employee",
        salesInstanceId: new Types.ObjectId(),
        businessGoodId,
        businessId: createdBusiness._id,
      });

      const salesInstance = await SalesInstance.create({
        dailyReferenceNumber,
        salesPointId: salesPoint._id,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: managerUserId,
        openedAsRole: "employee",
        responsibleByUserId: managerUserId,
        businessId: createdBusiness._id,
        salesGroup: [{ orderCode: "A1", ordersIds: [orderDoc._id] }],
      });

      await Order.updateOne(
        { _id: orderDoc._id },
        { $set: { salesInstanceId: salesInstance._id } },
      );

      session.startTransaction();
      const first = await closeOrders(
        [orderDoc._id],
        [{ paymentMethodType: "Card", methodBranch: "Visa", methodSalesTotal: 90 }],
        salesInstance._id,
        session,
      );
      if (first !== true) {
        await session.abortTransaction();
        session.endSession();
        throw new Error(`first close failed: ${first}`);
      }
      await session.commitTransaction();
      session.endSession();

      const reportAfterFirst = await DailySalesReport.findOne({
        businessId: createdBusiness._id,
        dailyReferenceNumber,
      }).lean();
      const firstNet =
        (reportAfterFirst?.employeesDailySalesReport ?? []).reduce(
          (acc: number, row: any) => acc + (row?.totalNetPaidAmount ?? 0),
          0,
        ) +
        ((reportAfterFirst?.deliveryDailySalesReport as any)?.totalNetPaidAmount ??
          0) +
        (reportAfterFirst?.selfOrderingSalesReport ?? []).reduce(
          (acc: number, row: any) => acc + (row?.totalNetPaidAmount ?? 0),
          0,
        );
      expect(firstNet).toBe(90);

      const session2 = await (await import("mongoose")).default.startSession();
      session2.startTransaction();
      const second = await closeOrders(
        [orderDoc._id],
        [{ paymentMethodType: "Card", methodBranch: "Visa", methodSalesTotal: 90 }],
        salesInstance._id,
        session2,
      );
      expect(second).toBe("No open orders found!");
      await session2.abortTransaction();
      session2.endSession();

      const reportAfterSecond = await DailySalesReport.findOne({
        businessId: createdBusiness._id,
        dailyReferenceNumber,
      }).lean();
      const secondNet =
        (reportAfterSecond?.employeesDailySalesReport ?? []).reduce(
          (acc: number, row: any) => acc + (row?.totalNetPaidAmount ?? 0),
          0,
        ) +
        ((reportAfterSecond?.deliveryDailySalesReport as any)?.totalNetPaidAmount ??
          0) +
        (reportAfterSecond?.selfOrderingSalesReport ?? []).reduce(
          (acc: number, row: any) => acc + (row?.totalNetPaidAmount ?? 0),
          0,
        );
      expect(secondNet).toBe(90);

      await Reservation.deleteMany({});
    });
  });

  describe("R1 Open->Void/Invitation transitions", () => {
    it("Open -> Void and Open -> Invitation update correct buckets once and are idempotent", async () => {
      const mongoose = (await import("mongoose")).default;
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const createdBusiness = await Business.create({
        tradeName: `R1-${unique}`,
        legalName: `R1 LLC ${unique}`,
        email: `r1-${unique}@x.com`,
        password: "hashed",
        phoneNumber: "1111111113",
        taxNumber: `TAX-R1-${unique}`,
        currencyTrade: "USD",
        address: {
          country: "USA",
          state: "CA",
          city: "LA",
          street: "Main",
          buildingNumber: "1",
          postCode: "90001",
        },
      });

      const customerId = new Types.ObjectId();
      await User.create({
        _id: customerId,
        personalDetails: {
          firstName: "Cust",
          lastName: "R1",
          phoneNumber: "1111111114",
          birthDate: new Date("1990-01-01"),
          email: `cust-r1-${unique}@x.com`,
          username: `cust-r1-${unique}`,
          password: "hashed-password",
          idType: "National ID",
          idNumber: `ID-R1-${unique}`,
          nationality: "US",
          gender: "Other",
          address: {
            country: "USA",
            state: "CA",
            city: "LA",
            street: "Main",
            buildingNumber: "11",
            postCode: "90001",
          },
        },
      });

      const deliveryPoint = await SalesPoint.create({
        salesPointName: "Delivery-R1",
        salesPointType: "delivery",
        businessId: createdBusiness._id,
      });
      const tablePoint = await SalesPoint.create({
        salesPointName: "Table-R1",
        salesPointType: "table",
        businessId: createdBusiness._id,
      });

      const dailyReferenceNumber = Number(String(Date.now()).slice(-8));
      await DailySalesReport.create({
        businessId: createdBusiness._id,
        dailyReferenceNumber,
        isDailyReportOpen: true,
        timeCountdownToClose: Date.now() + 86400000,
      });

      const deliveryOrder = await Order.create({
        dailyReferenceNumber,
        billingStatus: "Open",
        orderStatus: "Sent",
        orderGrossPrice: 50,
        orderNetPrice: 50,
        orderCostPrice: 20,
        createdByUserId: customerId,
        createdAsRole: "customer",
        salesInstanceId: new Types.ObjectId(),
        businessGoodId: new Types.ObjectId(),
        businessId: createdBusiness._id,
      });
      const selfOrder = await Order.create({
        dailyReferenceNumber,
        billingStatus: "Open",
        orderStatus: "Sent",
        orderGrossPrice: 30,
        orderNetPrice: 30,
        orderCostPrice: 10,
        createdByUserId: customerId,
        createdAsRole: "customer",
        salesInstanceId: new Types.ObjectId(),
        businessGoodId: new Types.ObjectId(),
        businessId: createdBusiness._id,
      });

      const deliverySi = await SalesInstance.create({
        dailyReferenceNumber,
        salesPointId: deliveryPoint._id,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: customerId,
        openedAsRole: "customer",
        businessId: createdBusiness._id,
        salesGroup: [{ orderCode: "R1D", ordersIds: [deliveryOrder._id] }],
      });
      const selfSi = await SalesInstance.create({
        dailyReferenceNumber,
        salesPointId: tablePoint._id,
        guests: 1,
        salesInstanceStatus: "Occupied",
        openedByUserId: customerId,
        openedAsRole: "customer",
        businessId: createdBusiness._id,
        salesGroup: [{ orderCode: "R1S", ordersIds: [selfOrder._id] }],
      });

      await Order.updateOne(
        { _id: deliveryOrder._id },
        { $set: { salesInstanceId: deliverySi._id } },
      );
      await Order.updateOne(
        { _id: selfOrder._id },
        { $set: { salesInstanceId: selfSi._id } },
      );

      const s1 = await mongoose.startSession();
      s1.startTransaction();
      const firstVoid = await finalizeOrdersBillingStatus(
        [deliveryOrder._id],
        deliverySi._id,
        "Void",
        s1,
      );
      expect(firstVoid).toBe(true);
      await s1.commitTransaction();
      s1.endSession();

      const s2 = await mongoose.startSession();
      s2.startTransaction();
      const firstInvitation = await finalizeOrdersBillingStatus(
        [selfOrder._id],
        selfSi._id,
        "Invitation",
        s2,
      );
      expect(firstInvitation).toBe(true);
      await s2.commitTransaction();
      s2.endSession();

      const afterFirst = await DailySalesReport.findOne({
        businessId: createdBusiness._id,
        dailyReferenceNumber,
      }).lean();
      expect((afterFirst?.deliveryDailySalesReport as any)?.totalVoidValue).toBe(50);
      expect(
        (afterFirst?.selfOrderingSalesReport?.[0] as any)?.totalInvitedValue,
      ).toBe(30);

      const s3 = await mongoose.startSession();
      s3.startTransaction();
      const secondVoid = await finalizeOrdersBillingStatus(
        [deliveryOrder._id],
        deliverySi._id,
        "Void",
        s3,
      );
      expect(secondVoid).toBe("No open orders found!");
      await s3.abortTransaction();
      s3.endSession();

      const s4 = await mongoose.startSession();
      s4.startTransaction();
      const secondInvitation = await finalizeOrdersBillingStatus(
        [selfOrder._id],
        selfSi._id,
        "Invitation",
        s4,
      );
      expect(secondInvitation).toBe("No open orders found!");
      await s4.abortTransaction();
      s4.endSession();

      const afterSecond = await DailySalesReport.findOne({
        businessId: createdBusiness._id,
        dailyReferenceNumber,
      }).lean();
      expect((afterSecond?.deliveryDailySalesReport as any)?.totalVoidValue).toBe(50);
      expect(
        (afterSecond?.selfOrderingSalesReport?.[0] as any)?.totalInvitedValue,
      ).toBe(30);
    });
  });

  describe("R3 shared reconciliation primitives", () => {
    it("mergePaymentMethods merges by type+branch", () => {
      const merged = mergePaymentMethods(
        [
          {
            paymentMethodType: "Card",
            methodBranch: "Visa",
            methodSalesTotal: 10,
          },
        ],
        [
          {
            paymentMethodType: "Card",
            methodBranch: "Visa",
            methodSalesTotal: 5,
          },
          {
            paymentMethodType: "Cash",
            methodBranch: "Cash",
            methodSalesTotal: 8,
          },
        ],
      );
      expect(merged).toHaveLength(2);
      const visa = merged?.find(
        (p) => p.paymentMethodType === "Card" && p.methodBranch === "Visa",
      );
      expect(visa?.methodSalesTotal).toBe(15);
    });

    it("mergeGoods and top-level rollup compute expected totals", () => {
      const goodA = new Types.ObjectId();
      const goodB = new Types.ObjectId();
      const mergedGoods = mergeGoods(
        [{ businessGoodId: goodA, quantity: 1, totalPrice: 10, totalCostPrice: 4 }],
        [
          { businessGoodId: goodA, quantity: 2, totalPrice: 20, totalCostPrice: 8 },
          { businessGoodId: goodB, quantity: 1, totalPrice: 5, totalCostPrice: 2 },
        ],
      );
      expect(mergedGoods).toHaveLength(2);
      const mergedA = mergedGoods?.find((g) => String(g.businessGoodId) === String(goodA));
      expect(mergedA?.quantity).toBe(3);
      expect(mergedA?.totalPrice).toBe(30);

      const top = updateTopLevelFromActorRows({
        employeesDailySalesReport: [
          {
            userId: new Types.ObjectId(),
            totalSalesBeforeAdjustments: 50,
            totalNetPaidAmount: 45,
            totalTipsReceived: 5,
            totalCostOfGoodsSold: 20,
            totalVoidValue: 0,
            totalInvitedValue: 0,
            employeePaymentMethods: [
              {
                paymentMethodType: "Card",
                methodBranch: "Visa",
                methodSalesTotal: 45,
              },
            ],
            soldGoods: [{ businessGoodId: goodA, quantity: 1, totalPrice: 45, totalCostPrice: 20 }],
            voidedGoods: [],
            invitedGoods: [],
          } as any,
        ],
        deliveryDailySalesReport: {
          userId: new Types.ObjectId(),
          totalSalesBeforeAdjustments: 10,
          totalNetPaidAmount: 10,
          totalTipsReceived: 0,
          totalCostOfGoodsSold: 4,
          totalVoidValue: 0,
          totalInvitedValue: 0,
          employeePaymentMethods: [
            {
              paymentMethodType: "Cash",
              methodBranch: "Cash",
              methodSalesTotal: 10,
            },
          ],
          soldGoods: [{ businessGoodId: goodB, quantity: 1, totalPrice: 10, totalCostPrice: 4 }],
          voidedGoods: [],
          invitedGoods: [],
        } as any,
        selfOrderingSalesReport: [],
      });

      expect(top.dailyTotalSalesBeforeAdjustments).toBe(60);
      expect(top.dailyNetPaidAmount).toBe(55);
      expect(top.dailyCostOfGoodsSold).toBe(24);
      expect(top.dailyProfit).toBe(31);
      expect(top.businessPaymentMethods.length).toBe(2);
    });
  });
});
