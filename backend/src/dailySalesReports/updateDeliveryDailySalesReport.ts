import { Types } from "mongoose";
import isObjectIdValid from "../utils/isObjectIdValid.ts";
import type {
  IActorDailySalesReport,
  IGoodsReduced,
} from "../../../packages/interfaces/IDailySalesReport.ts";
import type { IPaymentMethod } from "../../../packages/interfaces/IPaymentMethod.ts";

import SalesInstance from "../models/salesInstance.ts";
import BusinessGood from "../models/businessGood.ts";
import Order from "../models/order.ts";

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
  ordersIds?: OrderForReport[];
}

interface SalesInstanceForReport {
  salesInstanceStatus?: string;
  guests?: number;
  salesGroup?: SalesGroupWithOrders[];
}

/**
 * Reconciliation-only helper.
 *
 * Delivery aggregation is stored as a single bucket (same shape as an employee row),
 * but aggregated by `salesPointId` instead of `responsibleByUserId`.
 *
 * Do not call this from normal runtime payment/finalization paths.
 */
const reconcileDeliveryDailySalesReport = async (
  deliverySalesPointId: Types.ObjectId,
  dailyReferenceNumber: number,
): Promise<{
  deliveryDailySalesReport: IActorDailySalesReport;
  errors: string[];
}> => {
  const errors: string[] = [];

  try {
    if (isObjectIdValid([deliverySalesPointId]) !== true) {
      return {
        deliveryDailySalesReport: {
          userId: deliverySalesPointId,
        } as IActorDailySalesReport,
        errors: ["Invalid deliverySalesPointId!"],
      };
    }

    if (!dailyReferenceNumber) {
      return {
        deliveryDailySalesReport: {
          userId: deliverySalesPointId,
        } as IActorDailySalesReport,
        errors: ["dailyReferenceNumber is required!"],
      };
    }

    const employeeGoodsReport: {
      goodsSold: IGoodsReduced[];
      goodsVoid: IGoodsReduced[];
      goodsInvited: IGoodsReduced[];
    } = {
      goodsSold: [],
      goodsVoid: [],
      goodsInvited: [],
    };

    const deliveryDailySalesReportObj: IActorDailySalesReport = {
      // Keep a stable identity for the delivery bucket using delivery salesPoint id.
      userId: deliverySalesPointId,
      hasOpenSalesInstances: false,
      employeePaymentMethods: [] as IPaymentMethod[],
      totalSalesBeforeAdjustments: 0,
      totalNetPaidAmount: 0,
      totalTipsReceived: 0,
      totalCostOfGoodsSold: 0,
      totalCustomersServed: 0 as number,
      averageCustomerExpenditure: 0,
    };

    const salesInstances = await SalesInstance.find({
      salesPointId: deliverySalesPointId,
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
        "dailyReferenceNumber salesInstanceStatus businessId guests closedByUserId openedByUserId",
      )
      .lean();

    const instances = salesInstances as SalesInstanceForReport[] | null;
    if (instances && instances.length > 0) {
      for (const instance of instances) {
        deliveryDailySalesReportObj.hasOpenSalesInstances =
          instance.salesInstanceStatus !== "Closed"
            ? true
            : deliveryDailySalesReportObj.hasOpenSalesInstances;

        const groups = instance.salesGroup ?? [];
        for (const group of groups) {
          const orders = group.ordersIds ?? [];
          for (const order of orders) {
            (order.paymentMethod ?? []).forEach((payment: IPaymentMethod) => {
              const existingPayment =
                deliveryDailySalesReportObj?.employeePaymentMethods?.find(
                  (p: IPaymentMethod) =>
                    p.paymentMethodType === payment.paymentMethodType &&
                    p.methodBranch === payment.methodBranch,
                );

              if (existingPayment) {
                existingPayment.methodSalesTotal +=
                  payment.methodSalesTotal ?? 0;
              } else {
                deliveryDailySalesReportObj?.employeePaymentMethods?.push({
                  paymentMethodType: payment.paymentMethodType,
                  methodBranch: payment.methodBranch,
                  methodSalesTotal: payment.methodSalesTotal ?? 0,
                });
              }
            });

            deliveryDailySalesReportObj.totalNetPaidAmount =
              (deliveryDailySalesReportObj.totalNetPaidAmount ?? 0) +
              (order.orderNetPrice ?? 0);
            deliveryDailySalesReportObj.totalTipsReceived =
              (deliveryDailySalesReportObj.totalTipsReceived ?? 0) +
              (order.orderTips ?? 0);
            deliveryDailySalesReportObj.totalSalesBeforeAdjustments =
              (deliveryDailySalesReportObj.totalSalesBeforeAdjustments ?? 0) +
              (order.orderGrossPrice ?? 0);
            deliveryDailySalesReportObj.totalCostOfGoodsSold =
              (deliveryDailySalesReportObj.totalCostOfGoodsSold ?? 0) +
              (order.orderCostPrice ?? 0);

            const goodsOnOrder: (Types.ObjectId | PopulatedBusinessGood)[] =
              order.businessGoodId
                ? [order.businessGoodId].concat(order.addOns ?? [])
                : (order.addOns ?? []);

            goodsOnOrder.forEach((businessGood) => {
              const good =
                businessGood &&
                (typeof businessGood === "object" && "_id" in businessGood
                  ? businessGood
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
                  ? ((businessGood as PopulatedBusinessGood).sellingPrice ?? 0)
                  : 0;

              const costPrice =
                typeof businessGood === "object" &&
                businessGood !== null &&
                "costPrice" in businessGood
                  ? ((businessGood as PopulatedBusinessGood).costPrice ?? 0)
                  : 0;

              const updateGoodsArray = (array: IGoodsReduced[]) => {
                const idStr =
                  typeof goodId === "object" && goodId !== null
                    ? (goodId as Types.ObjectId).toString()
                    : String(goodId);

                const existingGood = array.find(
                  (item: IGoodsReduced) =>
                    (item.businessGoodId?.toString?.() ??
                      String(item.businessGoodId)) === idStr,
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

        deliveryDailySalesReportObj.totalCustomersServed =
          (deliveryDailySalesReportObj.totalCustomersServed ?? 0) +
          (instance.guests ?? 0);
      }
    }

    if ((deliveryDailySalesReportObj.totalCustomersServed ?? 0) > 0) {
      deliveryDailySalesReportObj.averageCustomerExpenditure =
        (deliveryDailySalesReportObj.totalSalesBeforeAdjustments ?? 0) /
        (deliveryDailySalesReportObj.totalCustomersServed ?? 0);
    }

    deliveryDailySalesReportObj.soldGoods = employeeGoodsReport.goodsSold;
    deliveryDailySalesReportObj.voidedGoods = employeeGoodsReport.goodsVoid;
    deliveryDailySalesReportObj.invitedGoods = employeeGoodsReport.goodsInvited;

    deliveryDailySalesReportObj.totalVoidValue =
      employeeGoodsReport.goodsVoid.reduce(
        (acc, curr) => acc + (curr.totalPrice ?? 0),
        0,
      );
    deliveryDailySalesReportObj.totalInvitedValue =
      employeeGoodsReport.goodsInvited.reduce(
        (acc, curr) => acc + (curr.totalPrice ?? 0),
        0,
      );

    return { deliveryDailySalesReport: deliveryDailySalesReportObj, errors };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);

    return {
      deliveryDailySalesReport: {
        userId: deliverySalesPointId,
      } as IActorDailySalesReport,
      errors,
    };
  }
};

export default reconcileDeliveryDailySalesReport;

