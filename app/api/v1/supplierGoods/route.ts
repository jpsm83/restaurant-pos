import { NextResponse } from "next/server";
import connectDb from "@/lib/db/connectDb";
import mongoose from "mongoose";

// import utils
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";
import addSupplierGoodToInventory from "../inventories/utils/addSupplierGoodToInventory";

// imported interfaces
import { ISupplierGood } from "@/lib/interface/ISupplierGood";

// import models
import SupplierGood from "@/lib/db/models/supplierGood";
import Supplier from "@/lib/db/models/supplier";

// import enums
import { allergensEnums, mainCategoriesEnums } from "@/lib/enums";

// @desc    Get all supplier goods
// @route   GET /supplierGoods
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const supplierGoods = await SupplierGood.find()
      .populate({ path: "supplierId", select: "tradeName", model: Supplier })
      .lean();

    return !supplierGoods.length
      ? new NextResponse(
          JSON.stringify({ message: "No supplier goods found!!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(supplierGoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all supplier goods failed!", error as string);
  }
};

// @desc    Create new supplier good
// @route   POST /supplierGoods
// @access  Private
export const POST = async (req: Request) => {
  try {
    // Parse FORM DATA instead of JSON because we might have an image file
    const formData = await req.formData();

    // Extract required fields
    const name = formData.get("name") as string;
    const keyword = formData.get("keyword") as string;
    const mainCategory = formData.get("mainCategory") as string;
    const supplierId = formData.get("supplierId") as string;
    const businessId = formData.get("businessId") as string;

    // Extract optional fields
    const subCategory = formData.get("subCategory") as string | undefined;
    const description = formData.get("description") as string | undefined;
    const allergens = formData.get("allergens")
      ? (JSON.parse(formData.get("allergens") as string) as string[])
      : [];
    const budgetImpact = formData.get("budgetImpact") as string | undefined;
    const inventorySchedule = formData.get("inventorySchedule") as
      | string
      | undefined;
    const minimumQuantityRequired = Number(
      formData.get("minimumQuantityRequired")
    ) as number | undefined;
    const parLevel = Number(formData.get("parLevel")) as number | undefined;
    const purchaseUnit = formData.get("purchaseUnit") as string | undefined;
    const measurementUnit = formData.get("measurementUnit") as
      | string
      | undefined;
    const quantityInMeasurementUnit = Number(
      formData.get("quantityInMeasurementUnit")
    ) as number | undefined;
    const totalPurchasePrice = Number(formData.get("totalPurchasePrice")) as
      | number
      | undefined;

    const files = formData
      .getAll("imagesUrl")
      .filter((entry): entry is File => entry instanceof File); // Get all files

    // check required fields
    if (!name || !keyword || !mainCategory || !supplierId || !businessId) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Name, keyword, mainCategory, supplierId and businessId are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate ids
    if (isObjectIdValid([businessId, supplierId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Business or supplier ID is not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // max file quantity is 3
    if (files && files.length > 3) {
      return new NextResponse(
        JSON.stringify({ message: "Max file quantity is 3!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if main category is valid
    if (!mainCategoriesEnums.includes(mainCategory)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid main category!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if allergens are valid
    if (allergens.length > 0) {
      for (const allergen of allergens) {
        if (!allergensEnums.includes(allergen)) {
          return new NextResponse(
            JSON.stringify({ message: "Invalid allergen!" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // connect before first call to DB
    await connectDb();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // check if the supplier good already exists
      const duplicateSupplierGood = await SupplierGood.exists({
        businessId,
        supplierId,
        name,
      });

      if (duplicateSupplierGood) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message: `${name} already exists on supplier goods!`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const supplierGoodId = new mongoose.Types.ObjectId();

      // Create a supplier good object with required fields
      const newSupplierGoodObj: ISupplierGood = {
        _id: supplierGoodId,
        name,
        keyword,
        mainCategory,
        currentlyInUse: true,
        supplierId,
        businessId,
        subCategory: subCategory || undefined,
        description: description || undefined,
        allergens: allergens || undefined,
        budgetImpact: budgetImpact || undefined,
        inventorySchedule: inventorySchedule || undefined,
        minimumQuantityRequired: minimumQuantityRequired || undefined,
        parLevel: parLevel || undefined,
        purchaseUnit: purchaseUnit || undefined,
        measurementUnit: measurementUnit || undefined,
        quantityInMeasurementUnit: quantityInMeasurementUnit || undefined,
        totalPurchasePrice: totalPurchasePrice || undefined,
        // Calculate price per unit only if both price and quantity are provided
        pricePerMeasurementUnit:
          totalPurchasePrice && quantityInMeasurementUnit
            ? totalPurchasePrice / quantityInMeasurementUnit
            : undefined,
      };

      // upload image
      if (
        files?.every((file) => file instanceof File && file.size > 0) &&
        files.length > 0
      ) {
        const folder = `/business/${businessId}/suppliersGoods/${supplierGoodId}`;

        const cloudinaryUploadResponse = await uploadFilesCloudinary({
          folder,
          filesArr: files,
          onlyImages: true,
        });

        if (
          typeof cloudinaryUploadResponse === "string" ||
          cloudinaryUploadResponse.length === 0 ||
          !cloudinaryUploadResponse.every((str) => str.includes("https://"))
        ) {
          await session.abortTransaction();
          return new NextResponse(
            JSON.stringify({
              message: `Error uploading image: ${cloudinaryUploadResponse}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        newSupplierGoodObj.imagesUrl = cloudinaryUploadResponse;
      }

      // create a new supplier good
      // WHEN USING SESSION TO CREATE, YOU MUST PASS AN ARRAY OF OBJECTS
      const [newSupplierGood] = await SupplierGood.create(
        [newSupplierGoodObj],
        {
          session,
        }
      );

      if (!newSupplierGood) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message: "Supplier good creation failed!",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // *** IMPORTANT ***
      // when supplier good is created and it is currently in use, it will be added to the inventory
      const addSupplierGoodToInventoryResult = await addSupplierGoodToInventory(
        supplierGoodId,
        businessId,
        session
      );

      if (addSupplierGoodToInventoryResult !== true) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message:
              "Add supplier good to inventory failed! Error: " +
              addSupplierGoodToInventoryResult,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      await session.commitTransaction();

      // confirm supplier good was created
      return new NextResponse(
        JSON.stringify({
          message: `Supplier good created successfully!`,
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      await session.abortTransaction();
      return handleApiError("Create supplier good failed!", error as string);
    } finally {
      session.endSession();
    }
  } catch (error) {
    return handleApiError("Create supplier good failed!", error as string);
  }
};
