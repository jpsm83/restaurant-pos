import { ClientSession, Types } from "mongoose";
import type {
  IActorDailySalesReport,
  IGoodsReduced,
} from "../../../packages/interfaces/IDailySalesReport.ts";
import type { IPaymentMethod } from "../../../packages/interfaces/IPaymentMethod.ts";
import resolveFinalizationActorReportTarget from "./resolveFinalizationActorReportTarget.ts";

// Shared reconciliation core for admin/manual rebuild flows.
// Runtime incremental transitions must continue using applyOrderFinalizationToActorReport.

type FinalStatus = "Paid" | "Void" | "Invitation";

export type ReconcileOrderDoc = {
  createdByUserId: Types.ObjectId;
  businessId: Types.ObjectId;
  dailyReferenceNumber: number;
  salesInstanceId:
    | Types.ObjectId
    | {
        _id: Types.ObjectId;
        salesPointId:
          | Types.ObjectId
          | {
              _id: Types.ObjectId;
              salesPointType?: string;
            };
      };
  billingStatus: FinalStatus;
  orderGrossPrice?: number;
  orderNetPrice?: number;
  orderTips?: number;
  orderCostPrice?: number;
  paymentMethod?: IPaymentMethod[];
  businessGoodId?: Types.ObjectId;
  addOns?: Types.ObjectId[];
};

type ActorRows = {
  employeesDailySalesReport: Array<
    IActorDailySalesReport & { salesPointId?: Types.ObjectId }
  >;
  deliveryDailySalesReport?:
    | (IActorDailySalesReport & { salesPointId?: Types.ObjectId })
    | undefined;
  selfOrderingSalesReport: Array<
    IActorDailySalesReport & { salesPointId?: Types.ObjectId }
  >;
};

export const toNumber = (value?: number): number =>
  typeof value === "number" ? value : 0;

export const mergePaymentMethods = (
  base: IPaymentMethod[] | undefined,
  delta: IPaymentMethod[] | undefined,
): IPaymentMethod[] | undefined => {
  if (!Array.isArray(delta) || delta.length === 0) return base;
  const map = new Map<string, IPaymentMethod>();

  (base ?? []).forEach((pm) => {
    map.set(`${pm.paymentMethodType}:${pm.methodBranch}`, { ...pm });
  });

  delta.forEach((pm) => {
    const key = `${pm.paymentMethodType}:${pm.methodBranch}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        paymentMethodType: pm.paymentMethodType,
        methodBranch: pm.methodBranch,
        methodSalesTotal: toNumber(pm.methodSalesTotal),
      });
      return;
    }
    current.methodSalesTotal =
      toNumber(current.methodSalesTotal) + toNumber(pm.methodSalesTotal);
    map.set(key, current);
  });

  return Array.from(map.values());
};

export const mergeGoods = (
  base: IGoodsReduced[] | undefined,
  delta: IGoodsReduced[] | undefined,
): IGoodsReduced[] | undefined => {
  if (!Array.isArray(delta) || delta.length === 0) return base;
  const map = new Map<string, IGoodsReduced>();

  (base ?? []).forEach((good) => {
    map.set(String(good.businessGoodId), { ...good });
  });

  delta.forEach((good) => {
    const key = String(good.businessGoodId);
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        businessGoodId: good.businessGoodId,
        quantity: toNumber(good.quantity),
        totalPrice: toNumber(good.totalPrice),
        totalCostPrice: toNumber(good.totalCostPrice),
      });
      return;
    }
    current.quantity = toNumber(current.quantity) + toNumber(good.quantity);
    current.totalPrice = toNumber(current.totalPrice) + toNumber(good.totalPrice);
    current.totalCostPrice =
      toNumber(current.totalCostPrice) + toNumber(good.totalCostPrice);
    map.set(key, current);
  });

  return Array.from(map.values());
};

const buildEmptyRow = (
  userId: Types.ObjectId,
  salesPointId?: Types.ObjectId,
): IActorDailySalesReport & { salesPointId?: Types.ObjectId } => ({
  userId,
  salesPointId,
  totalSalesBeforeAdjustments: 0,
  totalNetPaidAmount: 0,
  totalTipsReceived: 0,
  totalCostOfGoodsSold: 0,
  totalVoidValue: 0,
  totalInvitedValue: 0,
  employeePaymentMethods: [],
  soldGoods: [],
  voidedGoods: [],
  invitedGoods: [],
});

const getSalesPointData = (
  order: ReconcileOrderDoc,
): { salesPointType?: string; salesPointId?: Types.ObjectId } => {
  const si = order.salesInstanceId;
  if (!si || typeof si !== "object" || !("_id" in si)) {
    return {};
  }
  const populatedSalesInstance = si as {
    salesPointId:
      | Types.ObjectId
      | {
          _id: Types.ObjectId;
          salesPointType?: string;
        };
  };
  const sp = populatedSalesInstance.salesPointId;

  if (typeof sp === "object" && sp !== null && "_id" in sp) {
    return {
      salesPointId: sp._id,
      salesPointType:
        "salesPointType" in sp
          ? (sp as { salesPointType?: string }).salesPointType
          : undefined,
    };
  }

  return { salesPointId: sp as Types.ObjectId };
};

export const updateTopLevelFromActorRows = (report: {
  employeesDailySalesReport?: IActorDailySalesReport[];
  deliveryDailySalesReport?: IActorDailySalesReport;
  selfOrderingSalesReport?: IActorDailySalesReport[];
}) => {
  const result = {
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
  };

  const aggregateOne = (row?: IActorDailySalesReport) => {
    if (!row) return;
    result.businessPaymentMethods = mergePaymentMethods(
      result.businessPaymentMethods,
      row.employeePaymentMethods,
    ) ?? [];
    result.dailyTotalSalesBeforeAdjustments += toNumber(
      row.totalSalesBeforeAdjustments,
    );
    result.dailyNetPaidAmount += toNumber(row.totalNetPaidAmount);
    result.dailyTipsReceived += toNumber(row.totalTipsReceived);
    result.dailyCostOfGoodsSold += toNumber(row.totalCostOfGoodsSold);
    result.dailyCustomersServed += toNumber(row.totalCustomersServed);
    result.dailySoldGoods = mergeGoods(result.dailySoldGoods, row.soldGoods) ?? [];
    result.dailyVoidedGoods =
      mergeGoods(result.dailyVoidedGoods, row.voidedGoods) ?? [];
    result.dailyInvitedGoods =
      mergeGoods(result.dailyInvitedGoods, row.invitedGoods) ?? [];
  };

  (report.employeesDailySalesReport ?? []).forEach((row) => aggregateOne(row));
  aggregateOne(report.deliveryDailySalesReport);
  (report.selfOrderingSalesReport ?? []).forEach((row) => aggregateOne(row));

  result.dailyProfit = result.dailyNetPaidAmount - result.dailyCostOfGoodsSold;
  result.dailyAverageCustomerExpenditure =
    result.dailyCustomersServed > 0
      ? result.dailyNetPaidAmount / result.dailyCustomersServed
      : 0;
  result.dailyTotalVoidValue = result.dailyVoidedGoods.reduce(
    (acc, curr) => acc + toNumber(curr.totalPrice),
    0,
  );
  result.dailyTotalInvitedValue = result.dailyInvitedGoods.reduce(
    (acc, curr) => acc + toNumber(curr.totalPrice),
    0,
  );

  return result;
};

export const buildReconciledActorRowsFromOrders = async (
  orders: ReconcileOrderDoc[],
  session?: ClientSession,
): Promise<ActorRows> => {
  const employeesDailySalesReport: ActorRows["employeesDailySalesReport"] = [];
  const selfOrderingSalesReport: ActorRows["selfOrderingSalesReport"] = [];
  let deliveryDailySalesReport: ActorRows["deliveryDailySalesReport"];

  for (const order of orders) {
    const goods: IGoodsReduced[] = [];
    if (order.businessGoodId) {
      goods.push({
        businessGoodId: order.businessGoodId,
        quantity: 1,
      });
    }
    (order.addOns ?? []).forEach((addOnId) => {
      goods.push({ businessGoodId: addOnId, quantity: 1 });
    });

    const { salesPointType, salesPointId } = getSalesPointData(order);
    const { targetBucket } = await resolveFinalizationActorReportTarget({
      userId: order.createdByUserId,
      businessId: order.businessId,
      salesPointType,
      session,
    });

    const applyPaid = (row: IActorDailySalesReport) => {
      row.totalSalesBeforeAdjustments =
        toNumber(row.totalSalesBeforeAdjustments) + toNumber(order.orderGrossPrice);
      row.totalNetPaidAmount =
        toNumber(row.totalNetPaidAmount) + toNumber(order.orderNetPrice);
      row.totalTipsReceived =
        toNumber(row.totalTipsReceived) + toNumber(order.orderTips);
      row.totalCostOfGoodsSold =
        toNumber(row.totalCostOfGoodsSold) + toNumber(order.orderCostPrice);
      row.employeePaymentMethods = mergePaymentMethods(
        row.employeePaymentMethods,
        order.paymentMethod,
      );
      row.soldGoods = mergeGoods(row.soldGoods, goods);
    };

    const applyVoid = (row: IActorDailySalesReport) => {
      row.totalCostOfGoodsSold =
        toNumber(row.totalCostOfGoodsSold) + toNumber(order.orderCostPrice);
      row.voidedGoods = mergeGoods(row.voidedGoods, goods);
      row.totalVoidValue =
        toNumber(row.totalVoidValue) +
        goods.reduce((acc, curr) => acc + toNumber(curr.totalPrice), 0);
    };

    const applyInvitation = (row: IActorDailySalesReport) => {
      row.totalCostOfGoodsSold =
        toNumber(row.totalCostOfGoodsSold) + toNumber(order.orderCostPrice);
      row.invitedGoods = mergeGoods(row.invitedGoods, goods);
      row.totalInvitedValue =
        toNumber(row.totalInvitedValue) +
        goods.reduce((acc, curr) => acc + toNumber(curr.totalPrice), 0);
    };

    if (targetBucket === "deliveryDailySalesReport") {
      const row = deliveryDailySalesReport ?? buildEmptyRow(order.createdByUserId);
      if (order.billingStatus === "Paid") applyPaid(row);
      if (order.billingStatus === "Void") applyVoid(row);
      if (order.billingStatus === "Invitation") applyInvitation(row);
      deliveryDailySalesReport = row;
      continue;
    }

    if (targetBucket === "selfOrderingSalesReport") {
      const index = selfOrderingSalesReport.findIndex(
        (row) =>
          String(row.userId) === String(order.createdByUserId) &&
          String(row.salesPointId) === String(salesPointId),
      );
      const row =
        index >= 0
          ? selfOrderingSalesReport[index]
          : buildEmptyRow(order.createdByUserId, salesPointId);
      if (order.billingStatus === "Paid") applyPaid(row);
      if (order.billingStatus === "Void") applyVoid(row);
      if (order.billingStatus === "Invitation") applyInvitation(row);
      if (index >= 0) selfOrderingSalesReport[index] = row;
      else selfOrderingSalesReport.push(row);
      continue;
    }

    const employeeIndex = employeesDailySalesReport.findIndex(
      (row) => String(row.userId) === String(order.createdByUserId),
    );
    const employeeRow =
      employeeIndex >= 0
        ? employeesDailySalesReport[employeeIndex]
        : buildEmptyRow(order.createdByUserId);
    if (order.billingStatus === "Paid") applyPaid(employeeRow);
    if (order.billingStatus === "Void") applyVoid(employeeRow);
    if (order.billingStatus === "Invitation") applyInvitation(employeeRow);
    if (employeeIndex >= 0) employeesDailySalesReport[employeeIndex] = employeeRow;
    else employeesDailySalesReport.push(employeeRow);
  }

  return {
    employeesDailySalesReport,
    deliveryDailySalesReport,
    selfOrderingSalesReport,
  };
};

export const buildReconciledDailyPayload = async (input: {
  orders: ReconcileOrderDoc[];
  subscription?: string;
  session?: ClientSession;
}) => {
  const rows = await buildReconciledActorRowsFromOrders(
    input.orders,
    input.session,
  );
  const top = updateTopLevelFromActorRows(rows);

  let comissionPercentage = 0;
  switch (input.subscription) {
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
  }

  return {
    ...rows,
    ...top,
    dailyPosSystemCommission: top.dailyTotalSalesBeforeAdjustments * comissionPercentage,
  };
};
