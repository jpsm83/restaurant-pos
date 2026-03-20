import mongoose, { Types } from "mongoose";
import Supplier from "../models/supplier.ts";
import isObjectIdValid from "../utils/isObjectIdValid.ts";

const oneTimePurchaseSupplier = async (
  businessId: Types.ObjectId | string,
): Promise<Types.ObjectId | string> => {
  try {
    if (!isObjectIdValid([businessId])) {
      return "BusinessId not valid!";
    }

    const supplier = await Supplier.findOne({
      businessId,
      tradeName: "One Time Purchase",
    });

    if (supplier) {
      return supplier._id as Types.ObjectId;
    }

    const defaultSupplierId = new mongoose.Types.ObjectId();

    const newSupplierObj = {
      _id: defaultSupplierId,
      tradeName: "One Time Purchase",
      legalName: "One Time Purchase",
      phoneNumber: "One Time Purchase",
      taxNumber: "One Time Purchase",
      currentlyInUse: true,
      businessId,
      address: {
        country: "One Time Purchase",
        state: "One Time Purchase",
        city: "One Time Purchase",
        street: "One Time Purchase",
        buildingNumber: "One Time Purchase",
        postCode: "One Time Purchase",
      },
    };

    const newSupplier = await Supplier.create(newSupplierObj);

    return newSupplier._id as Types.ObjectId;
  } catch (error) {
    return "Create one time purchase supplier failed! " + error;
  }
};

export default oneTimePurchaseSupplier;
