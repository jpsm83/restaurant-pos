import connectDb from "@/app/lib/utils/connectDb";

// Import all your models
import Business from "@/app/lib/models/business";
import BusinessGood from "@/app/lib/models/businessGood";
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";
import Employee from "@/app/lib/models/employee";
import Purchase from "@/app/lib/models/purchase";

// Create a mapping between model names and actual models
const modelMap: { [key: string]: any } = {
  Business,
  BusinessGood,
  Purchase,
  Supplier,
  SupplierGood,
  Employee,
};

const updateDbModels = async (
  modelName: string,
  id: FormDataEntryValue | null,
  uploadUrl: string | null = null
) => {
  try {
    // check required fields
    if (!modelName || !id) {
      return "Model name and ID are required!";
    }

    // Retrieve the actual model based on the string input
    const model = modelMap[modelName];

    // connect before first call to DB
    await connectDb();

    // update the model with the imageUrl
    if (!uploadUrl) {
      await model.findByIdAndUpdate(
        id,
        { $unset: { imageUrl: "" } },
        { new: true }
      );
    } else {
      await model.findByIdAndUpdate(id, { imageUrl: uploadUrl }, { new: true });
    }
  } catch (error) {
    return error;
  }
};

export default updateDbModels;
