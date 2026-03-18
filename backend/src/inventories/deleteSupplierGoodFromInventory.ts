import { Types, ClientSession } from "mongoose";
import { isObjectIdValid } from "../utils/isObjectIdValid.js";
import Inventory from "../models/inventory.js";

export const deleteSupplierGoodFromInventory = async (
  supplierGoodId: Types.ObjectId | string,
  businessId: Types.ObjectId | string,
  session: ClientSession
) => {
  try {
    if (!isObjectIdValid([supplierGoodId.toString(), businessId.toString()])) {
      return "Invalid supplierGoodId or businessId";
    }

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
      return "No inventory found";
    }

    return true;
  } catch (error) {
    return "Something went wrong with deleteSupplierGoodFromInventory: " + error;
  }
};
