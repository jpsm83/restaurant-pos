import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import SupplierGood from "@/lib/db/models/supplierGood";

import { getVarianceReport } from "./getVarianceReport";

export interface WasteByImpactPercentages {
  veryLowImpactWastePercentage: number;
  lowImpactWastePercentage: number;
  mediumImpactWastePercentage: number;
  highImpactWastePercentage: number;
  veryHighImpactWastePercentage: number;
}

const ZERO_WASTE: WasteByImpactPercentages = {
  veryLowImpactWastePercentage: 0,
  lowImpactWastePercentage: 0,
  mediumImpactWastePercentage: 0,
  highImpactWastePercentage: 0,
  veryHighImpactWastePercentage: 0,
};

type ImpactKey =
  | "veryLowImpactWastePercentage"
  | "lowImpactWastePercentage"
  | "mediumImpactWastePercentage"
  | "highImpactWastePercentage"
  | "veryHighImpactWastePercentage";

/**
 * Computes waste percentages by supplier-good budget impact for a month.
 *
 * Uses the existing variance report:
 *  - Theoretical quantity = expected usage from orders.
 *  - Actual quantity      = opening + purchases - closing.
 *  - Variance             = theoretical - actual.
 *
 * We treat **shrink/waste** as cases where actual usage is higher than
 * theoretical usage (more stock left the system than recipes explain).
 *
 * For each SupplierGood:
 *  - wasteQuantity = max(actualQuantity - theoreticalQuantity, 0)
 *  - baseQuantity  = actualQuantity when > 0, otherwise theoreticalQuantity
 *
 * For each budgetImpact bucket we then compute:
 *   waste% = (sum wasteQuantity / sum baseQuantity) * 100
 *
 * Budget impact mapping (from SupplierGood.budgetImpact):
 *  - "Very Low"  -> veryLowImpactWastePercentage
 *  - "Low"       -> lowImpactWastePercentage
 *  - "Medium"    -> mediumImpactWastePercentage
 *  - "High"      -> highImpactWastePercentage
 *  - "Very High" -> veryHighImpactWastePercentage
 */
export async function getWasteByBudgetImpactForMonth(
  businessId: Types.ObjectId,
  monthReference: Date
): Promise<WasteByImpactPercentages> {
  // Defensive: ensure we are working with the first day of the month
  const monthStart = new Date(
    monthReference.getFullYear(),
    monthReference.getMonth(),
    1,
    0,
    0,
    0,
    0
  );

  const year = monthStart.getFullYear();
  const month = monthStart.getMonth() + 1; // JS months are 0-based

  // Variance report gives us theoretical vs actual usage per supplier good.
  const varianceItems = await getVarianceReport(businessId, year, month);
  if (!varianceItems.length) return ZERO_WASTE;

  await connectDb();

  const supplierGoodIds = varianceItems.map((item) => item.supplierGoodId);

  const supplierGoods = await SupplierGood.find({
    _id: { $in: supplierGoodIds },
    businessId,
  })
    .select("_id budgetImpact")
    .lean();

  if (!supplierGoods.length) return ZERO_WASTE;

  const varianceById = new Map(
    varianceItems.map((item) => [item.supplierGoodId.toString(), item])
  );

  const totals: Record<
    ImpactKey,
    {
      wasteQuantity: number;
      baseQuantity: number;
    }
  > = {
    veryLowImpactWastePercentage: { wasteQuantity: 0, baseQuantity: 0 },
    lowImpactWastePercentage: { wasteQuantity: 0, baseQuantity: 0 },
    mediumImpactWastePercentage: { wasteQuantity: 0, baseQuantity: 0 },
    highImpactWastePercentage: { wasteQuantity: 0, baseQuantity: 0 },
    veryHighImpactWastePercentage: { wasteQuantity: 0, baseQuantity: 0 },
  };

  const mapBudgetImpactToKey = (budgetImpact?: string | null): ImpactKey | null => {
    switch (budgetImpact) {
      case "Very Low":
        return "veryLowImpactWastePercentage";
      case "Low":
        return "lowImpactWastePercentage";
      case "Medium":
        return "mediumImpactWastePercentage";
      case "High":
        return "highImpactWastePercentage";
      case "Very High":
        return "veryHighImpactWastePercentage";
      default:
        return null;
    }
  };

  for (const sg of supplierGoods) {
    const impactKey = mapBudgetImpactToKey(
      // @ts-expect-error: lean document typing
      sg.budgetImpact as string | undefined
    );
    if (!impactKey) continue;

    const variance = varianceById.get(sg._id.toString());
    if (!variance) continue;

    const { theoreticalQuantity, actualQuantity } = variance;

    const wasteQuantity =
      actualQuantity > theoreticalQuantity
        ? actualQuantity - theoreticalQuantity
        : 0;

    const baseQuantity =
      actualQuantity > 0 ? actualQuantity : theoreticalQuantity;

    if (wasteQuantity <= 0 || baseQuantity <= 0) continue;

    totals[impactKey].wasteQuantity += wasteQuantity;
    totals[impactKey].baseQuantity += baseQuantity;
  }

  const result: WasteByImpactPercentages = { ...ZERO_WASTE };

  (Object.keys(totals) as ImpactKey[]).forEach((key) => {
    const { wasteQuantity, baseQuantity } = totals[key];
    if (baseQuantity > 0 && wasteQuantity > 0) {
      result[key] = (wasteQuantity / baseQuantity) * 100;
    }
  });

  return result;
}

