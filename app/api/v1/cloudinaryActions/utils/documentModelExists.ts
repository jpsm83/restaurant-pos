import connectDb from "@/lib/db/connectDb";

import Business from "@/lib/db/models/business";
import BusinessGood from "@/lib/db/models/businessGood";
import Employee from "@/lib/db/models/employee";
import Purchase from "@/lib/db/models/purchase";
import SupplierGood from "@/lib/db/models/supplierGood";
import Supplier from "@/lib/db/models/supplier";
// import User from "@/app/lib/models/user";

interface IDocumentModel {
  restaurantSubfolder: string | null;
  name: string | null;
  id: string | null;
};

const documentModelExists = async (
  businessId: FormDataEntryValue | null,
  businessGoodId: FormDataEntryValue | null,
  employeeId: FormDataEntryValue | null,
  purchaseId: FormDataEntryValue | null,
  supplierGoodId: FormDataEntryValue | null,
  supplierId: FormDataEntryValue | null,
  // userId: FormDataEntryValue | null
) => {
  // Create a mapping between model names and actual models
  const modelMap: {
    [key: string]:
      | typeof Business
      | typeof BusinessGood
      | typeof Employee
      | typeof Purchase
      | typeof SupplierGood
      | typeof Supplier
      // | typeof User
  } = {
    Business,
    BusinessGood,
    Employee,
    Purchase,
    SupplierGood,
    Supplier,
    // User,
  };

  const documentModel: IDocumentModel = {
    restaurantSubfolder: null,
    name: "Business",
    id: typeof businessId === "string" ? businessId : null,
  };

  if (businessGoodId) {
    documentModel.restaurantSubfolder = "businessGoods";
    documentModel.name = "BusinessGood";
    documentModel.id = businessGoodId as string;
  }

  if (employeeId) {
    documentModel.restaurantSubfolder = "employees";
    documentModel.name = "Employee";
    documentModel.id = employeeId as string;
  }

  if (purchaseId) {
    documentModel.restaurantSubfolder = "purchases";
    documentModel.name = "Purchase";
    documentModel.id = purchaseId as string;
  }

  if (supplierGoodId) {
    documentModel.restaurantSubfolder = "supplierGoods";
    documentModel.name = "SupplierGood";
    documentModel.id = supplierGoodId as string;
  }

  if (supplierId) {
    documentModel.restaurantSubfolder = "suppliers";
    documentModel.name = "Supplier";
    documentModel.id = supplierId as string;
  }


  // Retrieve the actual model based on the string input
  const model = modelMap[documentModel.name as string];

  if(documentModel.name === "") {
    return "Document model is required!";
  }

  // connect before first call to DB
  await connectDb();

  // check if the document with id exists
  const documentExists = await model.findById(documentModel.id).lean();

  if (documentExists) {
    return documentModel;
  } else {
    return "Document model does not exists!";
  }
};

export default documentModelExists;
