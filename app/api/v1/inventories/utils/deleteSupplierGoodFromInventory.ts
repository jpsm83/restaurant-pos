import { Types, ClientSession } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported models
import Inventory from "@/lib/db/models/inventory";

// if a supplierGood is removed from the system, it will be removed from the inventoryGoods array of the inventory
// for separation of concerns, this function will be created in the inventory utils to be used on the supplierGood route
const deleteSupplierGoodFromInventory = async (
  supplierGoodId: Types.ObjectId | string,
  businessId: Types.ObjectId | string,
  session: ClientSession
) => {
  try {
    // validate supplierGoodId and businessId
    if (!isObjectIdValid([supplierGoodId.toString(), businessId.toString()])) {
      return "Invalid supplierGoodId or businessId";
    }

    // connect before first call to DB
    await connectDb();

    // update the inventory by removing the supplierGood
    const updateInventory = await Inventory.findOneAndUpdate(
      {
        businessId: businessId,
        setFinalCount: false,
      },
      {
        $pull: {
          inventoryGoods: {
            supplierGoodId: supplierGoodId,
          },
        },
      },
      { new: true, lean: true, session }
    );

    if (!updateInventory) {
      await session.abortTransaction();
      return "No inventory found";
    }

    return true;
  } catch (error) {
    return "Something went wrong with deleteSupplierGoodFromInventory: " + error;
  }
};

export default deleteSupplierGoodFromInventory;
