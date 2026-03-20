import { Types } from "mongoose";
import Inventory from "../models/inventory.ts";
import SupplierGood from "../models/supplierGood.ts";
import Supplier from "../models/supplier.ts";
import Employee from "../models/employee.ts";
import User from "../models/user.ts";
import Notification from "../models/notification.ts";
import { MANAGEMENT_ROLES } from "../utils/constants.ts";

interface InventoryGoodPopulated {
  supplierGoodId: { _id: Types.ObjectId; name?: string; parLevel?: number; minimumQuantityRequired?: number };
  dynamicSystemCount?: number;
}

interface InventoryWithGoods {
  inventoryGoods?: InventoryGoodPopulated[];
}

export async function checkLowStockAndNotify(
  businessId: Types.ObjectId
): Promise<void> {
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

    const managerEmployees = await Employee.find({
      businessId,
      onDuty: true,
      currentShiftRole: { $in: MANAGEMENT_ROLES },
    })
      .select("_id userId")
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
      const managerUserIds = managerEmployees.map((e) => e.userId).filter(Boolean);

      await User.updateMany(
        { _id: { $in: managerUserIds } },
        {
          $push: {
            notifications: {
              notificationId: newNotification._id,
              // readFlag/deletedFlag default to false in the User schema
            },
          },
        }
      );
    }
  } catch {
    // Fire-and-forget: do not throw
  }
}
