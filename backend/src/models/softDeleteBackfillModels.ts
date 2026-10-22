import mongoose from "mongoose";

import Business from "./business.ts";
import BusinessGood from "./businessGood.ts";
import DailySalesReport from "./dailySalesReport.ts";
import Employee from "./employee.ts";
import Inventory from "./inventory.ts";
import MonthlyBusinessReport from "./monthlyBusinessReport.ts";
import Notification from "./notification.ts";
import Printer from "./printer.ts";
import Promotion from "./promotion.ts";
import Purchase from "./purchase.ts";
import Reservation from "./reservation.ts";
import SalesInstance from "./salesInstance.ts";
import SalesPoint from "./salesPoint.ts";
import Schedule from "./schedule.ts";
import Supplier from "./supplier.ts";
import SupplierGood from "./supplierGood.ts";
import User from "./user.ts";
import WeeklyBusinessReport from "./weeklyBusinessReport.ts";

export type SoftDeleteModel = mongoose.Model<{ deleted?: boolean | null }>;

export const softDeleteBackfillModels: Array<{
  label: string;
  model: SoftDeleteModel;
}> = [
  { label: "Business", model: Business as SoftDeleteModel },
  { label: "BusinessGood", model: BusinessGood as SoftDeleteModel },
  { label: "DailySalesReport", model: DailySalesReport as SoftDeleteModel },
  { label: "Employee", model: Employee as SoftDeleteModel },
  { label: "Inventory", model: Inventory as SoftDeleteModel },
  { label: "MonthlyBusinessReport", model: MonthlyBusinessReport as SoftDeleteModel },
  { label: "Notification", model: Notification as SoftDeleteModel },
  { label: "Printer", model: Printer as SoftDeleteModel },
  { label: "Promotion", model: Promotion as SoftDeleteModel },
  { label: "Purchase", model: Purchase as SoftDeleteModel },
  { label: "Reservation", model: Reservation as SoftDeleteModel },
  { label: "SalesInstance", model: SalesInstance as SoftDeleteModel },
  { label: "SalesPoint", model: SalesPoint as SoftDeleteModel },
  { label: "Schedule", model: Schedule as SoftDeleteModel },
  { label: "Supplier", model: Supplier as SoftDeleteModel },
  { label: "SupplierGood", model: SupplierGood as SoftDeleteModel },
  { label: "User", model: User as SoftDeleteModel },
  { label: "WeeklyBusinessReport", model: WeeklyBusinessReport as SoftDeleteModel },
];
