import { NextResponse } from "next/server";
import connectDb from "@/app/lib/utils/connectDb";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import addSupplierGoodToInventory from "../inventories/utils/addSupplierGoodToInventory";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";

// import models
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";

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
    return handleApiError("Get all supplier goods failed!", error);
  }
};

// @desc    Create new supplier good
// @route   POST /supplierGoods
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      name,
      keyword,
      mainCategory,
      subCategory,
      currentlyInUse,
      supplierId,
      businessId,
      description,
      allergens,
      budgetImpact,
      inventorySchedule,
      minimumQuantityRequired,
      parLevel,
      purchaseUnit,
      measurementUnit,
      quantityInMeasurementUnit,
      totalPurchasePrice,
    } = (await req.json()) as ISupplierGood;

    // check required fields
    if (
      !name ||
      !keyword ||
      !mainCategory ||
      !subCategory ||
      currentlyInUse === undefined ||
      !supplierId ||
      !businessId
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Name, keyword, mainCategory, subCategory, currentlyInUse, supplierId and businessId are required!",
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

    // connect before first call to DB
    await connectDb();

    // check if the supplier good already exists
    const duplicateSupplierGood = await SupplierGood.exists({
      businessId,
      supplierId,
      name,
    });

    if (duplicateSupplierGood) {
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

    // Create a supplier good object with required fields
    const newSupplierGood: ISupplierGood = {
      name,
      keyword,
      mainCategory,
      subCategory,
      currentlyInUse,
      supplierId,
      businessId,
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

    // create a new supplier good
    const newSupplierGoodResponse = await SupplierGood.create(newSupplierGood);

    if (!newSupplierGoodResponse) {
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
    if (currentlyInUse === true) {
      const addSupplierGoodToInventoryResult = await addSupplierGoodToInventory(
        newSupplierGoodResponse._id,
        businessId
      );

      if (addSupplierGoodToInventoryResult !== true) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Supplier good created but fail to add to inventory! Error: " +
              addSupplierGoodToInventoryResult,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // confirm supplier good was created
    return new NextResponse(
      JSON.stringify({
        message: `Supplier good ${name} created successfully!`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create supplier good failed!", error);
  }
};
