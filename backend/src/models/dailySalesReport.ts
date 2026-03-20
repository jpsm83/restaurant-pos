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

const employeeDailySalesReportSchema = new Schema(
  {
    // required fields
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // user (employee role) for this report entry, salesInstance.responsibleByUserId

    // optional fields on creation, required on update
    hasOpenSalesInstances: { type: Boolean }, // if the employee has open sales instances, the employee can view but not close the daily report
    // those "SALES" refer salesInstance sales closed by the employee (salesInstance.responsibleBy)
    // not "SALES" made by the employee, the employee can close the salesInstance of another employee if shifts are passed and the previous employee has opened the tables
    // when a salesInstance is closed, the sales from the previews employee is pass to the new one because the new employee is responsible for the salesInstance and will handle the payment in the end
    employeePaymentMethods: { type: [paymentMethod], default: undefined }, // array of payment methods used by the employee
    totalSalesBeforeAdjustments: { type: Number }, // sum of all orders made by the salesInstance.closedBy regardless of promotions, discounts, voids, or cancellations
    totalNetPaidAmount: { type: Number }, // sum of all orders after adjustments have been made to the final price, vois, invitations, discounts, and promotions
    totalTipsReceived: { type: Number }, // sum of all tips
    totalCostOfGoodsSold: { type: Number }, // sum of the cost price of all goods sold by the employee
    // if salesInstance is passed to another employee, new employee will be responsible for the previews sales, and also the customers served at the salesInstance will be pass to the new employee
    // we recomment employees to close their tables on a shift change, so the individual analitics by employee will be more accurate
    // this has no negative impact on the business analitics, because the sales will be passed to the new employee, and the customers served will be passed to the new employee
    totalCustomersServed: {
      type: Number,
      default: 0,
    }, // total of customers served
    averageCustomerExpenditure: {
      type: Number,
      default: 0,
    }, // average of customers expended (total of customers served / total of sales)
    // those "GOODS" refer to the goods sold or void by the employee itself, not the one that closed the salesInstance (order.employee)
    soldGoods: { type: [goodsReducedSchema], default: undefined }, // array of goods sold by the employee
    voidedGoods: { type: [goodsReducedSchema], default: undefined }, // array of goods void by the employee
    invitedGoods: { type: [goodsReducedSchema], default: undefined }, // array of goods invited by the employee
    totalVoidValue: { type: Number }, // sum of the price of the voided items
    totalInvitedValue: { type: Number }, // sum of the price of the invited items
  },
  {
    timestamps: true,
    trim: true,
  }
); // individual sales report of the employee

const selfOrderingSalesReportSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // user (customer role) that made the self-order
    customerPaymentMethod: { type: [paymentMethod], default: undefined }, // single payment methods used by the customer
    totalSalesBeforeAdjustments: { type: Number }, // sum of all orders regardless of promotions or discounts
    totalNetPaidAmount: { type: Number }, // sum of all orders after adjustments have been made to the final price as discounts and promotions
    totalCostOfGoodsSold: { type: Number }, // sum of the cost price of all goods sold
    soldGoods: { type: [goodsReducedSchema], default: undefined }, // array of goods purchased
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
      unique: true,
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
      type: [selfOrderingSalesReportSchema],
      default: undefined,
    }, // array of objects with all individual self ordering sales reports
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

const DailySalesReport =
  mongoose.models.DailySalesReport ||
  model("DailySalesReport", dailySalesReportSchema);
export default DailySalesReport;
