import connectDb from "@/app/lib/utils/connectDb";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { updateEmployeesDailySalesReport } from "../../utils/updateEmployeeDailySalesReport";

// imported interfaces
import {
  IGoodsReduced,
  IEmployeeDailySalesReport,
} from "@/app/lib/interface/IDailySalesReport";
import { IEmployee } from "@/app/lib/interface/IEmployee";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Employee from "@/app/lib/models/employee";
import Business from "@/app/lib/models/business";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { IPaymentMethod } from "@/app/lib/interface/IPaymentMethod";

// @desc    Calculate the business daily sales report
// @route   PATCH /dailySalesReports/:dailySalesReportId/calculateBusinessDailySalesReport
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { dailySalesReportId: Types.ObjectId } }
) => {
  // this function will call the updateEmployeeDailySalesReport function to update all employees daily sales report
  // them it will update the whole business daily sales report
  // this is called by mananger or admin
  try {
    const dailySalesReportId = context.params.dailySalesReportId;

    const { employeeId } = (await req.json()) as {
      employeeId: Types.ObjectId;
    };

    // check if the ID is valid
    if (isObjectIdValid([dailySalesReportId, employeeId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid dailySalesReport or employee ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check if the employee is "General Manager", "Manager", "Assistant Manager", "MoD" or "Admin"
    const employeeRoleOnDuty: IEmployee | null = await Employee.findById(
      employeeId
    )
      .select("currentShiftRole onDuty")
      .lean();

    const allowedRoles = [
      "General Manager",
      "Manager",
      "Assistant Manager",
      "MoD",
      "Admin",
    ];

    if (
      !employeeRoleOnDuty ||
      !allowedRoles.includes(employeeRoleOnDuty.currentShiftRole ?? "") ||
      !employeeRoleOnDuty.onDuty
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "You are not allowed to close the daily sales report!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // get the daily report to update
    const dailySalesReport: any = await DailySalesReport.findOne({
      _id: dailySalesReportId,
    })
      .select(
        "_id dailyReferenceNumber employeesDailySalesReport.employeeId employeesDailySalesReport.hasOpenSalesInstances businessId"
      )
      .populate({
        path: "employeesDailySalesReport.employeeId",
        select: "employeeName",
        model: Employee,
      })
      .populate({ path: "businessId", select: "subscription", model: Business })
      .lean();

    // check if daily report exists
    if (!dailySalesReport) {
      return new NextResponse(
        JSON.stringify({ message: "Daily report not found!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const employeeIds = dailySalesReport.employeesDailySalesReport.map(
      (employee: any) => employee.employeeId._id
    );

    // Call the function to update the daily sales reports for the employees
    const updatedEmployeesDailySalesReport =
      (await updateEmployeesDailySalesReport(
        employeeIds,
        dailySalesReport.dailyReferenceNumber
      )) as { updatedEmployees: IEmployeeDailySalesReport[]; errors: string[] };

    // Check if there were any errors
    if (
      updatedEmployeesDailySalesReport.errors &&
      updatedEmployeesDailySalesReport.errors.length > 0
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "Some errors occurred while updating employees!",
          errors: updatedEmployeesDailySalesReport.errors,
        }),
        {
          status: 207, // Multi-Status to indicate partial success
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // business goods sales report
    let businessGoodsReport: {
      goodsSold: IGoodsReduced[];
      goodsVoid: IGoodsReduced[];
      goodsInvited: IGoodsReduced[];
    } = {
      goodsSold: [],
      goodsVoid: [],
      goodsInvited: [],
    };

    // prepare dailySalesReportObj to update the daily report
    let dailySalesReportObj = {
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

    // Ensure updateEmployeesDailySalesReport is an array of IEmployeeDailySalesReport
    if (Array.isArray(updatedEmployeesDailySalesReport.updatedEmployees)) {
      updatedEmployeesDailySalesReport.updatedEmployees.forEach(
        (employeeReport) => {
          // Check if employeePaymentMethods is defined before iterating
          if (employeeReport.employeePaymentMethods) {
            employeeReport.employeePaymentMethods.forEach(
              (payment: IPaymentMethod) => {
                // Find if the payment method and branch combination already exists in the dailySalesReportObj.employeePaymentMethods array
                const existingPayment =
                  dailySalesReportObj.businessPaymentMethods.find(
                    (p: IPaymentMethod) =>
                      p.paymentMethodType === payment.paymentMethodType &&
                      p.methodBranch === payment.methodBranch
                  );

                if (existingPayment) {
                  // If it exists, add the current payment's methodSalesTotal to the existing one
                  existingPayment.methodSalesTotal += payment.methodSalesTotal;
                } else {
                  // If it doesn't exist, create a new entry in the dailySalesReportObj.businessPaymentMethods array
                  dailySalesReportObj.businessPaymentMethods.push({
                    paymentMethodType: payment.paymentMethodType,
                    methodBranch: payment.methodBranch,
                    methodSalesTotal: payment.methodSalesTotal,
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

          // Update goodsSold, goodsVoid, and goodsInvited for the business
          const updateGoodsArray = (array: any[], businessGood: any) => {
            const existingGood = array.find(
              (item: any) => item.businessGoodId === businessGood.businessGoodId
            );

            if (existingGood) {
              // If the item already exists, update the quantity, totalPrice, and totalCostPrice
              existingGood.quantity += businessGood.quantity ?? 1;
              existingGood.totalPrice += businessGood.totalPrice ?? 0;
              existingGood.totalCostPrice += businessGood.totalCostPrice ?? 0;
            } else {
              // If it doesn't exist, create a new entry, including businessGoodId
              array.push({
                businessGoodId: businessGood.businessGoodId, // Fixed this to include businessGoodId
                quantity: businessGood.quantity ?? 1,
                totalPrice: businessGood.totalPrice ?? 0,
                totalCostPrice: businessGood.totalCostPrice ?? 0,
              });
            }
          };

          // Populate and reduce all the goods sold
          if (employeeReport.soldGoods && employeeReport.soldGoods.length > 0) {
            employeeReport.soldGoods.forEach((businessGood: any) => {
              updateGoodsArray(businessGoodsReport.goodsSold, businessGood);
            });
          }

          // Populate and reduce all the goods void
          if (
            employeeReport.voidedGoods &&
            employeeReport.voidedGoods.length > 0
          ) {
            employeeReport.voidedGoods.forEach((businessGood: any) => {
              updateGoodsArray(businessGoodsReport.goodsVoid, businessGood);
            });
          }

          // Populate and reduce all the goods invited
          if (
            employeeReport.invitedGoods &&
            employeeReport.invitedGoods.length > 0
          ) {
            employeeReport.invitedGoods.forEach((businessGood: any) => {
              updateGoodsArray(businessGoodsReport.goodsInvited, businessGood);
            });
          }
        }
      );
    }

    // calculate business total profit
    dailySalesReportObj.dailyProfit =
      dailySalesReportObj.dailyNetPaidAmount -
      dailySalesReportObj.dailyCostOfGoodsSold;

    // calculate business average customers expended
    dailySalesReportObj.dailyAverageCustomerExpenditure =
      dailySalesReportObj.dailyNetPaidAmount /
      dailySalesReportObj.dailyCustomersServed;

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

    switch (dailySalesReport.businessId.subscription) {
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

    // calculate the comission of the POS system app
    dailySalesReportObj.dailyPosSystemCommission =
      dailySalesReportObj.dailyTotalSalesBeforeAdjustments *
      comissionPercentage;

    // update the document in the database
    await DailySalesReport.updateOne(
      { _id: dailySalesReportId },
      dailySalesReportObj
    );

    return new NextResponse(
      JSON.stringify({ message: "Daily sales report updated" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Failed to update daily sales report! ", error);
  }
};
