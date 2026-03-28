import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
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

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config(); // fallback to backend/.env if present

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ModelAndFile = {
  label: string;
  fileName: string;
  model: mongoose.Model<any>;
};

const importPlan: ModelAndFile[] = [
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
  { label: "WeeklyBusinessReport", fileName: "weeklyBusinessReports.json", model: WeeklyBusinessReport },
  {
    label: "MonthlyBusinessReport",
    fileName: "monthlyBusinessReports.json",
    model: MonthlyBusinessReport,
  },
];

const getDummyPath = (fileName: string) =>
  path.resolve(__dirname, "../dummyData", fileName);

const readDummyFile = async (fileName: string) => {
  const filePath = getDummyPath(fileName);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = EJSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${fileName} must contain a JSON array`);
  }

  return parsed;
};

const upsertManyById = async (
  model: mongoose.Model<any>,
  docs: Record<string, unknown>[]
) => {
  if (!docs.length) {
    return { matched: 0, modified: 0, upserted: 0 };
  }

  const operations = docs.map((doc) => {
    if (!doc._id) {
      throw new Error(`Document for ${model.modelName} is missing _id`);
    }

    return {
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    };
  });

  // Keep strict model validation enabled during seed.
  const res = await model.bulkWrite(operations, {
    ordered: true,
    skipValidation: false,
  });

  return {
    matched: res.matchedCount,
    modified: res.modifiedCount,
    upserted: res.upsertedCount,
  };
};

const clearExistingData = async () => {
  // Delete in reverse dependency order to minimize transient reference issues.
  const deletionPlan = [...importPlan].reverse();
  let totalDeleted = 0;

  console.log("Clearing existing restaurant data before import...");

  for (const step of deletionPlan) {
    const result = await step.model.deleteMany({});
    const deleted = result.deletedCount ?? 0;
    totalDeleted += deleted;
    console.log(`[${step.label}] deleted=${deleted}`);
  }

  console.log(`Existing data cleared. Total deleted documents: ${totalDeleted}`);
};

const main = async () => {
  const mongodbUri = process.env.MONGODB_URI;

  if (!mongodbUri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  await mongoose.connect(mongodbUri, {
    dbName: "restaurantPos",
    bufferCommands: true,
  });

  console.log("Connected to MongoDB.");
  await clearExistingData();
  console.log("Importing refreshed dummy data...");

  for (const step of importPlan) {
    const docs = (await readDummyFile(step.fileName)) as Record<string, unknown>[];
    const result = await upsertManyById(step.model, docs);

    console.log(
      `[${step.label}] ${docs.length} docs processed | matched=${result.matched} modified=${result.modified} upserted=${result.upserted}`
    );
  }

  console.log("Dummy data import completed successfully.");
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("Dummy data import failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect error on failure path
  }
  process.exit(1);
});
