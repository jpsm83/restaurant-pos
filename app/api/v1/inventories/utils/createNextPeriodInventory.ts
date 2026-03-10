import { ClientSession, Types } from "mongoose";

import { IInventory } from "@/lib/interface/IInventory";
import Inventory from "@/lib/db/models/inventory";
import SupplierGood from "@/lib/db/models/supplierGood";

/**
 * Creates the next period's inventory from a just-closed inventory.
 * Used when manager closes current inventory so the business always has one open.
 * Builds inventoryGoods from closed inventory (last count or dynamicSystemCount per good)
 * and ensures all currentlyInUse supplier goods are included.
 */
export const createNextPeriodInventory = async (
  businessId: Types.ObjectId,
  closedInventory: IInventory,
  session: ClientSession
) => {
  const supplierGoods = (await SupplierGood.find({
    businessId,
    currentlyInUse: true,
  })
    .select("_id")
    .session(session)
    .lean()) as { _id: Types.ObjectId }[];

  const inventoryGoodsArr = supplierGoods.map((sg) => {
    const prev = closedInventory.inventoryGoods?.find(
      (g) => g.supplierGoodId.toString() === sg._id.toString()
    );
    let dynamicSystemCount = 0;
    if (prev) {
      if (prev.monthlyCounts && prev.monthlyCounts.length > 0) {
        const lastCount = [...prev.monthlyCounts].sort(
          (a, b) =>
            new Date(b.countedDate ?? 0).getTime() -
            new Date(a.countedDate ?? 0).getTime()
        )[0];
        dynamicSystemCount = lastCount?.currentCountQuantity ?? prev.dynamicSystemCount ?? 0;
      } else {
        dynamicSystemCount = prev.dynamicSystemCount ?? 0;
      }
    }
    return {
      supplierGoodId: sg._id,
      monthlyCounts: [],
      dynamicSystemCount,
    };
  });

  const newInventory: IInventory = {
    businessId,
    setFinalCount: false,
    inventoryGoods: inventoryGoodsArr,
  };

  const created = await Inventory.create([newInventory], { session });
  return created[0];
};
