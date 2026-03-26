import path from "node:path";
import dotenv from "dotenv";
import mongoose, { Types } from "mongoose";
import DailySalesReport from "../src/models/dailySalesReport.ts";
import Order from "../src/models/order.ts";
import SalesInstance from "../src/models/salesInstance.ts";
import SalesPoint from "../src/models/salesPoint.ts";
import Business from "../src/models/business.ts";
import {
  buildReconciledDailyPayload,
  type ReconcileOrderDoc,
} from "../src/dailySalesReports/reconciliationCore.ts";

// One-time/backfill path uses the same shared reconciliation core as manual endpoint.

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const main = async () => {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  const businessIdArg = process.argv.find((arg) =>
    arg.startsWith("--businessId="),
  );
  const businessIdFilter = businessIdArg?.split("=")[1];

  await mongoose.connect(mongodbUri, {
    dbName: "restaurantPos",
    bufferCommands: true,
  });

  const reportFilter: {
    isDailyReportOpen: boolean;
    businessId?: Types.ObjectId;
  } = { isDailyReportOpen: true };

  if (businessIdFilter) {
    reportFilter.businessId = new Types.ObjectId(businessIdFilter);
  }

  const openReports = await DailySalesReport.find(reportFilter)
    .select("_id businessId dailyReferenceNumber")
    .lean();

  console.log(`Found ${openReports.length} open daily report(s) to reconcile.`);

  for (const report of openReports) {
    const businessId = report.businessId as Types.ObjectId;
    const dailyReferenceNumber = report.dailyReferenceNumber as number;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const [orders, businessDoc] = await Promise.all([
        Order.find({
          businessId,
          dailyReferenceNumber,
          billingStatus: { $in: ["Paid", "Void", "Invitation"] },
        })
          .select(
            "createdByUserId businessId dailyReferenceNumber salesInstanceId billingStatus orderGrossPrice orderNetPrice orderTips orderCostPrice paymentMethod businessGoodId addOns",
          )
          .populate({
            path: "salesInstanceId",
            select: "salesPointId",
            model: SalesInstance,
            populate: {
              path: "salesPointId",
              model: SalesPoint,
              select: "salesPointType",
            },
          })
          .session(session)
          .lean(),
        Business.findById(businessId)
          .select("subscription")
          .session(session)
          .lean(),
      ]);

      const payload = await buildReconciledDailyPayload({
        orders: orders as unknown as ReconcileOrderDoc[],
        subscription: (businessDoc as { subscription?: string } | null)?.subscription,
        session,
      });

      await DailySalesReport.updateOne(
        { _id: report._id },
        {
          $set: {
            ...payload,
          },
        },
        { session },
      );

      await session.commitTransaction();
      console.log(
        `Reconciled report ${String(report._id)} | business=${String(businessId)} | dailyReferenceNumber=${dailyReferenceNumber}`,
      );
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  await mongoose.disconnect();
  console.log("Open daily report reconciliation finished.");
};

main().catch(async (error) => {
  console.error("Reconcile open daily reports failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors in failure path
  }
  process.exit(1);
});
