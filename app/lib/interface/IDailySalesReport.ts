import { Types } from "mongoose";
import { IPaymentMethod } from "./IPaymentMethod";

export interface IGoodsReduced {
  businessGoodId: Types.ObjectId; // reference to the "Order" model
  quantity: number; // quantity of the good sold or void
  totalPrice?: number; // total price of the good sold or void
  totalCostPrice?: number; // total cost price of the good sold or void
}

export interface IEmployeeDailySalesReport {
  employeeId: Types.ObjectId;
  hasOpenSalesInstances?: boolean;
  employeePaymentMethods?: IPaymentMethod[];
  totalSalesBeforeAdjustments?: number;
  totalNetPaidAmount?: number;
  totalTipsReceived?: number;
  totalCostOfGoodsSold?: number;
  totalCustomersServed?: number;
  averageCustomerExpenditure?: number;
  soldGoods?: IGoodsReduced[];
  voidedGoods?: IGoodsReduced[];
  invitedGoods?: IGoodsReduced[];
  totalVoidValue?: number;
  totalInvitedValue?: number;
}

export interface ISelfOrderingSalesReport {
  customerId: Types.ObjectId;
  customerPaymentMethods?: IPaymentMethod[];
  totalSalesBeforeAdjustments?: number;
  totalNetPaidAmount?: number;
  totalCostOfGoodsSold?: number;
  soldGoods?: IGoodsReduced[];
}

export interface IDailySalesReport {
  _id?: Types.ObjectId;
  dailyReferenceNumber: number;
  isDailyReportOpen: boolean;
  timeCountdownToClose: number;
  employeesDailySalesReport: IEmployeeDailySalesReport[];
  selfOrderingSalesReport: IEmployeeDailySalesReport[];
  businessId: Types.ObjectId;
  businessPaymentMethods?: IPaymentMethod[];
  dailyTotalSalesBeforeAdjustments?: number;
  dailyNetPaidAmount?: number;
  dailyTipsReceived?: number;
  dailyCostOfGoodsSold?: number;
  dailyProfit?: number;
  dailyCustomersServed?: number;
  dailyAverageCustomerExpenditure?: number;
  dailySoldGoods?: IGoodsReduced[];
  dailyVoidedGoods?: IGoodsReduced[];
  dailyInvitedGoods?: IGoodsReduced[];
  dailyTotalVoidValue?: number;
  dailyTotalInvitedValue?: number;
  dailyPosSystemCommission?: number;
}
