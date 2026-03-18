import { Types } from "mongoose";
import { NextResponse } from "next/server";

import connectDb from "@/lib/db/connectDb";
import { handleApiError } from "@/lib/db/handleApiError";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { IInventory } from "@shared/interfaces/IInventory";
import Inventory from "@/lib/db/models/inventory";
import SupplierGood from "@/lib/db/models/supplierGood";
import Supplier from "@/lib/db/models/supplier";

interface InventoryWithGoods {
  inventoryGoods?: IInventory["inventoryGoods"];
}

// @desc    Get supplier goods below par or minimum (low stock) for dashboard/alerts
// @route   GET /api/v1/inventories/business/:businessId/lowStock
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  const businessId = context.params.businessId;

  if (isObjectIdValid([businessId]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Business ID not valid!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await connectDb();

    const inventory = (await Inventory.findOne({
      businessId,
      setFinalCount: false,
    })
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory measurementUnit parLevel minimumQuantityRequired",
        model: SupplierGood,
        populate: {
          path: "supplierId",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean()) as InventoryWithGoods | null;

    if (!inventory || !inventory.inventoryGoods?.length) {
      return new NextResponse(JSON.stringify({ lowStock: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    type PopulatedIg = {
      supplierGoodId: { _id?: Types.ObjectId; parLevel?: number; minimumQuantityRequired?: number; measurementUnit?: string };
      dynamicSystemCount?: number;
    };
    const lowStock = inventory.inventoryGoods.filter((ig: IInventory["inventoryGoods"][0] | PopulatedIg) => {
      const sg = (ig as PopulatedIg).supplierGoodId;
      if (!sg) return false;
      const par = sg.parLevel ?? sg.minimumQuantityRequired;
      const min = sg.minimumQuantityRequired ?? sg.parLevel;
      const count = (ig as PopulatedIg).dynamicSystemCount ?? 0;
      if (par != null && count < par) return true;
      if (min != null && count < min) return true;
      return false;
    }).map((ig: IInventory["inventoryGoods"][0] | PopulatedIg) => {
      const pop = ig as PopulatedIg;
      return {
        supplierGoodId: pop.supplierGoodId?._id ?? pop.supplierGoodId,
        supplierGood: pop.supplierGoodId,
        dynamicSystemCount: pop.dynamicSystemCount,
        parLevel: pop.supplierGoodId?.parLevel,
        minimumQuantityRequired: pop.supplierGoodId?.minimumQuantityRequired,
        measurementUnit: pop.supplierGoodId?.measurementUnit,
      };
    });

    return new NextResponse(JSON.stringify({ lowStock }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError(
      "Get low stock failed!",
      error instanceof Error ? error.message : String(error)
    );
  }
};
