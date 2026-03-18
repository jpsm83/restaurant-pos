import connectDb from "@/lib/db/connectDb";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// imported utils
import { handleApiError } from "@/lib/db/handleApiError";
import { updateEmployeesDailySalesReport } from "../../utils/updateEmployeeDailySalesReport";
import { aggregateDailyReportsIntoMonthly } from "@/app/api/v1/monthlyBusinessReport/utils/aggregateDailyReportsIntoMonthly";

// imported interfaces
import { IGoodsReduced } from "@shared/interfaces/IDailySalesReport";
import { IEmployee } from "@shared/interfaces/IEmployee";

// imported models
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import Employee from "@/lib/db/models/employee";
import User from "@/lib/db/models/user";
import Business from "@/lib/db/models/business";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { IPaymentMethod } from "@shared/interfaces/IPaymentMethod";
import { DELIVERY_ATTRIBUTION_USER_ID, MANAGEMENT_ROLES } from "@/lib/constants";

// @desc    Calculate the business daily sales report
// @route   PATCH /dailySalesReports/:dailySalesReportId/calculateBusinessDailySalesReport
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { dailySalesReportId: Types.ObjectId } }
) => {
  try {
    const dailySalesReportId = context.params.dailySalesReportId;

    const token = await getToken({
      req: req as Parameters<typeof getToken>[0]["req"],
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token?.id || token.type !== "user") {
      return new NextResponse(
        JSON.stringify({ message: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    const userId = new Types.ObjectId(token.id as string);

    if (isObjectIdValid([dailySalesReportId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid dailySalesReport ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await connectDb();

    const dailySalesReport = (await DailySalesReport.findOne({
      _id: dailySalesReportId,
    })
      .select("dailyReferenceNumber businessId")
      .lean()) as {
      dailyReferenceNumber: number;
      businessId: Types.ObjectId | { _id: Types.ObjectId };
    } | null;

    if (!dailySalesReport) {
      return new NextResponse(
        JSON.stringify({ message: "Daily report not found!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const businessId =
      typeof dailySalesReport.businessId === "object" &&
      dailySalesReport.businessId !== null &&
      "_id" in dailySalesReport.businessId
        ? (dailySalesReport.businessId as { _id: Types.ObjectId })._id
        : (dailySalesReport.businessId as Types.ObjectId);

    const employeeRoleOnDuty = (await Employee.findOne({
      userId,
      businessId,
    })
      .select("currentShiftRole")
      .lean()) as IEmployee | null;

    if (
      !employeeRoleOnDuty ||
      !MANAGEMENT_ROLES.includes(employeeRoleOnDuty.currentShiftRole ?? "")
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "You are not allowed to calculate the daily sales report!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const dailyReportWithUsers = await DailySalesReport.findOne({
      _id: dailySalesReportId,
    })
      .select(
        "_id dailyReferenceNumber employeesDailySalesReport.userId employeesDailySalesReport.hasOpenSalesInstances businessId"
      )
      .populate({
        path: "employeesDailySalesReport.userId",
        select: "personalDetails.firstName personalDetails.lastName",
        model: User,
      })
      .populate({ path: "businessId", select: "subscription", model: Business })
      .lean() as {
      _id: Types.ObjectId;
      dailyReferenceNumber: number;
      businessId: { _id: Types.ObjectId; subscription?: string } | Types.ObjectId;
      employeesDailySalesReport: { userId: { _id: Types.ObjectId } | Types.ObjectId }[];
    } | null;

    if (!dailyReportWithUsers) {
      return new NextResponse(
        JSON.stringify({ message: "Daily report not found!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let userIds = dailyReportWithUsers.employeesDailySalesReport.map(
      (emp: { userId: { _id: Types.ObjectId } | Types.ObjectId }) =>
        typeof emp.userId === "object" && emp.userId !== null && "_id" in emp.userId
          ? (emp.userId as { _id: Types.ObjectId })._id
          : (emp.userId as Types.ObjectId)
    );
    if (
      !userIds.some(
        (id: Types.ObjectId) => id.toString() === DELIVERY_ATTRIBUTION_USER_ID.toString()
      )
    ) {
      userIds = [...userIds, DELIVERY_ATTRIBUTION_USER_ID];
    }

    const updatedEmployeesDailySalesReport = await updateEmployeesDailySalesReport(
      userIds,
      dailyReportWithUsers.dailyReferenceNumber
    );

    if (updatedEmployeesDailySalesReport.errors.length > 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Some errors occurred while updating employees!",
          errors: updatedEmployeesDailySalesReport.errors,
        }),
        {
          status: 207,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const businessGoodsReport: {
      goodsSold: IGoodsReduced[];
      goodsVoid: IGoodsReduced[];
      goodsInvited: IGoodsReduced[];
    } = {
      goodsSold: [],
      goodsVoid: [],
      goodsInvited: [],
    };

    const dailySalesReportObj = {
      businessPaymentMethods: [] as IPaymentMethod[],
      dailyTotalSalesBeforeAdjustments: 0,
      dailyNetPaidAmount: 0,
      dailyTipsReceived: 0,
      dailyCostOfGoodsSold: 0,
      dailyProfit: 0,
      dailyCustomersServed: 0,
      dailyAverageCustomerExpenditure: 0,
      dailySoldGoods: [] as IGoodsReduced[],
      dailyVoidedGoods: [] as IGoodsReduced[],
      dailyInvitedGoods: [] as IGoodsReduced[],
      dailyTotalVoidValue: 0,
      dailyTotalInvitedValue: 0,
      dailyPosSystemCommission: 0,
    };

    if (Array.isArray(updatedEmployeesDailySalesReport.updatedEmployees)) {
      updatedEmployeesDailySalesReport.updatedEmployees.forEach(
        (employeeReport) => {
          if (employeeReport.employeePaymentMethods) {
            employeeReport.employeePaymentMethods.forEach(
              (payment: IPaymentMethod) => {
                const existingPayment =
                  dailySalesReportObj.businessPaymentMethods.find(
                    (p: IPaymentMethod) =>
                      p.paymentMethodType === payment.paymentMethodType &&
                      p.methodBranch === payment.methodBranch
                  );

                if (existingPayment) {
                  existingPayment.methodSalesTotal += payment.methodSalesTotal ?? 0;
                } else {
                  dailySalesReportObj.businessPaymentMethods.push({
                    paymentMethodType: payment.paymentMethodType,
                    methodBranch: payment.methodBranch,
                    methodSalesTotal: payment.methodSalesTotal ?? 0,
                  });
                }
              }
            );
          }

          dailySalesReportObj.dailyTotalSalesBeforeAdjustments +=
            employeeReport.totalSalesBeforeAdjustments ?? 0;
          dailySalesReportObj.dailyNetPaidAmount +=
            employeeReport.totalNetPaidAmount ?? 0;
          dailySalesReportObj.dailyTipsReceived +=
            employeeReport.totalTipsReceived ?? 0;
          dailySalesReportObj.dailyCostOfGoodsSold +=
            employeeReport.totalCostOfGoodsSold ?? 0;
          dailySalesReportObj.dailyCustomersServed +=
            employeeReport.totalCustomersServed ?? 0;

          const updateGoodsArray = (
            array: IGoodsReduced[],
            businessGood: IGoodsReduced
          ) => {
            const existingGood = array.find(
              (item) =>
                (item.businessGoodId as Types.ObjectId)?.toString() ===
                (businessGood.businessGoodId as Types.ObjectId)?.toString()
            );

            if (existingGood) {
              existingGood.quantity += businessGood.quantity ?? 1;
              existingGood.totalPrice =
                (existingGood.totalPrice ?? 0) + (businessGood.totalPrice ?? 0);
              existingGood.totalCostPrice =
                (existingGood.totalCostPrice ?? 0) +
                (businessGood.totalCostPrice ?? 0);
            } else {
              array.push({
                businessGoodId: businessGood.businessGoodId,
                quantity: businessGood.quantity ?? 1,
                totalPrice: businessGood.totalPrice ?? 0,
                totalCostPrice: businessGood.totalCostPrice ?? 0,
              });
            }
          };

          if (employeeReport.soldGoods && employeeReport.soldGoods.length > 0) {
            employeeReport.soldGoods.forEach((businessGood: IGoodsReduced) => {
              updateGoodsArray(businessGoodsReport.goodsSold, businessGood);
            });
          }

          if (
            employeeReport.voidedGoods &&
            employeeReport.voidedGoods.length > 0
          ) {
            employeeReport.voidedGoods.forEach((businessGood: IGoodsReduced) => {
              updateGoodsArray(businessGoodsReport.goodsVoid, businessGood);
            });
          }

          if (
            employeeReport.invitedGoods &&
            employeeReport.invitedGoods.length > 0
          ) {
            employeeReport.invitedGoods.forEach((businessGood: IGoodsReduced) => {
              updateGoodsArray(businessGoodsReport.goodsInvited, businessGood);
            });
          }
        }
      );
    }

    dailySalesReportObj.dailyProfit =
      dailySalesReportObj.dailyNetPaidAmount -
      dailySalesReportObj.dailyCostOfGoodsSold;

    dailySalesReportObj.dailyAverageCustomerExpenditure =
      dailySalesReportObj.dailyCustomersServed > 0
        ? dailySalesReportObj.dailyNetPaidAmount /
          dailySalesReportObj.dailyCustomersServed
        : 0;

    dailySalesReportObj.dailySoldGoods = businessGoodsReport.goodsSold;
    dailySalesReportObj.dailyVoidedGoods = businessGoodsReport.goodsVoid;
    dailySalesReportObj.dailyInvitedGoods = businessGoodsReport.goodsInvited;

    dailySalesReportObj.dailyTotalVoidValue =
      dailySalesReportObj.dailyVoidedGoods.reduce(
        (acc, curr) => acc + (curr.totalPrice ?? 0),
        0
      );

    dailySalesReportObj.dailyTotalInvitedValue =
      dailySalesReportObj.dailyInvitedGoods.reduce(
        (acc, curr) => acc + (curr.totalPrice ?? 0),
        0
      );

    let comissionPercentage = 0;
    const businessIdPayload = dailyReportWithUsers.businessId;
    const subscription =
      typeof businessIdPayload === "object" &&
      businessIdPayload !== null &&
      "subscription" in businessIdPayload
        ? (businessIdPayload as { subscription?: string }).subscription
        : undefined;

    switch (subscription) {
      case "Free":
        comissionPercentage = 0;
        break;
      case "Basic":
        comissionPercentage = 0.05;
        break;
      case "Premium":
        comissionPercentage = 0.08;
        break;
      case "Enterprise":
        comissionPercentage = 0.1;
        break;
      default:
        comissionPercentage = 0;
        break;
    }

    dailySalesReportObj.dailyPosSystemCommission =
      dailySalesReportObj.dailyTotalSalesBeforeAdjustments * comissionPercentage;

    await DailySalesReport.updateOne(
      { _id: dailySalesReportId },
      dailySalesReportObj
    );

    const businessIdForMonthly =
      typeof dailyReportWithUsers.businessId === "object" &&
      dailyReportWithUsers.businessId !== null &&
      "_id" in dailyReportWithUsers.businessId
        ? (dailyReportWithUsers.businessId as { _id: Types.ObjectId })._id
        : (dailyReportWithUsers.businessId as Types.ObjectId);
    try {
      await aggregateDailyReportsIntoMonthly(businessIdForMonthly);
    } catch (aggregationError) {
      console.error(
        "Monthly report aggregation failed after daily calculate:",
        aggregationError
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "Daily sales report updated" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Failed to update daily sales report! ",
      error instanceof Error ? error.message : String(error)
    );
  }
};
