import { ClientSession, Types } from "mongoose";
import type {
  IActorDailySalesReport,
  IGoodsReduced,
} from "../../../packages/interfaces/IDailySalesReport.ts";
import type { IPaymentMethod } from "../../../packages/interfaces/IPaymentMethod.ts";
import DailySalesReport from "../models/dailySalesReport.ts";
import isObjectIdValid from "../utils/isObjectIdValid.ts";

export type ReportTargetBucket =
  | "employeesDailySalesReport"
  | "deliveryDailySalesReport"
  | "selfOrderingSalesReport";

type FinalStatus = "Paid" | "Void" | "Invitation" | "Cancel";

export interface FinalizationOrderPayload {
  billingStatus: FinalStatus;
  orderGrossPrice?: number;
  orderNetPrice?: number;
  orderTips?: number;
  orderCostPrice?: number;
  paymentMethod?: IPaymentMethod[];
  goods?: IGoodsReduced[];
}

export interface FinalizationAttributionContext {
  userId: Types.ObjectId;
  employeeOnDuty?: boolean;
  salesPointType?: string;
  salesPointId?: Types.ObjectId;
}

export interface ApplyOrderFinalizationToActorReportInput {
  businessId: Types.ObjectId;
  dailyReferenceNumber: number;
  order: FinalizationOrderPayload;
  targetBucket: ReportTargetBucket;
  attribution: FinalizationAttributionContext;
  session?: ClientSession;
}

const toNumber = (value?: number): number => (typeof value === "number" ? value : 0);

const addPaymentMethods = (
  base: IPaymentMethod[] | undefined,
  delta: IPaymentMethod[] | undefined,
): IPaymentMethod[] | undefined => {
  if (!Array.isArray(delta) || delta.length === 0) return base;

  const merged = new Map<string, IPaymentMethod>();
  (base ?? []).forEach((pm) => {
    const key = `${pm.paymentMethodType}:${pm.methodBranch}`;
    merged.set(key, { ...pm });
  });

  delta.forEach((pm) => {
    const key = `${pm.paymentMethodType}:${pm.methodBranch}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        paymentMethodType: pm.paymentMethodType,
        methodBranch: pm.methodBranch,
        methodSalesTotal: toNumber(pm.methodSalesTotal),
      });
      return;
    }
    current.methodSalesTotal =
      toNumber(current.methodSalesTotal) + toNumber(pm.methodSalesTotal);
    merged.set(key, current);
  });

  return Array.from(merged.values());
};

const addGoods = (
  base: IGoodsReduced[] | undefined,
  delta: IGoodsReduced[] | undefined,
): IGoodsReduced[] | undefined => {
  if (!Array.isArray(delta) || delta.length === 0) return base;

  const merged = new Map<string, IGoodsReduced>();
  (base ?? []).forEach((good) => {
    merged.set(String(good.businessGoodId), { ...good });
  });

  delta.forEach((good) => {
    const key = String(good.businessGoodId);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
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
    merged.set(key, current);
  });

  return Array.from(merged.values());
};

const buildEmptyActorRow = (
  attribution: FinalizationAttributionContext,
  targetBucket: ReportTargetBucket,
): IActorDailySalesReport & { salesPointId?: Types.ObjectId } => {
  const row: IActorDailySalesReport & { salesPointId?: Types.ObjectId } = {
    userId: attribution.userId,
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
  };

  if (targetBucket === "selfOrderingSalesReport" && attribution.salesPointId) {
    row.salesPointId = attribution.salesPointId;
  }

  return row;
};

const applyStatusDelta = (
  row: IActorDailySalesReport,
  order: FinalizationOrderPayload,
): void => {
  const gross = toNumber(order.orderGrossPrice);
  const net = toNumber(order.orderNetPrice);
  const tips = toNumber(order.orderTips);
  const cost = toNumber(order.orderCostPrice);
  const goods = order.goods ?? [];
  const goodsTotalPrice = goods.reduce(
    (sum, current) => sum + toNumber(current.totalPrice),
    0,
  );

  switch (order.billingStatus) {
    case "Paid":
      row.employeePaymentMethods = addPaymentMethods(
        row.employeePaymentMethods,
        order.paymentMethod,
      );
      row.soldGoods = addGoods(row.soldGoods, goods);
      row.totalSalesBeforeAdjustments =
        toNumber(row.totalSalesBeforeAdjustments) + gross;
      row.totalNetPaidAmount = toNumber(row.totalNetPaidAmount) + net;
      row.totalTipsReceived = toNumber(row.totalTipsReceived) + tips;
      row.totalCostOfGoodsSold = toNumber(row.totalCostOfGoodsSold) + cost;
      return;
    case "Void":
      row.voidedGoods = addGoods(row.voidedGoods, goods);
      row.totalVoidValue = toNumber(row.totalVoidValue) + goodsTotalPrice;
      row.totalCostOfGoodsSold = toNumber(row.totalCostOfGoodsSold) + cost;
      return;
    case "Invitation":
      row.invitedGoods = addGoods(row.invitedGoods, goods);
      row.totalInvitedValue = toNumber(row.totalInvitedValue) + goodsTotalPrice;
      row.totalCostOfGoodsSold = toNumber(row.totalCostOfGoodsSold) + cost;
      return;
    case "Cancel":
      return;
  }
};

const resolveRowIndex = (
  rows: Array<IActorDailySalesReport & { salesPointId?: Types.ObjectId }>,
  input: ApplyOrderFinalizationToActorReportInput,
): number => {
  if (input.targetBucket === "selfOrderingSalesReport") {
    return rows.findIndex(
      (row) =>
        String(row.userId) === String(input.attribution.userId) &&
        String(row.salesPointId) === String(input.attribution.salesPointId),
    );
  }

  return rows.findIndex(
    (row) => String(row.userId) === String(input.attribution.userId),
  );
};

const applyOrderFinalizationToActorReport = async (
  input: ApplyOrderFinalizationToActorReportInput,
): Promise<{ applied: boolean; reason?: string }> => {
  if (!isObjectIdValid([input.businessId, input.attribution.userId])) {
    return { applied: false, reason: "Invalid businessId/userId." };
  }

  if (
    input.targetBucket === "selfOrderingSalesReport" &&
    !input.attribution.salesPointId
  ) {
    return {
      applied: false,
      reason: "salesPointId is required for selfOrderingSalesReport bucket.",
    };
  }

  if (input.order.billingStatus === "Cancel") {
    return { applied: false, reason: "Cancel is excluded by policy." };
  }

  const report = await DailySalesReport.findOne(
    {
      businessId: input.businessId,
      dailyReferenceNumber: input.dailyReferenceNumber,
    },
    undefined,
    { session: input.session },
  );

  if (!report) {
    return { applied: false, reason: "Daily report not found." };
  }

  if (input.targetBucket === "deliveryDailySalesReport") {
    const baseRow =
      (report.deliveryDailySalesReport as IActorDailySalesReport | undefined) ??
      buildEmptyActorRow(input.attribution, input.targetBucket);
    applyStatusDelta(baseRow, input.order);
    report.deliveryDailySalesReport = baseRow;
    await report.save({ session: input.session });
    return { applied: true };
  }

  const bucketRows = (
    report[input.targetBucket] as Array<
      IActorDailySalesReport & { salesPointId?: Types.ObjectId }
    > | undefined
  ) ?? [];

  const rowIndex = resolveRowIndex(bucketRows, input);
  const targetRow =
    rowIndex >= 0
      ? bucketRows[rowIndex]
      : buildEmptyActorRow(input.attribution, input.targetBucket);

  applyStatusDelta(targetRow, input.order);

  if (rowIndex >= 0) {
    bucketRows[rowIndex] = targetRow;
  } else {
    bucketRows.push(targetRow);
  }

  report[input.targetBucket] = bucketRows;
  await report.save({ session: input.session });

  return { applied: true };
};

export default applyOrderFinalizationToActorReport;
