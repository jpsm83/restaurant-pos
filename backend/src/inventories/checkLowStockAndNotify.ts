import { Types } from "mongoose";
import Inventory from "../models/inventory.ts";
import SupplierGood from "../models/supplierGood.ts";
import Supplier from "../models/supplier.ts";
import dispatchEvent from "../communications/dispatchEvent.ts";

interface InventoryGoodPopulated {
  supplierGoodId: { _id: Types.ObjectId; name?: string; parLevel?: number; minimumQuantityRequired?: number };
  dynamicSystemCount?: number;
}

interface InventoryWithGoods {
  inventoryGoods?: InventoryGoodPopulated[];
}

const LOW_STOCK_ALERT_COOLDOWN_MS =
  Number(process.env.LOW_STOCK_ALERT_COOLDOWN_MS) || 15 * 60 * 1000;
const LOW_STOCK_ALERT_DISPATCH_IDEMPOTENCY_WINDOW_MS =
  Number(process.env.LOW_STOCK_ALERT_DISPATCH_IDEMPOTENCY_WINDOW_MS) ||
  LOW_STOCK_ALERT_COOLDOWN_MS;

const lastLowStockAlertByBusinessAndItems = new Map<string, number>();

const buildLowStockDedupKey = (
  businessId: Types.ObjectId,
  supplierGoodIds: Types.ObjectId[]
): string => {
  const sortedIds = supplierGoodIds
    .map((id) => id.toString())
    .sort((a, b) => a.localeCompare(b));
  return `${businessId.toString()}::${sortedIds.join(",")}`;
};

const normalizeCooldownMs = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 15 * 60 * 1000;

const getCooldownMs = (): number => normalizeCooldownMs(LOW_STOCK_ALERT_COOLDOWN_MS);

const shouldSendLowStockAlert = (
  businessId: Types.ObjectId,
  supplierGoodIds: Types.ObjectId[]
): boolean => {
  const now = Date.now();
  const dedupKey = buildLowStockDedupKey(businessId, supplierGoodIds);
  const lastSentAt = lastLowStockAlertByBusinessAndItems.get(dedupKey);
  const cooldownMs = getCooldownMs();

  if (lastSentAt && now - lastSentAt < cooldownMs) {
    return false;
  }

  lastLowStockAlertByBusinessAndItems.set(dedupKey, now);
  return true;
};

const checkLowStockAndNotify = async (
  businessId: Types.ObjectId
): Promise<void> => {
  try {
    const inventory = await Inventory.findOne({
      businessId,
      setFinalCount: false,
    })
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory measurementUnit parLevel minimumQuantityRequired",
        model: SupplierGood,
        populate: {
          path: "supplierId",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean() as InventoryWithGoods | null;

    if (!inventory?.inventoryGoods?.length) return;

    const lowStockItems = inventory.inventoryGoods.filter((ig: InventoryGoodPopulated) => {
      const sg = ig.supplierGoodId as { parLevel?: number; minimumQuantityRequired?: number };
      if (!sg) return false;
      const par = sg.parLevel ?? sg.minimumQuantityRequired;
      const min = sg.minimumQuantityRequired ?? sg.parLevel;
      const count = ig.dynamicSystemCount ?? 0;
      if (par != null && count < par) return true;
      if (min != null && count < min) return true;
      return false;
    });

    if (lowStockItems.length === 0) return;

    const lowStockSupplierGoodIds = lowStockItems.map(
      (item) => item.supplierGoodId._id
    );
    if (!shouldSendLowStockAlert(businessId, lowStockSupplierGoodIds)) return;

    await dispatchEvent(
      "LOW_STOCK_ALERT",
      {
        businessId,
        lowStockItems: lowStockItems.map((ig: InventoryGoodPopulated) => {
          const sg = ig.supplierGoodId as {
            _id: Types.ObjectId;
            name?: string;
            parLevel?: number;
            minimumQuantityRequired?: number;
          };
          const threshold = sg?.parLevel ?? sg?.minimumQuantityRequired ?? 0;
          return {
            supplierGoodId: sg._id,
            name: sg?.name ?? "Item",
            currentCount: ig.dynamicSystemCount ?? 0,
            threshold: Number(threshold),
          };
        }),
      },
      {
        fireAndForget: true,
        idempotencyKey: buildLowStockDedupKey(businessId, lowStockSupplierGoodIds),
        idempotencyWindowMs: normalizeCooldownMs(
          LOW_STOCK_ALERT_DISPATCH_IDEMPOTENCY_WINDOW_MS
        ),
      }
    );
  } catch {
    // Fire-and-forget: do not throw
  }
}

export default checkLowStockAndNotify;