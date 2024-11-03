import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Inventory from "@/app/lib/models/inventory";

// if a new supplierGood is added to the system, it will be added to the inventoryGoods array of the inventory
// for separation of concerns, this function will be created in the inventory utils to be used on the supplierGood route
const addSupplierGoodToInventory = async (
  supplierGoodId: Types.ObjectId,
  businessId: Types.ObjectId
) => {
  try {
    // validate supplierGoodId and businessId
    if (!isObjectIdValid([supplierGoodId, businessId])) {
      return "Invalid supplierGoodId or businessId";
    }

    // connect before first call to DB
    await connectDb();

    // update the inventory with the new supplierGood
    const updateInventory = await Inventory.updateOne(
      {
        businessId: businessId,
        setFinalCount: false,
      },
      {
        $push: {
          inventoryGoods: {
            supplierGoodId: supplierGoodId,
            monthlyCounts: [],
            dynamicSystemCount: 0,
          },
        },
      }
    ).lean();

    if (!updateInventory) {
      return "No inventory found";
    }

    return true;
  } catch (error) {
    return "Something went wrong with addSupplierGoodToInventory: " + error;
  }
};

export default addSupplierGoodToInventory;
