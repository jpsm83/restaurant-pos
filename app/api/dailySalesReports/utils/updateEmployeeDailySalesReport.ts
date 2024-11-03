import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import {
  IGoodsReduced,
  IEmployeeDailySalesReport,
} from "@/app/lib/interface/IDailySalesReport";
import { IPaymentMethod } from "@/app/lib/interface/IPaymentMethod";

// import models
import Order from "@/app/lib/models/order";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import BusinessGood from "@/app/lib/models/businessGood";
import SalesInstance from "@/app/lib/models/salesInstance";

// this function will update individual employee daily sales report
// it will be fired individualy when the employee closes his daily sales report for the day or if he just want to see the report at current time
// it also will be fired when manager closes the day sales report, running for all employees
export const updateEmployeesDailySalesReport = async (
  employeeIds: Types.ObjectId[], // Now accepts an array of employeeIds
  dailyReferenceNumber: number
) => {
  try {
    // validate employeeIds
    if (isObjectIdValid(employeeIds) !== true) {
      return "Invalid employeeIds!";
    }

    // check required fields
    if (!dailyReferenceNumber) {
      return "EmployeeIds and dailyReferenceNumber are required!";
    }

    // connect before first call to DB
    await connectDb();

    // Array to collect results for each employee
    const employeeReports: IEmployeeDailySalesReport[] = [];
    const errors: string[] = [];

    // Loop through each employeeId and process the report
    for (const employeeId of employeeIds) {
      try {
        // Fetch all sales instance closed by the employee for the given dailyReferenceNumber
        const salesInstance = await SalesInstance.find({
          responsibleById: employeeId,
          dailyReferenceNumber: dailyReferenceNumber,
        })
          .populate({
            path: "salesGroup.ordersIds",
            model: Order,
            populate: {
              path: "businessGoodsIds",
              model: BusinessGood,
              populate: {
                path: "setMenuIds",
                select: "_id name mainCategory subCategory",
              },
              select:
                "_id name mainCategory subCategory sellingPrice costPrice",
            },
            select:
              "employeeId paymentMethod billingStatus orderGrossPrice orderNetPrice orderTips orderCostPrice",
          })
          .select(
            "dailyReferenceNumber status businessId orderNetPrice orderTips guests closedById"
          )
          .lean();

        // Initialize employee sales report object
        let employeeGoodsReport: {
          goodsSold: IGoodsReduced[];
          goodsVoid: IGoodsReduced[];
          goodsInvited: IGoodsReduced[];
        } = {
          goodsSold: [],
          goodsVoid: [],
          goodsInvited: [],
        };

        let employeeDailySalesReportObj: IEmployeeDailySalesReport = {
          employeeId: employeeId,
          hasOpenSalesInstances: false,
          employeePaymentMethods: [] as IPaymentMethod[],
          totalSalesBeforeAdjustments: 0,
          totalNetPaidAmount: 0,
          totalTipsReceived: 0,
          totalCostOfGoodsSold: 0,
          totalCustomersServed: 0 as number,
          averageCustomerExpenditure: 0,
        };

        // Process each sales instance for the employee
        if (salesInstance && salesInstance.length > 0) {
          salesInstance.forEach((saleGroup) => {
            saleGroup.forEach((sale: any) => {
            employeeDailySalesReportObj.hasOpenSalesInstances =
              sale.status !== "Closed"
                ? true
                : employeeDailySalesReportObj.hasOpenSalesInstances;

            // Process orders in the sales instance
            if (
              sale.ordersIds &&
              sale.ordersIds.length > 0
            ) {
              sale.ordersIds.forEach((order: any) => {
                order.paymentMethod.forEach((payment: IPaymentMethod) => {
                  const existingPayment =
                    employeeDailySalesReportObj?.employeePaymentMethods?.find(
                      (p: any) =>
                        p.paymentMethodType === payment.paymentMethodType &&
                        p.methodBranch === payment.methodBranch
                    );

                  if (existingPayment) {
                    existingPayment.methodSalesTotal +=
                      payment.methodSalesTotal;
                  } else {
                    employeeDailySalesReportObj?.employeePaymentMethods?.push({
                      paymentMethodType: payment.paymentMethodType,
                      methodBranch: payment.methodBranch,
                      methodSalesTotal: payment.methodSalesTotal,
                    });
                  }
                });

                employeeDailySalesReportObj.totalNetPaidAmount +=
                  order.orderNetPrice ?? 0;
                employeeDailySalesReportObj.totalTipsReceived +=
                  order.orderTips ?? 0;
                employeeDailySalesReportObj.totalSalesBeforeAdjustments +=
                  order.orderGrossPrice ?? 0;
                employeeDailySalesReportObj.totalCostOfGoodsSold +=
                  order.orderCostPrice ?? 0;

                // Update business goods sales report
                if (
                  order.businessGoodsIds &&
                  order.businessGoodsIds.length > 0
                ) {
                  order.businessGoodsIds.forEach((businessGood: any) => {
                    const updateGoodsArray = (array: any[]) => {
                      const existingGood = array.find(
                        (item: any) => item.businessGoodId === businessGood._id
                      );

                      if (existingGood) {
                        existingGood.quantity += businessGood.quantity ?? 1;
                        existingGood.totalPrice += businessGood.sellingPrice;
                        existingGood.totalCostPrice += businessGood.costPrice;
                      } else {
                        array.push({
                          businessGoodId: businessGood._id,
                          quantity: businessGood.quantity ?? 1,
                          totalPrice: businessGood.sellingPrice,
                          totalCostPrice: businessGood.costPrice,
                        });
                      }
                    };

                    // Update the correct array based on billing status
                    switch (order.billingStatus) {
                      case "Paid":
                        updateGoodsArray(employeeGoodsReport.goodsSold);
                        break;
                      case "Void":
                        updateGoodsArray(employeeGoodsReport.goodsVoid);
                        break;
                      case "Invitation":
                        updateGoodsArray(employeeGoodsReport.goodsInvited);
                        break;
                      default:
                        break;
                    }
                  });
                }
              });
            }

            // Update total customers served
            employeeDailySalesReportObj.totalCustomersServed +=
              sale.guests ?? 0;
          });
          });
        }

        // Calculate average customer expenditure
        if ((employeeDailySalesReportObj.totalCustomersServed ?? 0) > 0) {
          employeeDailySalesReportObj.averageCustomerExpenditure =
            (employeeDailySalesReportObj.totalSalesBeforeAdjustments ?? 0) /
            (employeeDailySalesReportObj.totalCustomersServed ?? 0);
        }

        // Add goods reports to employee object
        employeeDailySalesReportObj.soldGoods = employeeGoodsReport.goodsSold;
        employeeDailySalesReportObj.voidedGoods = employeeGoodsReport.goodsVoid;
        employeeDailySalesReportObj.invitedGoods =
          employeeGoodsReport.goodsInvited;

        employeeDailySalesReportObj.totalVoidValue =
          employeeGoodsReport.goodsVoid.reduce(
            (acc, curr) => acc + (curr.totalPrice ?? 0),
            0
          );
        employeeDailySalesReportObj.totalInvitedValue =
          employeeGoodsReport.goodsInvited.reduce(
            (acc, curr) => acc + (curr.totalPrice ?? 0),
            0
          );

        // Add the updated result to the array
        employeeReports.push(employeeDailySalesReportObj);
      } catch (error: any) {
        // Log errors for specific employees
        errors.push(`Error updating employee ${employeeId}: ${error.message}`);
      }
    }

    // Update DailySalesReport after processing all employees
    await DailySalesReport.updateOne(
      { dailyReferenceNumber },
      { $set: { employeesDailySalesReport: employeeReports } }
    );

    // Return both successful reports and errors
    return {
      updatedEmployees: employeeReports,
      errors,
    };
  } catch (error: any) {
    return `Failed to update employee daily sales reports! ${error.message}`;
  }
};
