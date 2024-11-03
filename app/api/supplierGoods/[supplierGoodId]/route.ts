import { NextResponse } from "next/server";
import connectDb from "@/app/lib/utils/connectDb";
import { Types } from "mongoose";

// imported utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";

// imported models
import SupplierGood from "@/app/lib/models/supplierGood";
import BusinessGood from "@/app/lib/models/businessGood";
import Supplier from "@/app/lib/models/supplier";
import addSupplierGoodToInventory from "../../inventories/utils/addSupplierGoodToInventory";
import Inventory from "@/app/lib/models/inventory";
import moment from "moment";

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
    return handleApiError("Get supplier good by its id failed!", error);
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
    const supplierGoodId = context.params.supplierGoodId;

    // check if supplierGoodId is valid
    if (isObjectIdValid([supplierGoodId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierGoodId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const {
      name,
      keyword,
      mainCategory,
      subCategory,
      currentlyInUse,
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

    // connect before first call to DB
    await connectDb();

    // check if the supplier good exists
    const supplierGood: ISupplierGood | null = await SupplierGood.findById(
      supplierGoodId
    ).lean();

    if (!supplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
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
      return new NextResponse(
        JSON.stringify({
          message: `Supplier good ${name} already exists on this supplier!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // create a new supplier good object
    let updateSupplierGood: Partial<ISupplierGood> = {};

    if (name) updateSupplierGood.name = name;
    if (keyword) updateSupplierGood.keyword = keyword;
    if (mainCategory) updateSupplierGood.mainCategory = mainCategory;
    if (subCategory) updateSupplierGood.subCategory = subCategory;
    if (currentlyInUse) updateSupplierGood.currentlyInUse = currentlyInUse;
    if (description) updateSupplierGood.description = description;
    if (allergens) updateSupplierGood.allergens = allergens;
    if (budgetImpact) updateSupplierGood.budgetImpact = budgetImpact;
    if (inventorySchedule)
      updateSupplierGood.inventorySchedule = inventorySchedule;
    if (minimumQuantityRequired)
      updateSupplierGood.minimumQuantityRequired = minimumQuantityRequired;
    if (parLevel) updateSupplierGood.parLevel = parLevel;
    if (purchaseUnit) updateSupplierGood.purchaseUnit = purchaseUnit;
    if (measurementUnit) updateSupplierGood.measurementUnit = measurementUnit;
    if (quantityInMeasurementUnit)
      updateSupplierGood.quantityInMeasurementUnit = quantityInMeasurementUnit;
    if (totalPurchasePrice)
      updateSupplierGood.totalPurchasePrice = totalPurchasePrice;
    if (totalPurchasePrice && quantityInMeasurementUnit)
      updateSupplierGood.pricePerMeasurementUnit =
        totalPurchasePrice / quantityInMeasurementUnit;

    // updated supplier good
    const updatedSupplierGood = await SupplierGood.findByIdAndUpdate(
      supplierGoodId,
      { $set: updateSupplierGood },
      {
        new: true,
        lean: true,
      }
    );

    if (updatedSupplierGood) {
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
              supplierGood.businessId as Types.ObjectId
            );

          if (addSupplierGoodToInventoryResult !== true) {
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
    }

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
    return handleApiError("Update supplier good failed!", error);
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

    // Attempt to find the supplier good and check if it's in use
    const supplierGood: ISupplierGood | null = await SupplierGood.findById(
      supplierGoodId
    )
      .select("businessId")
      .lean();

    if (!supplierGood) {
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
      return new NextResponse(
        JSON.stringify({
          message: "Supplier good is in use in some business goods!",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete the supplier good
    const result = await SupplierGood.deleteOne({ _id: supplierGoodId });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: `Supplier good deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete supplier good failed!", error);
  }
};
