import dotenv from "dotenv";
import path from "node:path";
import mongoose from "mongoose";

import Business from "../src/models/business.ts";
import Employee from "../src/models/employee.ts";
import DailySalesReport from "../src/models/dailySalesReport.ts";
import Printer from "../src/models/printer.ts";
import Promotion from "../src/models/promotion.ts";
import Supplier from "../src/models/supplier.ts";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

type SoftDeleteModel = mongoose.Model<{ deleted?: boolean | null }>;

const models: Array<{ label: string; model: SoftDeleteModel }> = [
  { label: "Business", model: Business as SoftDeleteModel },
  { label: "Employee", model: Employee as SoftDeleteModel },
  { label: "DailySalesReport", model: DailySalesReport as SoftDeleteModel },
  { label: "Printer", model: Printer as SoftDeleteModel },
  { label: "Promotion", model: Promotion as SoftDeleteModel },
  { label: "Supplier", model: Supplier as SoftDeleteModel },
];

async function main() {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  await mongoose.connect(mongodbUri, {
    dbName: "pos",
    bufferCommands: true,
  });

  console.log("Connected to MongoDB.");

  for (const { label, model } of models) {
    const result = await model.updateMany(
      {
        $or: [{ deleted: { $exists: false } }, { deleted: null }],
      },
      { $set: { deleted: false } },
    );

    console.log(`[${label}] backfilled deleted=false on ${result.modifiedCount} documents`);
    await model.syncIndexes();
    console.log(`[${label}] indexes synced`);
  }

  await mongoose.disconnect();
  console.log("Soft-delete deleted-flag backfill completed.");
}

main().catch(async (error) => {
  console.error("Soft-delete deleted-flag backfill failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors on failure path
  }
  process.exit(1);
});
