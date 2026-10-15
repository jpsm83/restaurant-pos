import type { z } from "zod";

import { calculateUsersReportBodySchema } from "domain/schemas/dailySalesReports";

/**
 * The dailySalesReports DTOs that shape a persisted document. The query DTO is
 * excluded: its `dailyReferenceNumber*` keys are read-only filters, not writers
 * of the model field, so the server-owned-field sweep must not flag them.
 */
export const dailySalesReportBodySchemas: Record<string, z.ZodObject> = {
  calculateUsersReportBodySchema,
};

/** Server-owned top-level DailySalesReport fields a client must never set. */
export const dailySalesReportServerOwnedFields = [
  "dailyReferenceNumber",
  "isDailyReportOpen",
  "timeCountdownToClose",
  "employeesDailySalesReport",
  "deliveryDailySalesReport",
  "selfOrderingSalesReport",
  "businessPaymentMethods",
  "dailyTotalSalesBeforeAdjustments",
  "dailyNetPaidAmount",
  "dailyTipsReceived",
  "dailyCostOfGoodsSold",
  "dailyProfit",
  "dailyCustomersServed",
  "dailyAverageCustomerExpenditure",
  "dailySoldGoods",
  "dailyVoidedGoods",
  "dailyInvitedGoods",
  "dailyTotalVoidValue",
  "dailyTotalInvitedValue",
  "dailyPosSystemCommission",
  "createdAt",
  "updatedAt",
] as const;
