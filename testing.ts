import connectDb from "@/app/lib/utils/connectDb";
import { IBusinessGood } from "@/app/lib/interface/IBusinessGood";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import BusinessGood from "@/app/lib/models/businessGood";
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import convert, { Unit } from "convert-units";
import mongoose, { Types } from "mongoose";
import { IInventory } from "@/app/lib/interface/IInventory";
import path from "path";

// every time an order is created or cancel, we MUST update the supplier goods
// check all the ingredients of the business goods array of the order
// each ingredient is a supplier good
// add or remove the quantity used from the inventoy.inventoryGoods.[the supplier good that applied].dynamicCountFromLastInventory
// if insted of ingredients we have setMenu
// get all business goods from the setMenu and repeat the cicle
export const updateDynamicCountSupplierGood = async (
  businessGoodsIds: Types.ObjectId[],
  addOrRemove: "add" | "remove"
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Connect to the database
    await connectDb();

    // Fetch all business goods including setMenu and their ingredients
    const businessGoodsIngredients = await BusinessGood.find({
      _id: { $in: businessGoodsIds },
    })
      .select(
        "ingredients.supplierGoodId ingredients.measurementUnit ingredients.requiredQuantity setMenuIds"
      )
      .populate({
        path: "setMenuIds",
        select:
          "ingredients.supplierGoodId ingredients.measurementUnit ingredients.requiredQuantity",
        model: BusinessGood,
      })
      .lean();

    if (!businessGoodsIngredients || businessGoodsIngredients.length === 0) {
      return "Business goods not found!";
    }

    // Collect all required ingredients from business goods and setMenus
    let allIngredientsRequired: {
      ingredientId: Types.ObjectId;
      requiredQuantity: number;
      measurementUnit: string;
    }[] = [];

    businessGoodsIngredients.forEach((businessGood) => {
      if (businessGood.ingredients) {
        businessGood.ingredients.forEach((ing: any) => {
          allIngredientsRequired.push({
            ingredientId: ing.supplierGoodId,
            requiredQuantity: ing.requiredQuantity,
            measurementUnit: ing.measurementUnit,
          });
        });
      }
      if (businessGood.setMenuIds) {
        businessGood.setMenuIds.forEach((setMenuItem: any) => {
          setMenuItem.ingredients.forEach((ing: any) => {
            allIngredientsRequired.push({
              ingredientId: ing.supplierGoodId,
              requiredQuantity: ing.requiredQuantity,
              measurementUnit: ing.measurementUnit,
            });
          });
        });
      }
    });

    if (allIngredientsRequired.length === 0) return "No ingredients found!";

    // Aggregation to fetch both inventory items and supplier goods in one query
    const inventoryItems = await Inventory.aggregate([
      {
        $match: {
          setFinalCount: false,
          "inventoryGoods.supplierGoodId": {
            $in: allIngredientsRequired.map((ing) => ing.ingredientId),
          },
        },
      },
      {
        $project: {
          inventoryGoods: {
            $filter: {
              input: "$inventoryGoods",
              as: "item",
              cond: {
                $in: [
                  "$$item.supplierGoodId",
                  allIngredientsRequired.map((ing) => ing.ingredientId),
                ],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "suppliergoods",
          localField: "inventoryGoods.supplierGoodId",
          foreignField: "_id",
          as: "supplierGoods",
        },
      },
      {
        $project: {
          "inventoryGoods.supplierGoodId": 1,
          "inventoryGoods.dynamicSystemCount": 1,
          "supplierGoods._id": 1,
          "supplierGoods.measurementUnit": 1,
        },
      },
    ]).session(session);

    if (!inventoryItems || inventoryItems.length === 0)
      return "Inventory not found!";

    // Map supplierGoodId to measurementUnit and dynamicSystemCount
    const supplierGoodUnitsMap = inventoryItems[0].supplierGoods.reduce(
      (map: any, good: any) => {
        map[good._id.toString()] = good.measurementUnit;
        return map;
      },
      {}
    );

    const inventoryMap = inventoryItems[0].inventoryGoods.reduce(
      (map: any, invItem: any) => {
        map[invItem.supplierGoodId.toString()] = invItem;
        return map;
      },
      {}
    );

    // Perform bulk update to modify dynamic counts
    const bulkOperations: any = allIngredientsRequired
      .map((ingredientObj) => {
        const inventoryItem =
          inventoryMap[ingredientObj.ingredientId.toString()];
        const supplierGoodUnit =
          supplierGoodUnitsMap[ingredientObj.ingredientId.toString()];

        if (!inventoryItem || !supplierGoodUnit)
          return "InventoryItem or supplierGoodUnit not found!";

        let quantityChange = ingredientObj.requiredQuantity;
        if (ingredientObj.measurementUnit !== supplierGoodUnit) {
          // Convert units if necessary
          quantityChange = convert(quantityChange)
            .from(ingredientObj.measurementUnit as Unit)
            .to(supplierGoodUnit as Unit);
        }

        return {
          updateOne: {
            filter: {
              "inventoryGoods.supplierGoodId": ingredientObj.ingredientId,
            },
            update: {
              $inc: {
                "inventoryGoods.$.dynamicSystemCount":
                  addOrRemove === "add" ? quantityChange : -quantityChange,
              },
            },
          },
        };
      })
      .filter(Boolean); // Remove null values

    // Execute bulk update
    if (bulkOperations.length > 0) {
      await Inventory.bulkWrite(bulkOperations, { session });
    } else {
      return "No bulk operations failed!";
    }

    await session.commitTransaction();

    return true;
  } catch (error) {
    await session.abortTransaction();
    return "Could not update dynamic count supplier good! " + error;
  } finally {
    await session.endSession();
  }
};