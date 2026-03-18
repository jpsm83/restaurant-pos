import mongoose, { Schema, model } from "mongoose";
import { paymentMethod } from "./paymentMethod.js";

// Minimal parity schema: keep main structure used by routes and later reporting.
export const goodsReducedSchema = new Schema(
  {
    businessGoodId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    quantity: { type: Number, required: true },
    totalPrice: { type: Number },
    totalCostPrice: { type: Number },
  },
  { timestamps: true, trim: true }
);

const employeeDailySalesReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    hasOpenSalesInstances: { type: Boolean },
    employeePaymentMethods: { type: [paymentMethod], default: undefined },
    totalSalesBeforeAdjustments: { type: Number },
    totalNetPaidAmount: { type: Number },
    totalTipsReceived: { type: Number },
    totalCostOfGoodsSold: { type: Number },
    totalCustomersServed: { type: Number, default: 0 },
    averageCustomerExpenditure: { type: Number, default: 0 },
    soldGoods: { type: [goodsReducedSchema], default: undefined },
    voidedGoods: { type: [goodsReducedSchema], default: undefined },
    invitedGoods: { type: [goodsReducedSchema], default: undefined },
    totalVoidValue: { type: Number },
    totalInvitedValue: { type: Number },
  },
  { timestamps: true, trim: true }
);

const selfOrderingSalesReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerPaymentMethod: { type: [paymentMethod], default: undefined },
    totalSalesBeforeAdjustments: { type: Number },
    totalNetPaidAmount: { type: Number },
    totalCostOfGoodsSold: { type: Number },
    soldGoods: { type: [goodsReducedSchema], default: undefined },
  },
  { timestamps: true, trim: true }
);

const dailySalesReportSchema = new Schema(
  {
    dailyReferenceNumber: { type: Number, required: true, unique: true },
    isDailyReportOpen: { type: Boolean, default: true },
    timeCountdownToClose: { type: Number, required: true },
    employeesDailySalesReport: { type: [employeeDailySalesReportSchema], default: undefined },
    selfOrderingSalesReport: { type: [selfOrderingSalesReportSchema], default: undefined },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    businessPaymentMethods: { type: [paymentMethod], default: undefined },
    dailyTotalSalesBeforeAdjustments: { type: Number },
    dailyNetPaidAmount: { type: Number },
    dailyTipsReceived: { type: Number },
    dailyCostOfGoodsSold: { type: Number },
    dailyProfit: { type: Number },
    dailyCustomersServed: { type: Number },
    dailyAverageCustomerExpenditure: { type: Number },
    dailySoldGoods: { type: [goodsReducedSchema], default: undefined },
    dailyVoidedGoods: { type: [goodsReducedSchema], default: undefined },
    dailyInvitedGoods: { type: [goodsReducedSchema], default: undefined },
    dailyTotalVoidValue: { type: Number },
    dailyTotalInvitedValue: { type: Number },
    dailyPosSystemCommission: { type: Number },
  },
  { timestamps: true, trim: true }
);

const DailySalesReport = model("DailySalesReport", dailySalesReportSchema);
export default DailySalesReport;

