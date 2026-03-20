/**
 * createMonthlyBusinessReport - Finds or creates the open monthly business report
 */

import { ClientSession, Types } from "mongoose";
import MonthlyBusinessReport from "../models/monthlyBusinessReport.ts";
import { isObjectIdValid } from "../utils/isObjectIdValid.ts";

export type MonthlyReportOpen = {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  monthReference: Date;
  isReportOpen: boolean;
};

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Finds or creates the open monthly business report for the current month.
 * If no report exists for the current month, creates a new open report.
 */
export async function createMonthlyBusinessReport(
  businessId: Types.ObjectId,
  session: ClientSession
): Promise<MonthlyReportOpen | null> {
  if (isObjectIdValid([businessId]) !== true) {
    return null;
  }

  const now = new Date();
  const monthStart = getMonthStart(now);

  const existing = (await MonthlyBusinessReport.findOne({
    businessId,
    monthReference: monthStart,
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
        monthReference: monthStart,
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
