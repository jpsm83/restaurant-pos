import { Types } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported interfaces
import {
  IGoodsReduced,
  IEmployeeDailySalesReport,
} from "@/lib/interface/IDailySalesReport";
import { IPaymentMethod } from "@/lib/interface/IPaymentMethod";

// import models
import Order from "@/lib/db/models/order";
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import BusinessGood from "@/lib/db/models/businessGood";
import SalesInstance from "@/lib/db/models/salesInstance";

/** Populated business good (lean) used in order reporting */
interface PopulatedBusinessGood {
  _id: Types.ObjectId;
  sellingPrice?: number;
  costPrice?: number;
}

/** Order document as returned by populate (lean) for daily report */
interface OrderForReport {
  paymentMethod?: IPaymentMethod[];
  billingStatus?: string;
  orderGrossPrice?: number;
  orderNetPrice?: number;
  orderTips?: number;
  orderCostPrice?: number;
  businessGoodId?: Types.ObjectId | PopulatedBusinessGood;
  addOns?: (Types.ObjectId | PopulatedBusinessGood)[];
}

/** Sales group with populated orders */
interface SalesGroupWithOrders {
  orderCode?: string;
  ordersIds?: OrderForReport[];
}

/** Sales instance document (lean) with populated salesGroup.ordersIds */
interface SalesInstanceForReport {
  salesInstanceStatus?: string;
  guests?: number;
  salesGroup?: SalesGroupWithOrders[];
}

// this function will update individual user (employee role) daily sales report
// it will be fired individually when the user closes his daily sales report for the day or if he just want to see the report at current time
// it also will be fired when manager closes the day sales report, running for all users
export const updateEmployeesDailySalesReport = async (
  userIds: Types.ObjectId[],
  dailyReferenceNumber: number
) => {
  try {
    // validate userIds
    if (isObjectIdValid(userIds) !== true) {
      return "Invalid userIds!";
    }

    // check required fields
    if (!dailyReferenceNumber) {
      return "UserIds and dailyReferenceNumber are required!";
    }

    // connect before first call to DB
    await connectDb();

    // Array to collect results for each user
    const employeeReports: IEmployeeDailySalesReport[] = [];
    const errors: string[] = [];

    // Loop through each userId and process the report
    for (const userId of userIds) {
      try {
        // Fetch all sales instances where this user is responsible for the given dailyReferenceNumber
        const salesInstance = await SalesInstance.find({
          responsibleByUserId: userId,
          dailyReferenceNumber: dailyReferenceNumber,
        })
          .populate({
            path: "salesGroup.ordersIds",
            model: Order,
            populate: [
              {
                path: "businessGoodId",
                model: BusinessGood,
                populate: {
                  path: "setMenuIds",
                  select: "_id name mainCategory subCategory",
                },
                select:
                  "_id name mainCategory subCategory sellingPrice costPrice",
              },
              {
                path: "addOns",
                model: BusinessGood,
                populate: {
                  path: "setMenuIds",
                  select: "_id name mainCategory subCategory",
                },
                select:
                  "_id name mainCategory subCategory sellingPrice costPrice",
              },
            ],
            select:
              "createdByUserId createdAsRole paymentMethod billingStatus orderGrossPrice orderNetPrice orderTips orderCostPrice businessGoodId addOns",
          })
          .select(
            "dailyReferenceNumber salesInstanceStatus businessId orderNetPrice orderTips guests closedByUserId"
          )
          .lean();

        // Initialize employee sales report object
        const employeeGoodsReport: {
          goodsSold: IGoodsReduced[];
          goodsVoid: IGoodsReduced[];
          goodsInvited: IGoodsReduced[];
        } = {
          goodsSold: [],
          goodsVoid: [],
          goodsInvited: [],
        };

        const employeeDailySalesReportObj: IEmployeeDailySalesReport = {
          userId: userId,
          hasOpenSalesInstances: false,
          employeePaymentMethods: [] as IPaymentMethod[],
          totalSalesBeforeAdjustments: 0,
          totalNetPaidAmount: 0,
          totalTipsReceived: 0,
          totalCostOfGoodsSold: 0,
          totalCustomersServed: 0 as number,
          averageCustomerExpenditure: 0,
        };

        // Process each sales instance for the user
        const instances = salesInstance as SalesInstanceForReport[] | null;
        if (instances && instances.length > 0) {
          for (const instance of instances) {
            employeeDailySalesReportObj.hasOpenSalesInstances =
              instance.salesInstanceStatus !== "Closed"
                ? true
                : employeeDailySalesReportObj.hasOpenSalesInstances;

            const groups = instance.salesGroup ?? [];
            for (const group of groups) {
              const orders = group.ordersIds ?? [];
              for (const order of orders) {
                (order.paymentMethod ?? []).forEach((payment: IPaymentMethod) => {
                  const existingPayment =
                    employeeDailySalesReportObj?.employeePaymentMethods?.find(
                      (p: IPaymentMethod) =>
                        p.paymentMethodType === payment.paymentMethodType &&
                        p.methodBranch === payment.methodBranch
                    );

                  if (existingPayment) {
                    existingPayment.methodSalesTotal +=
                      payment.methodSalesTotal ?? 0;
                  } else {
                    employeeDailySalesReportObj?.employeePaymentMethods?.push({
                      paymentMethodType: payment.paymentMethodType,
                      methodBranch: payment.methodBranch,
                      methodSalesTotal: payment.methodSalesTotal ?? 0,
                    });
                  }
                });

                employeeDailySalesReportObj.totalNetPaidAmount =
                  (employeeDailySalesReportObj.totalNetPaidAmount ?? 0) +
                  (order.orderNetPrice ?? 0);
                employeeDailySalesReportObj.totalTipsReceived =
                  (employeeDailySalesReportObj.totalTipsReceived ?? 0) +
                  (order.orderTips ?? 0);
                employeeDailySalesReportObj.totalSalesBeforeAdjustments =
                  (employeeDailySalesReportObj.totalSalesBeforeAdjustments ?? 0) +
                  (order.orderGrossPrice ?? 0);
                employeeDailySalesReportObj.totalCostOfGoodsSold =
                  (employeeDailySalesReportObj.totalCostOfGoodsSold ?? 0) +
                  (order.orderCostPrice ?? 0);

                // Update business goods sales report (main product + addOns, each counts as 1 unit)
                const goodsOnOrder: (Types.ObjectId | PopulatedBusinessGood)[] =
                  order.businessGoodId
                    ? [order.businessGoodId].concat(order.addOns ?? [])
                    : (order.addOns ?? []);
                goodsOnOrder.forEach((businessGood) => {
                  const good =
                    businessGood &&
                    (typeof businessGood === "object" && "_id" in businessGood
                      ? businessGood._id
                      : businessGood);
                  if (!good) return;
                  const goodId =
                    typeof good === "object" && good !== null && "_id" in good
                      ? (good as { _id: Types.ObjectId })._id
                      : (good as Types.ObjectId);
                  const sellingPrice =
                    typeof businessGood === "object" &&
                    businessGood !== null &&
                    "sellingPrice" in businessGood
                      ? (businessGood as PopulatedBusinessGood).sellingPrice ?? 0
                      : 0;
                  const costPrice =
                    typeof businessGood === "object" &&
                    businessGood !== null &&
                    "costPrice" in businessGood
                      ? (businessGood as PopulatedBusinessGood).costPrice ?? 0
                      : 0;
                  const updateGoodsArray = (array: IGoodsReduced[]) => {
                    const idStr =
                      typeof goodId === "object" && goodId !== null
                        ? (goodId as Types.ObjectId).toString()
                        : String(goodId);
                    const existingGood = array.find(
                      (item: IGoodsReduced) =>
                        (item.businessGoodId?.toString?.() ??
                          String(item.businessGoodId)) === idStr
                    );

                    if (existingGood) {
                      existingGood.quantity += 1;
                      existingGood.totalPrice =
                        (existingGood.totalPrice ?? 0) + sellingPrice;
                      existingGood.totalCostPrice =
                        (existingGood.totalCostPrice ?? 0) + costPrice;
                    } else {
                      array.push({
                        businessGoodId: goodId as Types.ObjectId,
                        quantity: 1,
                        totalPrice: sellingPrice,
                        totalCostPrice: costPrice,
                      });
                    }
                  };

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
            }

            const prevServed =
              employeeDailySalesReportObj.totalCustomersServed ?? 0;
            employeeDailySalesReportObj.totalCustomersServed =
              prevServed + (instance.guests ?? 0);
          }
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
      } catch (error: unknown) {
        // Log errors for specific users
        const message =
          error instanceof Error ? error.message : String(error);
        errors.push(`Error updating user ${userId}: ${message}`);
      }
    }

    // Update DailySalesReport after processing all users
    await DailySalesReport.updateOne(
      { dailyReferenceNumber },
      { $set: { employeesDailySalesReport: employeeReports } }
    );

    // Return both successful reports and errors
    return {
      updatedEmployees: employeeReports,
      errors,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `Failed to update employee daily sales reports! ${message}`;
  }
};
