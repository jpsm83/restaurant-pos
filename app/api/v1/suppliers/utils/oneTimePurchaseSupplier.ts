import connectDb from "@/app/lib/utils/connectDb";

// import models
import Supplier from "@/app/lib/models/supplier";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { Types } from "mongoose";

// this function will create a supplier for one time purchase to be used as default supplier
const oneTimePurchaseSupplier = async (businessId: Types.ObjectId) => {
  try {
    // check required fields
    if (!isObjectIdValid([businessId])) {
      return "BusinessId not valid!";
    }

    // connect before first call to DB
    await connectDb();

    // check for duplicate legalName, email or taxNumber
    const supplier = await Supplier.findOne({
      businessId: businessId,
      tradeName: "One Time Purchase",
    });

    if (supplier) {
      return supplier._id;
    }

    // create default supplier id
    const defaultSupplierId = new Types.ObjectId();

    // create supplier object with required fields
    const newSupplierObj = {
      _id: defaultSupplierId,
      tradeName: "One Time Purchase",
      legalName: "One Time Purchase",
      phoneNumber: "One Time Purchase",
      taxNumber: "One Time Purchase",
      currentlyInUse: true,
      businessId: businessId,
    };

    // create new supplier
    const newSupplier = await Supplier.create(newSupplierObj);

    // return supplier id
    return newSupplier._id;
  } catch (error) {
    return "Create one time purchase supplier failed! " + error;
  }
};

export default oneTimePurchaseSupplier;
