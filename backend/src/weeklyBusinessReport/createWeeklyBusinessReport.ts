/**
 * createWeeklyBusinessReport - Finds or creates the open weekly business report
 */

import { ClientSession, Types } from "mongoose";
import WeeklyBusinessReport from "../models/weeklyBusinessReport.ts";
import isObjectIdValid from "../utils/isObjectIdValid.ts";
import type { WeeklyReportOpen } from "../../../packages/interfaces/IWeeklyBusinessReport.ts";

export async function createWeeklyBusinessReport(
  businessId: Types.ObjectId,
  weekReference: Date,
  session: ClientSession,
): Promise<WeeklyReportOpen | null> {
  if (isObjectIdValid([businessId]) !== true) {
    return null;
  }

  const existing = (await WeeklyBusinessReport.findOne({
    businessId,
    weekReference,
  })
    .session(session)
    .lean()) as {
    _id: Types.ObjectId;
    businessId: Types.ObjectId;
    weekReference: Date;
    isReportOpen?: boolean;
  } | null;

  if (existing) {
    return {
      _id: existing._id,
      businessId: existing.businessId,
      weekReference: existing.weekReference,
      isReportOpen: existing.isReportOpen ?? true,
    };
  }

  const created = await WeeklyBusinessReport.create(
    [
      {
        businessId,
        weekReference,
        isReportOpen: true,
      },
    ],
    { session },
  );

  const doc = Array.isArray(created) ? created[0] : created;
  if (!doc) return null;
  const raw = doc as {
    _id: Types.ObjectId;
    businessId: Types.ObjectId;
    weekReference: Date;
    isReportOpen?: boolean;
  };
  return {
    _id: raw._id,
    businessId: raw.businessId,
    weekReference: raw.weekReference,
    isReportOpen: raw.isReportOpen ?? true,
  };
}
