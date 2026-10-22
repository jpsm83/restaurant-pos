import type { z } from "zod";

import { updateMonthlyBusinessReportBodySchema } from "restaurant-pos-packages/schemas/businessReports";

/**
 * The business-report DTOs that shape a persisted document. The query and params
 * DTOs are excluded: their keys are read-only filters/identifiers, not writers of
 * a model field, so the server-owned-field sweep must not flag them.
 */
export const businessReportBodySchemas: Record<string, z.ZodObject> = {
  updateMonthlyBusinessReportBodySchema,
};

/** Server-owned top-level WeeklyBusinessReport fields a client must never set. */
export const weeklyBusinessReportServerOwnedFields = [
  "isReportOpen",
  "businessId",
  "weekReference",
  "financialSummary",
  "costBreakdown",
  "goodsSold",
  "goodsVoided",
  "goodsComplimentary",
  "supplierWasteAnalysis",
  "metricsComparison",
  "totalCustomersServed",
  "averageSpendingPerCustomer",
  "paymentMethods",
  "posSystemCommission",
  "deleted",
  "deletedAt",
  "createdAt",
  "updatedAt",
] as const;

/** Server-owned top-level MonthlyBusinessReport fields a client must never set. */
export const monthlyBusinessReportServerOwnedFields = [
  "isReportOpen",
  "businessId",
  "monthReference",
  "financialSummary",
  "costBreakdown",
  "goodsSold",
  "goodsVoided",
  "goodsComplimentary",
  "supplierWasteAnalysis",
  "metricsComparison",
  "totalCustomersServed",
  "averageSpendingPerCustomer",
  "paymentMethods",
  "posSystemCommission",
  "deleted",
  "deletedAt",
  "createdAt",
  "updatedAt",
] as const;
