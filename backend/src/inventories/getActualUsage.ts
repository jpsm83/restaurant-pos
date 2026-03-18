import { Types } from "mongoose";
import Inventory from "../models/inventory.js";
import Purchase from "../models/purchase.js";
import SupplierGood from "../models/supplierGood.js";

interface InvGoodLean {
  supplierGoodId: Types.ObjectId;
  dynamicSystemCount?: number;
}
interface InventoryLean {
  inventoryGoods?: InvGoodLean[];
}
interface PurchaseItemLean {
  supplierGoodId: Types.ObjectId;
  quantityPurchased?: number;
}
interface PurchaseLean {
  purchaseInventoryItems?: PurchaseItemLean[];
}

export interface ActualUsageItem {
  supplierGoodId: Types.ObjectId;
  quantity: number;
  measurementUnit: string;
}

export async function getActualUsage(
  businessId: Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<ActualUsageItem[]> {
  const [openingInventory, closingInventory, purchasesInRange] =
    await Promise.all([
      Inventory.findOne({
        businessId,
        setFinalCount: true,
        updatedAt: { $lt: startDate },
      })
        .sort({ updatedAt: -1 })
        .select("inventoryGoods.supplierGoodId inventoryGoods.dynamicSystemCount")
        .lean() as Promise<InventoryLean | null>,
      Inventory.findOne({
        businessId,
        setFinalCount: true,
        updatedAt: { $lte: endDate },
      })
        .sort({ updatedAt: -1 })
        .select("inventoryGoods.supplierGoodId inventoryGoods.dynamicSystemCount")
        .lean() as Promise<InventoryLean | null>,
      Purchase.find({
        businessId,
        purchaseDate: { $gte: startDate, $lte: endDate },
      })
        .select("purchaseInventoryItems.supplierGoodId purchaseInventoryItems.quantityPurchased")
        .lean() as Promise<PurchaseLean[]>,
    ]);

  const openingMap = new Map<string, number>();
  (openingInventory as InventoryLean | null)?.inventoryGoods?.forEach((ig: InvGoodLean) => {
    const id = ig.supplierGoodId?.toString?.() ?? ig.supplierGoodId?.toString();
    if (id) openingMap.set(id, ig.dynamicSystemCount ?? 0);
  });

  const closingMap = new Map<string, number>();
  (closingInventory as InventoryLean | null)?.inventoryGoods?.forEach((ig: InvGoodLean) => {
    const id = ig.supplierGoodId?.toString?.() ?? ig.supplierGoodId?.toString();
    if (id) closingMap.set(id, ig.dynamicSystemCount ?? 0);
  });

  const purchasesMap = new Map<string, number>();
  (purchasesInRange as PurchaseLean[]).forEach((p: PurchaseLean) => {
    p.purchaseInventoryItems?.forEach((item: PurchaseItemLean) => {
      const id = item.supplierGoodId?.toString?.() ?? item.supplierGoodId?.toString();
      if (id) {
        const prev = purchasesMap.get(id) ?? 0;
        purchasesMap.set(id, prev + (item.quantityPurchased ?? 0));
      }
    });
  });

  const allSupplierGoodIds = new Set<string>([
    ...openingMap.keys(),
    ...closingMap.keys(),
    ...purchasesMap.keys(),
  ]);

  const supplierGoods = (await SupplierGood.find({
    _id: { $in: Array.from(allSupplierGoodIds).map((id) => new Types.ObjectId(id)) },
  })
    .select("_id measurementUnit")
    .lean()) as { _id: Types.ObjectId; measurementUnit?: string }[];

  const unitBySgId: Record<string, string> = {};
  supplierGoods.forEach((sg: { _id: Types.ObjectId; measurementUnit?: string }) => {
    unitBySgId[sg._id.toString()] = sg.measurementUnit ?? "";
  });

  const result: ActualUsageItem[] = [];
  for (const sgIdStr of allSupplierGoodIds) {
    const opening = openingMap.get(sgIdStr) ?? 0;
    const closing = closingMap.get(sgIdStr) ?? 0;
    const purchased = purchasesMap.get(sgIdStr) ?? 0;
    const actualUsage = opening + purchased - closing;
    const measurementUnit = unitBySgId[sgIdStr] ?? "";
    result.push({
      supplierGoodId: new Types.ObjectId(sgIdStr),
      quantity: actualUsage,
      measurementUnit,
    });
  }
  return result;
}
