import { beforeAll, describe, expect, it } from "vitest";

import BusinessGood from "../../src/models/businessGood.ts";
import Purchase from "../../src/models/purchase.ts";
import SalesPoint from "../../src/models/salesPoint.ts";
import SupplierGood from "../../src/models/supplierGood.ts";
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
  beforeAll(async () => {
    await Promise.all([
      SalesPoint.syncIndexes(),
      BusinessGood.syncIndexes(),
      SupplierGood.syncIndexes(),
      Purchase.syncIndexes(),
    ]);
  });

  it("enforces active-only unique indexes for newly covered key fields", async () => {
    const salesPointIndexes = await listIndexes(SalesPoint);
    const businessGoodIndexes = await listIndexes(BusinessGood);
    const supplierGoodIndexes = await listIndexes(SupplierGood);
    const purchaseIndexes = await listIndexes(Purchase);

    const salesPointNameIx = findIndex(salesPointIndexes, {
      businessId: 1,
      salesPointName: 1,
    });
    const deliveryPointIx = findIndex(salesPointIndexes, {
      businessId: 1,
      salesPointType: 1,
    });
    const businessGoodNameIx = findIndex(businessGoodIndexes, {
      businessId: 1,
      name: 1,
    });
    const supplierGoodNameIx = findIndex(supplierGoodIndexes, {
      businessId: 1,
      supplierId: 1,
      name: 1,
    });
    const purchaseReceiptIx = findIndex(purchaseIndexes, {
      businessId: 1,
      supplierId: 1,
      receiptId: 1,
    });

    expect(salesPointNameIx?.unique).toBe(true);
    expect(salesPointNameIx?.partialFilterExpression).toEqual({ deleted: false });

    expect(deliveryPointIx?.unique).toBe(true);
    expect(deliveryPointIx?.partialFilterExpression).toEqual({
      deleted: false,
      salesPointType: "delivery",
    });

    expect(businessGoodNameIx?.unique).toBe(true);
    expect(businessGoodNameIx?.partialFilterExpression).toEqual({ deleted: false });

    expect(supplierGoodNameIx?.unique).toBe(true);
    expect(supplierGoodNameIx?.partialFilterExpression).toEqual({ deleted: false });

    expect(purchaseReceiptIx?.unique).toBe(true);
    expect(purchaseReceiptIx?.partialFilterExpression).toEqual({ deleted: false });
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
