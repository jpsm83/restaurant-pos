import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { EJSON } from "bson";

import Business from "../src/models/business.ts";
import User from "../src/models/user.ts";
import Employee from "../src/models/employee.ts";
import Supplier from "../src/models/supplier.ts";
import SupplierGood from "../src/models/supplierGood.ts";
import BusinessGood from "../src/models/businessGood.ts";
import SalesPoint from "../src/models/salesPoint.ts";
import Printer from "../src/models/printer.ts";
import Promotion from "../src/models/promotion.ts";
import Purchase from "../src/models/purchase.ts";
import Notification from "../src/models/notification.ts";
import SalesInstance from "../src/models/salesInstance.ts";
import Order from "../src/models/order.ts";
import Inventory from "../src/models/inventory.ts";
import Reservation from "../src/models/reservation.ts";
import Rating from "../src/models/rating.ts";
import Schedule from "../src/models/schedule.ts";
import DailySalesReport from "../src/models/dailySalesReport.ts";
import WeeklyBusinessReport from "../src/models/weeklyBusinessReport.ts";
import MonthlyBusinessReport from "../src/models/monthlyBusinessReport.ts";

type ModelAndFile = {
  label: string;
  fileName: string;
  model: mongoose.Model<any>;
};

const validationPlan: ModelAndFile[] = [
  { label: "Business", fileName: "business.json", model: Business },
  { label: "User", fileName: "users.json", model: User },
  { label: "Employee", fileName: "employees.json", model: Employee },
  { label: "Supplier", fileName: "suppliers.json", model: Supplier },
  { label: "SupplierGood", fileName: "supplierGoods.json", model: SupplierGood },
  { label: "BusinessGood", fileName: "businessGoods.json", model: BusinessGood },
  { label: "SalesPoint", fileName: "salesLocation.json", model: SalesPoint },
  { label: "Printer", fileName: "printers.json", model: Printer },
  { label: "Promotion", fileName: "promotions.json", model: Promotion },
  { label: "Purchase", fileName: "purchases.json", model: Purchase },
  { label: "Notification", fileName: "notifications.json", model: Notification },
  { label: "SalesInstance", fileName: "salesInstance.json", model: SalesInstance },
  { label: "Order", fileName: "orders.json", model: Order },
  { label: "Inventory", fileName: "inventories.json", model: Inventory },
  { label: "Reservation", fileName: "reservations.json", model: Reservation },
  { label: "Rating", fileName: "ratings.json", model: Rating },
  { label: "Schedule", fileName: "schedules.json", model: Schedule },
  { label: "DailySalesReport", fileName: "dailySalesReport.json", model: DailySalesReport },
  {
    label: "WeeklyBusinessReport",
    fileName: "weeklyBusinessReports.json",
    model: WeeklyBusinessReport,
  },
  {
    label: "MonthlyBusinessReport",
    fileName: "monthlyBusinessReports.json",
    model: MonthlyBusinessReport,
  },
];

const getDummyPath = (fileName: string) =>
  path.resolve(process.cwd(), "../dummyData", fileName);

const readDummyFile = async (fileName: string) => {
  const filePath = getDummyPath(fileName);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = EJSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${fileName} must contain a JSON array`);
  }

  return parsed;
};

const formatValidationError = (error: mongoose.Error.ValidationError) =>
  Object.values(error.errors)
    .map((item) => `${item.path}: ${item.message}`)
    .join(" | ");

const main = async () => {
  let hasErrors = false;

  for (const step of validationPlan) {
    const docs = (await readDummyFile(step.fileName)) as Record<string, unknown>[];

    for (let i = 0; i < docs.length; i += 1) {
      const doc = new step.model(docs[i]);
      const error = doc.validateSync();
      if (error) {
        hasErrors = true;
        const docId = (docs[i]?._id as { toString?: () => string } | undefined)?.toString?.() ?? "unknown";
        console.error(
          `[${step.label}] ${step.fileName} index=${i} _id=${docId} -> ${formatValidationError(error)}`
        );
      }
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log("All dummy data documents passed strict model validation.");
};

main().catch((error) => {
  console.error("Validation script failed:", error);
  process.exit(1);
});
