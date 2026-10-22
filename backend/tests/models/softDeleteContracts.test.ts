import { beforeAll, describe, expect, it } from "vitest";

import Business from "../../src/models/business.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";
import Employee from "../../src/models/employee.ts";
import MonthlyBusinessReport from "../../src/models/monthlyBusinessReport.ts";
import Printer from "../../src/models/printer.ts";
import Promotion from "../../src/models/promotion.ts";
import Supplier from "../../src/models/supplier.ts";
import User from "../../src/models/user.ts";
import WeeklyBusinessReport from "../../src/models/weeklyBusinessReport.ts";
import { softDeleteBackfillModels } from "../../src/models/softDeleteBackfillModels.ts";

type IndexSpec = Record<string, unknown>;

function sameKey(
  a: Record<string, number> | undefined,
  b: Record<string, number>,
): boolean {
  if (!a) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return bKeys.every((k) => a[k] === b[k]);
}

function findIndex(
  indexes: IndexSpec[],
  key: Record<string, number>,
): IndexSpec | undefined {
  return indexes.find((ix) => sameKey(ix.key as Record<string, number> | undefined, key));
}

async function listIndexes(model: {
  syncIndexes: () => Promise<unknown>;
  collection: { listIndexes: () => { toArray: () => Promise<IndexSpec[]> } };
}) {
  await model.syncIndexes();
  return model.collection.listIndexes().toArray();
}

describe("Soft-delete contracts", () => {
  const activeOnly = { deleted: false };

  const partialUniqueIndexes: Array<{
    label: string;
    model: Parameters<typeof listIndexes>[0];
    key: Record<string, number>;
    partial: Record<string, unknown>;
  }> = [
    { label: "User email", model: User, key: { "personalDetails.email": 1 }, partial: activeOnly },
    { label: "Business taxNumber", model: Business, key: { taxNumber: 1 }, partial: activeOnly },
    { label: "Employee taxNumber", model: Employee, key: { taxNumber: 1 }, partial: activeOnly },
    { label: "Supplier legalName", model: Supplier, key: { businessId: 1, legalName: 1 }, partial: activeOnly },
    { label: "Supplier email", model: Supplier, key: { businessId: 1, email: 1 }, partial: activeOnly },
    { label: "Supplier taxNumber", model: Supplier, key: { businessId: 1, taxNumber: 1 }, partial: activeOnly },
    { label: "Printer alias", model: Printer, key: { businessId: 1, printerAlias: 1 }, partial: activeOnly },
    { label: "Printer ip", model: Printer, key: { businessId: 1, ipAddress: 1 }, partial: activeOnly },
    { label: "Promotion name", model: Promotion, key: { businessId: 1, promotionName: 1 }, partial: activeOnly },
    { label: "Daily report reference", model: DailySalesReport, key: { businessId: 1, dailyReferenceNumber: 1 }, partial: activeOnly },
    { label: "Weekly report", model: WeeklyBusinessReport, key: { businessId: 1, weekReference: 1 }, partial: activeOnly },
    { label: "Monthly report", model: MonthlyBusinessReport, key: { businessId: 1, monthReference: 1 }, partial: activeOnly },
  ];

  beforeAll(async () => {
    await Promise.all(
      [...new Set(partialUniqueIndexes.map((entry) => entry.model))].map((model) =>
        model.syncIndexes(),
      ),
    );
  });

  it("enforces an active-only partial unique index for every affected key", async () => {
    for (const entry of partialUniqueIndexes) {
      const indexes = await listIndexes(entry.model);
      const match = findIndex(indexes, entry.key);
      expect(match?.unique, entry.label).toBe(true);
      expect(match?.partialFilterExpression, entry.label).toEqual(entry.partial);
    }
  });

  it("keeps backfill coverage aligned with the full soft-delete model set", () => {
    const labels = softDeleteBackfillModels.map(({ label }) => label).sort();
    expect(labels).toEqual([
      "Business",
      "BusinessGood",
      "DailySalesReport",
      "Employee",
      "Inventory",
      "MonthlyBusinessReport",
      "Notification",
      "Printer",
      "Promotion",
      "Purchase",
      "Rating",
      "Reservation",
      "SalesInstance",
      "SalesPoint",
      "Schedule",
      "Supplier",
      "SupplierGood",
      "User",
      "WeeklyBusinessReport",
    ]);
  });
});
