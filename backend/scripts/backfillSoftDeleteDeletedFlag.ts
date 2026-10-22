import dotenv from "dotenv";
import path from "node:path";
import mongoose from "mongoose";
import { softDeleteBackfillModels } from "../src/models/softDeleteBackfillModels.ts";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

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

  for (const { label, model } of softDeleteBackfillModels) {
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
