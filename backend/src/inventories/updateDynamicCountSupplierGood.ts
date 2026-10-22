import convert, { Unit } from "convert-units";
import { ClientSession, Types } from "mongoose";
import BusinessGood from "../models/businessGood.ts";
import Inventory from "../models/inventory.ts";

const updateDynamicCountSupplierGood = async (
  businessGoodsIds: Types.ObjectId[],
  addOrRemove: "add" | "remove",
  session: ClientSession
): Promise<true | string> => {
  try {
    const uniqueIds = [
      ...new Set(businessGoodsIds.map((id) => id.toString())),
    ];
    // A sale or cancel still moves the stock a soft-deleted recipe already used.
    const businessGoodsIngredients = await BusinessGood.find({
      _id: { $in: businessGoodsIds },
    })
      .setOptions({ includeDeleted: true })
      .select(
        "ingredients.supplierGoodId ingredients.measurementUnit ingredients.requiredQuantity setMenuIds"
      )
      .populate({
        path: "setMenuIds",
        select:
          "ingredients.supplierGoodId ingredients.measurementUnit ingredients.requiredQuantity deleted",
        options: { includeDeleted: true },
        model: BusinessGood,
      })
      .session(session)
      .lean();

    if (
      !businessGoodsIngredients ||
      businessGoodsIngredients.length !== uniqueIds.length
    ) {
      return "Business goods not found!";
    }

    const allIngredientsRequired: {
      ingredientId: Types.ObjectId;
      requiredQuantity: number;
      measurementUnit: string;
    }[] = [];

    for (const businessGood of businessGoodsIngredients as Array<{
      ingredients?: Array<{
        supplierGoodId: Types.ObjectId;
        requiredQuantity: number;
        measurementUnit: string;
      }>;
      setMenuIds?: Array<{
        ingredients?: Array<{
          supplierGoodId: Types.ObjectId;
          requiredQuantity: number;
          measurementUnit: string;
        }>;
      } | null>;
    }>) {
      if (businessGood.ingredients) {
        for (const ing of businessGood.ingredients) {
          allIngredientsRequired.push({
            ingredientId: ing.supplierGoodId,
            requiredQuantity: ing.requiredQuantity,
            measurementUnit: ing.measurementUnit,
          });
        }
      }
      if (businessGood.setMenuIds) {
        for (const setMenuItem of businessGood.setMenuIds) {
          if (!setMenuItem?.ingredients) continue;
          for (const ing of setMenuItem.ingredients) {
            allIngredientsRequired.push({
              ingredientId: ing.supplierGoodId,
              requiredQuantity: ing.requiredQuantity,
              measurementUnit: ing.measurementUnit,
            });
          }
        }
      }
    }

    if (allIngredientsRequired.length === 0) {
      return true;
    }

    const inventoryItems = await Inventory.aggregate([
      {
        $match: {
          deleted: { $ne: true },
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

    if (!inventoryItems || inventoryItems.length === 0) return "Inventory not found!";

    const supplierGoodUnitsMap = (inventoryItems[0].supplierGoods as Array<{
      _id: Types.ObjectId;
      measurementUnit: string;
    }>).reduce<Record<string, string>>((map, good) => {
      map[good._id.toString()] = good.measurementUnit;
      return map;
    }, {});

    const inventoryMap = (inventoryItems[0].inventoryGoods as Array<{
      supplierGoodId: Types.ObjectId;
      dynamicSystemCount: number;
    }>).reduce<Record<string, { supplierGoodId: Types.ObjectId; dynamicSystemCount: number }>>(
      (map, invItem) => {
        map[invItem.supplierGoodId.toString()] = invItem;
        return map;
      },
      {}
    );

    const bulkOperations = allIngredientsRequired
      .map((ingredientObj) => {
        const inventoryItem = inventoryMap[ingredientObj.ingredientId.toString()];
        const supplierGoodUnit = supplierGoodUnitsMap[ingredientObj.ingredientId.toString()];

        if (!inventoryItem || !supplierGoodUnit) return null;

        let quantityChange = ingredientObj.requiredQuantity;
        if (ingredientObj.measurementUnit !== supplierGoodUnit) {
          quantityChange = convert(quantityChange)
            .from(ingredientObj.measurementUnit as Unit)
            .to(supplierGoodUnit as Unit);
        }

        return {
          updateOne: {
            filter: {
              deleted: { $ne: true },
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
      .filter(Boolean) as Array<{
      updateOne: {
        filter: Record<string, unknown>;
        update: Record<string, unknown>;
      };
    }>;

    if (bulkOperations.length === 0) return "No bulk operations failed!";

    await Inventory.bulkWrite(bulkOperations, { session });

    return true;
  } catch (error) {
    return "Could not update dynamic count supplier good! " + error;
  }
}

export default updateDynamicCountSupplierGood;