import { NextResponse } from "next/server";
import connectDb from "@/lib/db/connectDb";
import mongoose, { Types } from "mongoose";
import moment from "moment";

// imported utils
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import addSupplierGoodToInventory from "../../inventories/utils/addSupplierGoodToInventory";

// imported interfaces
import { ISupplierGood } from "@shared/interfaces/ISupplierGood";

// imported models
import SupplierGood from "@/lib/db/models/supplierGood";
import BusinessGood from "@/lib/db/models/businessGood";
import Supplier from "@/lib/db/models/supplier";
import Inventory from "@/lib/db/models/inventory";

// import enums
import { allergensEnums, mainCategoriesEnums } from "@/lib/enums";
import uploadFilesCloudinary from "@/lib/cloudinary/uploadFilesCloudinary";
import deleteFolderCloudinary from "@/lib/cloudinary/deleteFolderCloudinary";
import deleteSupplierGoodFromInventory from "../../inventories/utils/deleteSupplierGoodFromInventory";

// @desc    Get supplier good by ID
// @route   GET /supplierGoods/:supplierGoodId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { supplierGoodId: Types.ObjectId } }
) => {
  try {
    const supplierGoodId = context.params.supplierGoodId;

    // check if the supplier good is valid
    if (isObjectIdValid([supplierGoodId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierGoodId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    const supplierGood = await SupplierGood.findById(supplierGoodId)
      .populate({ path: "supplierId", select: "tradeName", model: Supplier })
      .lean();

    return !supplierGood
      ? new NextResponse(
          JSON.stringify({ message: "Supplier good not found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(supplierGood), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError(
      "Get supplier good by its id failed!",
      error as string
    );
  }
};

// @desc    Update supplier good by ID
// @route   PATCH /supplierGoods/:supplierGoodId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { supplierGoodId: Types.ObjectId } }
) => {
  try {
    const { supplierGoodId } = context.params;

    // check if supplierGoodId is valid
    if (isObjectIdValid([supplierGoodId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierGoodId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse FORM DATA instead of JSON because we might have an image file
    const formData = await req.formData();

    // Extract required fields
    const name = formData.get("name") as string;
    const keyword = formData.get("keyword") as string;
    const mainCategory = formData.get("mainCategory") as string;
    const currentlyInUse = formData.get("currentlyInUse") === "true";

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
    if (!name || !keyword || !mainCategory) {
      return new NextResponse(
        JSON.stringify({
          message: "Name, keyword and mainCategory are required!",
        }),
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
      // check if the supplier good exists
      const supplierGood = (await SupplierGood.findById(
        supplierGoodId
      ).lean()) as unknown as ISupplierGood | null;

      if (!supplierGood) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Supplier good not found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // max file quantity is 3
      if (files && files.length + (supplierGood?.imagesUrl?.length || 0) > 3) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Max file quantity is 3!" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // check for duplicates supplier good name
      const duplicateSupplierGood = await SupplierGood.exists({
        _id: { $ne: supplierGoodId },
        businessId: supplierGood.businessId,
        supplierId: supplierGood.supplierId,
        name,
      });

      if (duplicateSupplierGood) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message: `Supplier good ${name} already exists on this supplier!`,
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      // create a new supplier good object
      const updateSupplierGood: Partial<ISupplierGood> = {};

      if (name && name !== supplierGood.name) updateSupplierGood.name = name;
      if (keyword && keyword !== supplierGood.keyword)
        updateSupplierGood.keyword = keyword;
      if (mainCategory && mainCategory !== supplierGood.mainCategory)
        updateSupplierGood.mainCategory = mainCategory;
      if (currentlyInUse && currentlyInUse !== supplierGood.currentlyInUse)
        updateSupplierGood.currentlyInUse = currentlyInUse;

      if (subCategory && subCategory !== supplierGood.subCategory)
        updateSupplierGood.subCategory = subCategory;
      if (description && description !== supplierGood.description)
        updateSupplierGood.description = description;
      if (allergens && allergens !== supplierGood.allergens)
        updateSupplierGood.allergens = allergens;
      if (budgetImpact && budgetImpact !== supplierGood.budgetImpact)
        updateSupplierGood.budgetImpact = budgetImpact;
      if (
        inventorySchedule &&
        inventorySchedule !== supplierGood.inventorySchedule
      )
        updateSupplierGood.inventorySchedule = inventorySchedule;
      if (
        minimumQuantityRequired &&
        minimumQuantityRequired !== supplierGood.minimumQuantityRequired
      )
        updateSupplierGood.minimumQuantityRequired = minimumQuantityRequired;
      if (parLevel && parLevel !== supplierGood.parLevel)
        updateSupplierGood.parLevel = parLevel;
      if (purchaseUnit && purchaseUnit !== supplierGood.purchaseUnit)
        updateSupplierGood.purchaseUnit = purchaseUnit;
      if (measurementUnit && measurementUnit !== supplierGood.measurementUnit)
        updateSupplierGood.measurementUnit = measurementUnit;
      if (
        quantityInMeasurementUnit &&
        quantityInMeasurementUnit !== supplierGood.quantityInMeasurementUnit
      )
        updateSupplierGood.quantityInMeasurementUnit =
          quantityInMeasurementUnit;
      if (
        totalPurchasePrice &&
        totalPurchasePrice !== supplierGood.totalPurchasePrice
      )
        updateSupplierGood.totalPurchasePrice = totalPurchasePrice;

      if (
        updateSupplierGood.totalPurchasePrice &&
        updateSupplierGood.quantityInMeasurementUnit
      )
        updateSupplierGood.pricePerMeasurementUnit =
          (totalPurchasePrice ?? 0) / (quantityInMeasurementUnit ?? 0);

      // upload image
      if (
        files?.every((file) => file instanceof File && file.size > 0) &&
        files.length > 0
      ) {
        const folder = `/business/${supplierGood.businessId}/suppliersGoods/${supplierGoodId}`;

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

        updateSupplierGood.imagesUrl = [
          ...(supplierGood?.imagesUrl || []),
          ...cloudinaryUploadResponse,
        ];
      }

      // updated supplier good
      const updatedSupplierGood = await SupplierGood.findByIdAndUpdate(
        supplierGoodId,
        { $set: updateSupplierGood },
        {
          new: true,
          lean: true,
          session,
        }
      );

      if (!updatedSupplierGood) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({ message: "Supplier good not updated!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Get the current month's start and end dates to check if supplier good is in the inventory for the current month
      const startOfCurrentMonth = moment().startOf("month").toDate();
      const endOfCurrentMonth = moment().endOf("month").toDate();

      const isSupplierGoodInInventory = await Inventory.exists({
        businessId: supplierGood.businessId,
        setFinalCount: false,
        createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        "inventoryGoods.supplierGoodId": supplierGoodId,
      });

      // *** IMPORTANT ***
      // if currently in use, added to the inventory
      if (currentlyInUse === true) {
        if (!isSupplierGoodInInventory) {
          const addSupplierGoodToInventoryResult =
            await addSupplierGoodToInventory(
              supplierGoodId,
              supplierGood.businessId as Types.ObjectId,
              session
            );

          if (addSupplierGoodToInventoryResult !== true) {
            await session.abortTransaction();
            return new NextResponse(
              JSON.stringify({
                message:
                  "Supplier good updated but fail to add to inventory! Error: " +
                  addSupplierGoodToInventoryResult,
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
      }

      await session.commitTransaction();

      return new NextResponse(
        JSON.stringify({
          message: "Supplier good updated successfully!",
        }),
        {
          status: 200,
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

// delete a supplier goods shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a supplier goods should be deleted is if the business itself is deleted
// but in case you want to delete a supplier good you can use the following code
// be aware that this will remove the supplier good from the database and all the business goods reference will be lost
// @desc    Delete supplier good by ID
// @route   DELETE /supplierGoods/:supplierGoodId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { supplierGoodId: Types.ObjectId } }
) => {
  const { supplierGoodId } = context.params;

  // check if the supplier good is valid
  if (isObjectIdValid([supplierGoodId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid supplierGoodId!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // connect before first call to DB
  await connectDb();

  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Attempt to find the supplier good and check if it's in use
    const supplierGood = (await SupplierGood.findById(supplierGoodId)
      .select("businessId")
      .lean()) as unknown as ISupplierGood | null;

    if (!supplierGood) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // ***************************************************************************
    // do not allow to delete a supplier good that is in use in any business goods
    // ***************************************************************************

    // Check if any business goods uses this supplier good
    const isInUse = await BusinessGood.exists({
      businessId: supplierGood.businessId,
      "ingredients.supplierGoodId": supplierGoodId,
    });

    if (isInUse) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Supplier good is in use in some business goods!",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete the supplier good
    const deletedSupplierGood = await SupplierGood.findOneAndDelete(
      { _id: supplierGoodId },
      { session }
    );

    if (!deletedSupplierGood) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete the supplier good from the inventory
    const deleteSupplierGoodFromInventoryResult =
      await deleteSupplierGoodFromInventory(
        supplierGoodId,
        supplierGood.businessId,
        session
      );

    if (deleteSupplierGoodFromInventoryResult !== true) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: deleteSupplierGoodFromInventoryResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // cloudinary folder path
    const folderPath = `/business/${deletedSupplierGood?.businessId}/suppliersGoods/${supplierGoodId}`;

    // Delete business folder in cloudinary
    const deleteFolderCloudinaryResult: string | boolean =
      await deleteFolderCloudinary(folderPath);

    if (deleteFolderCloudinaryResult !== true) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: deleteFolderCloudinaryResult }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: `Supplier good deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Delete business good failed!", error as string);
  } finally {
    session.endSession();
  }
};
