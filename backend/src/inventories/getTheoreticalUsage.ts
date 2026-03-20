import convert, { Unit } from "convert-units";
import { Types } from "mongoose";
import Order from "../models/order.ts";
import BusinessGood from "../models/businessGood.ts";
import SupplierGood from "../models/supplierGood.ts";

export interface TheoreticalUsageItem {
  supplierGoodId: Types.ObjectId;
  quantity: number;
  measurementUnit: string;
}

interface IngredientLean {
  supplierGoodId: Types.ObjectId;
  requiredQuantity: number;
  measurementUnit: string;
}
interface SetMenuItemLean {
  ingredients?: IngredientLean[];
}
interface BusinessGoodLean {
  _id: Types.ObjectId;
  ingredients?: IngredientLean[];
  setMenuIds?: SetMenuItemLean[];
}

const getTheoreticalUsage = async (
  businessId: Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<TheoreticalUsageItem[]> => {
  const orders = await Order.find({
    businessId,
    createdAt: { $gte: startDate, $lte: endDate },
    billingStatus: { $ne: "Cancel" },
  })
    .select("businessGoodId addOns")
    .lean();

  const allBusinessGoodsIds = orders.flatMap((o: { businessGoodId: Types.ObjectId; addOns?: Types.ObjectId[] }) => [
    o.businessGoodId,
    ...(o.addOns ?? []),
  ]);
  if (allBusinessGoodsIds.length === 0) return [];

  const businessGoods = (await BusinessGood.find({
    _id: { $in: allBusinessGoodsIds },
  })
    .select("ingredients setMenuIds")
    .populate({
      path: "setMenuIds",
      select:
        "ingredients.supplierGoodId ingredients.measurementUnit ingredients.requiredQuantity",
      model: BusinessGood,
    })
    .lean()) as BusinessGoodLean[];

  const supplierGoodIds = new Set<Types.ObjectId>();
  const ingredientList: {
    supplierGoodId: Types.ObjectId;
    requiredQuantity: number;
    measurementUnit: string;
  }[] = [];

  businessGoods.forEach((bg: BusinessGoodLean) => {
    if (bg.ingredients) {
      bg.ingredients.forEach((ing: IngredientLean) => {
        supplierGoodIds.add(ing.supplierGoodId);
        ingredientList.push({
          supplierGoodId: ing.supplierGoodId,
          requiredQuantity: ing.requiredQuantity,
          measurementUnit: ing.measurementUnit,
        });
      });
    }
    if (bg.setMenuIds) {
      bg.setMenuIds.forEach((setMenuItem: SetMenuItemLean) => {
        setMenuItem.ingredients?.forEach((ing: IngredientLean) => {
          supplierGoodIds.add(ing.supplierGoodId);
          ingredientList.push({
            supplierGoodId: ing.supplierGoodId,
            requiredQuantity: ing.requiredQuantity,
            measurementUnit: ing.measurementUnit,
          });
        });
      });
    }
  });

  if (ingredientList.length === 0) return [];

  const orderCountByBusinessGoodId = allBusinessGoodsIds.reduce(
    (acc: Record<string, number>, id: Types.ObjectId) => {
      const s = id.toString();
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const quantityByIngredientKey: Record<
    string,
    { quantity: number; measurementUnit: string }
  > = {};
  businessGoods.forEach((bg: BusinessGoodLean) => {
    const count = orderCountByBusinessGoodId[bg._id.toString()] ?? 0;
    if (count === 0) return;
    const add = (
      supplierGoodId: Types.ObjectId,
      requiredQuantity: number,
      measurementUnit: string
    ) => {
      const key = supplierGoodId.toString();
      if (!quantityByIngredientKey[key])
        quantityByIngredientKey[key] = { quantity: 0, measurementUnit };
      quantityByIngredientKey[key].quantity += requiredQuantity * count;
    };
    bg.ingredients?.forEach((ing: IngredientLean) =>
      add(ing.supplierGoodId, ing.requiredQuantity, ing.measurementUnit)
    );
    bg.setMenuIds?.forEach((setMenuItem: SetMenuItemLean) =>
      setMenuItem.ingredients?.forEach((ing: IngredientLean) =>
        add(ing.supplierGoodId, ing.requiredQuantity, ing.measurementUnit)
      )
    );
  });

  const supplierGoods = (await SupplierGood.find({
    _id: { $in: Array.from(supplierGoodIds) },
  })
    .select("_id measurementUnit")
    .lean()) as unknown as { _id: Types.ObjectId; measurementUnit: string }[];

  const unitBySgId: Record<string, string> = {};
  supplierGoods.forEach((sg: { _id: Types.ObjectId; measurementUnit: string }) => {
    unitBySgId[sg._id.toString()] = sg.measurementUnit;
  });

  const result: TheoreticalUsageItem[] = [];
  for (const [sgIdStr, { quantity, measurementUnit }] of Object.entries(
    quantityByIngredientKey
  )) {
    const targetUnit = unitBySgId[sgIdStr];
    if (!targetUnit) continue;
    let qty = quantity;
    if (measurementUnit !== targetUnit) {
      try {
        qty = convert(qty)
          .from(measurementUnit as Unit)
          .to(targetUnit as Unit);
      } catch {
        continue;
      }
    }
    result.push({
      supplierGoodId: new Types.ObjectId(sgIdStr),
      quantity: qty,
      measurementUnit: targetUnit,
    });
  }
  return result;
}

export default getTheoreticalUsage;