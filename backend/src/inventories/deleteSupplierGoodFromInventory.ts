import { Types, ClientSession } from "mongoose";
import Inventory from "../models/inventory.ts";

const deleteSupplierGoodFromInventory = async (
  supplierGoodId: Types.ObjectId | string,
  businessId: Types.ObjectId | string,
  session: ClientSession
) => {
  try {
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
      { returnDocument: 'after', lean: true, session }
    );

    if (!updateInventory) {
      return "No inventory found";
    }

    return true;
  } catch (error) {
    return "Something went wrong with deleteSupplierGoodFromInventory: " + error;
  }
};

export default deleteSupplierGoodFromInventory;