import { Types, ClientSession } from "mongoose";
import Inventory from "../models/inventory.ts";

const addSupplierGoodToInventory = async (
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
        $push: {
          inventoryGoods: {
            supplierGoodId: supplierGoodId,
            monthlyCounts: [],
            dynamicSystemCount: 0,
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
    return "Something went wrong with addSupplierGoodToInventory: " + error;
  }
};

export default addSupplierGoodToInventory;