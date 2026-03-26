import mongoose, { Schema, model } from "mongoose";
import { paymentMethod } from "./paymentMethod.ts";

export const goodsReducedSchema = new Schema(
  {
    businessGoodId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Business good id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // good sold or void
    quantity: {
      type: Number,
      required: [true, "Quantity is required!"],
    }, // quanity of the good sold or void
    totalPrice: { type: Number }, // total price of the good sold or void
    totalCostPrice: { type: Number }, // total cost price of the good sold or void
  },
  {
    timestamps: true,
    trim: true,
  }
);

const sharedDailySalesReportFields: Record<string, any> = {
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User id is required!"],
    index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
  },
  hasOpenSalesInstances: { type: Boolean }, // if actor has open sales instances, report can be viewed but close may be blocked
  employeePaymentMethods: { type: [paymentMethod], default: undefined }, // payment totals bucket used across channels
  totalSalesBeforeAdjustments: { type: Number }, // sum before promotions/discounts/voids/invitations
  totalNetPaidAmount: { type: Number }, // sum after adjustments
  totalTipsReceived: { type: Number }, // sum of tips
  totalCostOfGoodsSold: { type: Number }, // sum of COGS
  totalCustomersServed: {
    type: Number,
    default: 0,
  },
  averageCustomerExpenditure: {
    type: Number,
    default: 0,
  },
  soldGoods: { type: [goodsReducedSchema], default: undefined },
  voidedGoods: { type: [goodsReducedSchema], default: undefined },
  invitedGoods: { type: [goodsReducedSchema], default: undefined },
  totalVoidValue: { type: Number },
  totalInvitedValue: { type: Number },
};

const employeeDailySalesReportSchema = new Schema(
  {
    ...sharedDailySalesReportFields,
  },
  {
    timestamps: true,
    trim: true,
  }
); // individual sales report of the employee

const selfOrderingDailySalesReportSchema = new Schema(
  {
    ...sharedDailySalesReportFields,
    salesPointId: {
      type: Schema.Types.ObjectId,
      ref: "SalesPoint",
      required: [true, "Sales point id is required for self ordering report!"],
      index: true,
    }, // self-ordering entries must keep channel/sales point context
  },
  {
    timestamps: true,
    trim: true,
  }
);

const dailySalesReportSchema = new Schema(
  {
    // required fields
    dailyReferenceNumber: {
      type: Number,
      required: [true, "Daily reference number is required!"],
    }, // This is the reference number of the work day, we cant use dates to refer to work day because one work day can be closed in the next day, therefore we need a reference number to refer to the work day report.
    isDailyReportOpen: { type: Boolean, default: true }, // This is the status of the daily report, if it is open or closed, if it is open the employee can still add sales to the report, if it is closed the employee can only see the report. Once close all the calculations will be done and the report will be closed for editing.
    timeCountdownToClose: {
      type: Number,
      required: [true, "Time count down to close is required!"],
    }, // This date is the limit date to close the daily report, it usualy will be the next 24 hours after the current dailyReferenceNumber is created.
    employeesDailySalesReport: {
      type: [employeeDailySalesReportSchema],
      default: undefined,
    }, // array of objects with each individual sales report of the employee
    deliveryDailySalesReport: {
      type: employeeDailySalesReportSchema,
      default: undefined,
    }, // aggregated delivery sales report (stored as a single bucket)
    selfOrderingSalesReport: {
      type: [selfOrderingDailySalesReportSchema],
      default: undefined,
    }, // array of self ordering reports (shared base + self-order specifics)
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    },
    // optional fields for creation, required for update
    businessPaymentMethods: { type: [paymentMethod], default: undefined }, // array of all payment methods and its total sales
    dailyTotalSalesBeforeAdjustments: { type: Number }, // sum of all employees sales
    dailyNetPaidAmount: { type: Number }, // sum of all employees netPaid
    dailyTipsReceived: { type: Number }, // sum of all employees tips
    dailyCostOfGoodsSold: { type: Number }, // sum of all goods costPrice incluiding voids and invitaions
    dailyProfit: { type: Number }, // difference between totalNetPaid and totalCost (totalNetPaid - totalCost)
    dailyCustomersServed: { type: Number }, // sum of all employees customersServed
    dailyAverageCustomerExpenditure: { type: Number }, // average of all employees customersExpended (totalNetPaid / dailyCustomersServed)
    dailySoldGoods: { type: [goodsReducedSchema], default: undefined }, // array of goods sold on the day
    dailyVoidedGoods: { type: [goodsReducedSchema], default: undefined }, // array of goods void on the day
    dailyInvitedGoods: { type: [goodsReducedSchema], default: undefined }, // array of goods invited on the day
    dailyTotalVoidValue: { type: Number }, // sum of the price of the void items
    dailyTotalInvitedValue: { type: Number }, // sum of the price of the invited items
    dailyPosSystemCommission: { type: Number }, // comission of the POS system app
  },
  {
    timestamps: true,
    trim: true,
  }
);

// One operational day reference per business.
dailySalesReportSchema.index(
  { businessId: 1, dailyReferenceNumber: 1 },
  { unique: true },
);

const DailySalesReport =
  mongoose.models.DailySalesReport ||
  model("DailySalesReport", dailySalesReportSchema);
export default DailySalesReport;