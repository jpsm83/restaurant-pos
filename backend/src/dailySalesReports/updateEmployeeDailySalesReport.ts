import { Types } from "mongoose";
import { isObjectIdValid } from "../utils/isObjectIdValid.js";
import type {
  IGoodsReduced,
  IEmployeeDailySalesReport,
} from "@shared/interfaces/IDailySalesReport";
import type { IPaymentMethod } from "@shared/interfaces/IPaymentMethod";
import Order from "../models/order.js";
import DailySalesReport from "../models/dailySalesReport.js";
import BusinessGood from "../models/businessGood.js";
import SalesInstance from "../models/salesInstance.js";

interface PopulatedBusinessGood {
  _id: Types.ObjectId;
  sellingPrice?: number;
  costPrice?: number;
}

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

interface SalesGroupWithOrders {
  orderCode?: string;
  ordersIds?: OrderForReport[];
}

interface SalesInstanceForReport {
  salesInstanceStatus?: string;
  guests?: number;
  salesGroup?: SalesGroupWithOrders[];
}

export const updateEmployeesDailySalesReport = async (
  userIds: Types.ObjectId[],
  dailyReferenceNumber: number
): Promise<{ updatedEmployees: IEmployeeDailySalesReport[]; errors: string[] }> => {
  try {
    const employeeReports: IEmployeeDailySalesReport[] = [];
    const errors: string[] = [];

    if (isObjectIdValid(userIds) !== true) {
      errors.push("Invalid userIds!");
      return { updatedEmployees: employeeReports, errors };
    }

    if (!dailyReferenceNumber) {
      errors.push("UserIds and dailyReferenceNumber are required!");
      return { updatedEmployees: employeeReports, errors };
    }

    for (const userId of userIds) {
      try {
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

        if ((employeeDailySalesReportObj.totalCustomersServed ?? 0) > 0) {
          employeeDailySalesReportObj.averageCustomerExpenditure =
            (employeeDailySalesReportObj.totalSalesBeforeAdjustments ?? 0) /
            (employeeDailySalesReportObj.totalCustomersServed ?? 0);
        }

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

        employeeReports.push(employeeDailySalesReportObj);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        errors.push(`Error updating user ${userId}: ${message}`);
      }
    }

    await DailySalesReport.updateOne(
      { dailyReferenceNumber },
      { $set: { employeesDailySalesReport: employeeReports } }
    );

    return { updatedEmployees: employeeReports, errors };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      updatedEmployees: [],
      errors: [`Failed to update employee daily sales reports! ${message}`],
    };
  }
};
