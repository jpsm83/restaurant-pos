/**
 * Currency-change integrity guard.
 *
 * A venue prices in one currency. It may be corrected while the venue is
 * pristine, but becomes immutable once any financial record exists. This guard
 * covers the records Phase 1 can create; later phases that add financial
 * records extend the list. It is shared so every currency write path enforces
 * the same rule.
 */

import { Types } from "mongoose";

import DailySalesReport from "../models/dailySalesReport.ts";
import MonthlyBusinessReport from "../models/monthlyBusinessReport.ts";
import Order from "../models/order.ts";
import Purchase from "../models/purchase.ts";
import WeeklyBusinessReport from "../models/weeklyBusinessReport.ts";
import { conflict } from "../errors/appError.ts";

const FINANCIAL_RECORD_MODELS = [
  Order,
  Purchase,
  DailySalesReport,
  WeeklyBusinessReport,
  MonthlyBusinessReport,
] as const;

/** True when the venue already has a record priced in its current currency. */
export async function businessHasFinancialRecord(
  businessId: string | Types.ObjectId,
): Promise<boolean> {
  const records = await Promise.all(
    FINANCIAL_RECORD_MODELS.map((model) => model.exists({ businessId })),
  );
  return records.some((record) => record !== null);
}

/**
 * Refuse a currency change once the venue has any financial record. A no-op
 * when the currency is unchanged or absent.
 */
export async function assertBusinessCurrencyChangeAllowed(params: {
  businessId: string | Types.ObjectId;
  currentCurrency?: string;
  nextCurrency?: string;
}): Promise<void> {
  if (
    params.nextCurrency === undefined ||
    params.nextCurrency === params.currentCurrency
  ) {
    return;
  }

  if (await businessHasFinancialRecord(params.businessId)) {
    throw conflict(
      "Currency cannot be changed once the business has financial records.",
    );
  }
}
