import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import updateDbModels from "./utils/updateDbModels";
import deleteCloudinaryImage from "./utils/deleteCloudinaryImage";
import documentModelExists from "./utils/documentModelExists";

// Cloudinary ENV variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const imageFile = data.get("imageFile");
    
    // those are ids required for individaul models for the image
    const businessId = data.get("businessId");
    const businessGoodId = data.get("businessGoodId") || null; // subfolder = "businessGoods"
    const employeeId = data.get("employeeId") || null; // subfolder = "employees"
    const purchaseId = data.get("purchaseId") || null; // subfolder = "purchases"
    const supplierGoodId = data.get("supplierGoodId") || null; // subfolder = "supplierGoods"
    const supplierId = data.get("supplierId") || null; // subfolder = "suppliers"
    const userId = data.get("userId") || null; // subfolder = "users"

    // documentModelResult returns the following object or error message
    // const documentModel = {
    //   restaurantSubfolder: "",
    //   name: "Business",
    //   id: businessId,
    // };
    const documentModelResult = await documentModelExists(
      businessId,
      businessGoodId,
      employeeId,
      purchaseId,
      supplierGoodId,
      supplierId,
      userId,
    );

    // if documentModelResult is a string, it means an error occurred
    if (typeof documentModelResult === "string") {
      return new NextResponse(
        JSON.stringify({ message: documentModelResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!imageFile || !businessId || !(imageFile instanceof File)) {
      return new NextResponse(
        JSON.stringify({ message: "Image file and business ID are required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const folder =
    documentModelResult.restaurantSubfolder.length > 0
      ? `restaurant-pos/${businessId}/${documentModelResult.restaurantSubfolder}`
      : `restaurant-pos/${businessId}`;

      // to which project in Cloudinary
      const uploadPreset = "restaurant-pos"; // Use your Cloudinary preset

    // Prepare the data for Cloudinary upload  
    const bytes = await imageFile.arrayBuffer();
    const mime = imageFile.type;
    const encoding = "base64";
    const base64Data = Buffer.from(bytes).toString("base64");
    const fileUri = `data:${mime};${encoding},${base64Data}`;

    const response = await cloudinary.uploader.upload(fileUri, {
      invalidate: true,
      upload_preset: uploadPreset,
      // businessId is used as a folder name
      folder: folder, // Optional: specify a folder in Cloudinary
    });

    const updateModelResponse = await updateDbModels(
      documentModelResult.name,
      documentModelResult.id,
      response.secure_url
    );

    if (updateModelResponse) {
      const deleteResponse = await deleteCloudinaryImage(response.secure_url);

      if (deleteResponse) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Error occurred on deleteCloudinaryImage: " + deleteResponse,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      return new NextResponse(
        JSON.stringify({
          message:
            "Error occurred on updateDocumentModels: " + updateModelResponse,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "Image upload and url reference saved" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        message: "An error occurred while uploading images." + error,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    // example of a cloudinary image url
    // "https://console.cloudinary.com/pm/c-9e91323343059685f5636d90d4b413/media-explorer/restaurant-pos/66cad982bb87c1faf53fb031/salesInstanceQrCodes/66c9d6afc45a1547f9ab893b.png"
    const {
      imageUrl,
      businessId,
      businessGoodId,
      employeeId,
      purchaseId,
      supplierGoodId,
      supplierId,
      userId,
    } = await req.json();

    if (!imageUrl) {
      return new NextResponse(
        JSON.stringify({
          message: "Image url is required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const documentModelResult = await documentModelExists(
      businessId,
      businessGoodId,
      employeeId,
      purchaseId,
      supplierGoodId,
      supplierId,
      userId,
    );

    if (typeof documentModelResult === "string") {
      return new NextResponse(
        JSON.stringify({ message: documentModelResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Delete the image from Cloudinary
    const deleteResponse = await deleteCloudinaryImage(imageUrl);

    if (deleteResponse) {
      return new NextResponse(
        JSON.stringify({
          message: "Error occurred on deleteCloudinaryImage: " + deleteResponse,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const updateModelResponse = await updateDbModels(
      documentModelResult.name,
      documentModelResult.id
    );

    if (updateModelResponse) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Error occurred on updateDocumentModels: " + updateModelResponse,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Image deleted successfully.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Error occurred while deleting the image(s).", error as string);
  }
}

























import connectDb from "@/app/lib/utils/connectDb";

import Business from "@/app/lib/models/business";
import BusinessGood from "@/app/lib/models/businessGood";
import Employee from "@/app/lib/models/employee";
import Purchase from "@/app/lib/models/purchase";
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";
import User from "@/app/lib/models/user";

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
  userId: FormDataEntryValue | null
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
      | typeof User;
  } = {
    Business,
    BusinessGood,
    SupplierGood,
    Supplier,
    Employee,
    User,
    Purchase,
  };

  const documentModel: IDocumentModel = {
    restaurantSubfolder: "",
    name: "",
    id: "",
  };

  if (businessId) {
    documentModel.restaurantSubfolder = "business";
    documentModel.name = "Business";
    documentModel.id = businessId as string;
  }

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

  if (userId) {
    documentModel.restaurantSubfolder = "users";
    documentModel.name = "User";
    documentModel.id = userId as string;
  }
  
  if(!documentModel.name){
    return "Document model is required!";
  }

  // Retrieve the actual model based on the string input
  const model = modelMap[documentModel.name as string];

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
