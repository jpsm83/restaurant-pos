/**
 * createMonthlyBusinessReport - Finds or creates the open monthly business report
 */

import { ClientSession, Types } from "mongoose";
import MonthlyBusinessReport from "../models/monthlyBusinessReport.ts";

export interface MonthlyReportOpen {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  monthReference: Date;
  isReportOpen: boolean;
};

/**
 * Finds or creates the monthly business report for the supplied month
 * reference. If no report exists for that month, creates a new open report.
 */
export async function createMonthlyBusinessReport(
  businessId: Types.ObjectId,
  monthReference: Date,
  session: ClientSession
): Promise<MonthlyReportOpen | null> {
  const existing = (await MonthlyBusinessReport.findOne({
    businessId,
    monthReference,
  })
    .session(session)
    .lean()) as {
    _id: Types.ObjectId;
    businessId: Types.ObjectId;
    monthReference: Date;
    isReportOpen?: boolean;
  } | null;

  if (existing) {
    return {
      _id: existing._id,
      businessId: existing.businessId,
      monthReference: existing.monthReference,
      isReportOpen: existing.isReportOpen ?? true,
    };
  }

  const created = await MonthlyBusinessReport.create(
    [
      {
        businessId,
        monthReference,
        isReportOpen: true,
      },
    ],
    { session }
  );

  const doc = Array.isArray(created) ? created[0] : created;
  if (!doc) return null;
  const raw = doc as {
    _id: Types.ObjectId;
    businessId: Types.ObjectId;
    monthReference: Date;
    isReportOpen?: boolean;
  };
  return {
    _id: raw._id,
    businessId: raw.businessId,
    monthReference: raw.monthReference,
    isReportOpen: raw.isReportOpen ?? true,
  };
}
