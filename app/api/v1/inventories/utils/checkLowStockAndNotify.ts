import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import Inventory from "@/lib/db/models/inventory";

interface InventoryGoodPopulated {
  supplierGoodId: { _id: Types.ObjectId; name?: string; parLevel?: number; minimumQuantityRequired?: number };
  dynamicSystemCount?: number;
}
interface InventoryWithGoods {
  inventoryGoods?: InventoryGoodPopulated[];
}
import SupplierGood from "@/lib/db/models/supplierGood";
import Supplier from "@/lib/db/models/supplier";
import Employee from "@/lib/db/models/employee";
import Notification from "@/lib/db/models/notification";
import { MANAGEMENT_ROLES } from "@/lib/constants";

/**
 * Checks open inventory for items below par/minimum, and creates one Warning
 * notification for manager-level employees on duty. Call after order creation
 * or stock-reducing edits (no session; fire-and-forget).
 */
export async function checkLowStockAndNotify(
  businessId: Types.ObjectId
): Promise<void> {
  try {
    await connectDb();

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

    const managerEmployees = await Employee.find({
      businessId,
      onDuty: true,
      currentShiftRole: { $in: MANAGEMENT_ROLES },
    })
      .select("_id")
      .lean();

    if (!managerEmployees?.length) return;

    const message =
      "Low stock: " +
      lowStockItems
        .map((ig: InventoryGoodPopulated) => {
          const sg = ig.supplierGoodId as { name?: string; parLevel?: number; minimumQuantityRequired?: number };
          const name = sg?.name ?? "Item";
          const count = ig.dynamicSystemCount ?? 0;
          const par = sg?.parLevel ?? sg?.minimumQuantityRequired ?? "?";
          return `${name} (${count}/${par})`;
        })
        .join(", ");

    const [newNotification] = await Notification.create([
      {
        notificationType: "Warning",
        message,
        employeesRecipientsIds: managerEmployees.map((e) => e._id),
        businessId,
      },
    ]);

    if (newNotification) {
      await Employee.updateMany(
        { _id: { $in: managerEmployees.map((e) => e._id) } },
        {
          $push: {
            notifications: {
              notificationId: newNotification._id,
            },
          },
        }
      );
    }
  } catch {
    // Fire-and-forget: do not throw; avoid breaking order or purchase flows.
  }
}
