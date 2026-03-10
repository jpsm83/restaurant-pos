import { Types } from "mongoose";

import { getTheoreticalUsage } from "./getTheoreticalUsage";
import { getActualUsage } from "./getActualUsage";

export interface VarianceReportItem {
  supplierGoodId: Types.ObjectId;
  theoreticalQuantity: number;
  actualQuantity: number;
  varianceQuantity: number; // theoretical - actual
  measurementUnit: string;
}

/**
 * Builds variance report for a month: theoretical (from orders) vs actual
 * (opening + purchases - closing) per supplier good.
 */
export async function getVarianceReport(
  businessId: Types.ObjectId,
  year: number,
  month: number
): Promise<VarianceReportItem[]> {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const [theoretical, actual] = await Promise.all([
    getTheoreticalUsage(businessId, startDate, endDate),
    getActualUsage(businessId, startDate, endDate),
  ]);

  const theoreticalMap = new Map<string, { quantity: number; measurementUnit: string }>();
  theoretical.forEach((t) => {
    theoreticalMap.set(t.supplierGoodId.toString(), {
      quantity: t.quantity,
      measurementUnit: t.measurementUnit,
    });
  });
  const actualMap = new Map<string, { quantity: number; measurementUnit: string }>();
  actual.forEach((a) => {
    actualMap.set(a.supplierGoodId.toString(), {
      quantity: a.quantity,
      measurementUnit: a.measurementUnit,
    });
  });

  const allIds = new Set<string>([
    ...theoreticalMap.keys(),
    ...actualMap.keys(),
  ]);

  const result: VarianceReportItem[] = [];
  for (const idStr of allIds) {
    const th = theoreticalMap.get(idStr);
    const ac = actualMap.get(idStr);
    const theoreticalQuantity = th?.quantity ?? 0;
    const actualQuantity = ac?.quantity ?? 0;
    const measurementUnit = th?.measurementUnit ?? ac?.measurementUnit ?? "";
    result.push({
      supplierGoodId: new Types.ObjectId(idStr),
      theoreticalQuantity,
      actualQuantity,
      varianceQuantity: theoreticalQuantity - actualQuantity,
      measurementUnit,
    });
  }
  return result;
}
