import { Types } from "mongoose";
import Inventory from "../models/inventory.js";
import SupplierGood from "../models/supplierGood.js";
import Supplier from "../models/supplier.js";
import Employee from "../models/employee.js";
import Notification from "../models/notification.js";
import { MANAGEMENT_ROLES } from "../utils/constants.js";

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
    // Fire-and-forget: do not throw
  }
}
