import connectDb from "@/lib/db/connectDb";

// imported models
import Business from "@/lib/db/models/business";
import Supplier from "@/lib/db/models/supplier";
import Employee from "@/lib/db/models/employee";
import BusinessGood from "@/lib/db/models/businessGood";
import SupplierGood from "@/lib/db/models/supplierGood";
import Purchase from "@/lib/db/models/purchase";
import User from "@/lib/db/models/user";

// Create a mapping between model names and actual models
const modelMap: {
  [key: string]:
    | typeof Business
    | typeof BusinessGood
    | typeof SupplierGood
    | typeof Supplier
    | typeof Employee
    | typeof Purchase
    | typeof User;
} = {
  Business,
  BusinessGood,
  Purchase,
  Supplier,
  SupplierGood,
  Employee,
  User,
};

const updateDbModels = async (
  modelName: string,
  id: string,
  uploadUrl: string[]
) => {
  try {
    // check required fields
    if (!modelName || !id || !uploadUrl) {
      return "Model name and ID are required!";
    }

    const singleImageModels = ["Business", "Purchase", "Supplier", "User"];

    const model = modelMap[modelName];

    const imageOrDocument =
      modelName === "User"
        ? "personalDetails.documentsUrl"
        : modelName === "Employee"
        ? "documentsUrl"
        : "imageUrl";

    // connect before first call to DB
    await connectDb();

    if (singleImageModels.includes(modelName)) {
      // If the model requires a single image, update with the first URL in the uploadUrl array
      await model.findByIdAndUpdate(
        id,
        { [imageOrDocument]: uploadUrl[0] }, // Use the first URL
        { new: true }
      );
    } else {
      // For multiple images, use the $push operator to add the new URLs to the existing array
      await model.findByIdAndUpdate(
        id,
        { $push: { [imageOrDocument]: { $each: uploadUrl } } }, // Push all URLs to the array
        { new: true }
      );
    }
  } catch (error) {
    return error;
  }
};

export default updateDbModels;
