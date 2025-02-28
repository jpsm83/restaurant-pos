import { IMetrics } from "@/app/lib/interface/IBusiness";

const validateBusinessMetrics = (metrics: IMetrics) => {
  // check metrics is an object
  if (typeof metrics !== "object" || !metrics)
    return "Metrics must be an object!";

  const validKeys = [
    "foodCostPercentage",
    "beverageCostPercentage",
    "laborCostPercentage",
    "fixedCostPercentage",
    "supplierGoodWastePercentage",
  ];

  // Check for any invalid keys
  for (const key of Object.keys(metrics)) {
    if (!validKeys.includes(key)) {
      return `Invalid key: ${key}`;
    }
  }

  // Validate each parameter
  for (const key of Object.keys(metrics)) {
    const value = metrics[key as keyof IMetrics];

    if (key !== "supplierGoodWastePercentage") {
      // Check if value is a number
      if (typeof value !== "number") {
        return `${key} must be a number`;
      }

      // Validate for percentage fields
      if (value < 0 || value > 100) {
        return `${key} must be a number between 0 and 100`;
      }
    }
  }

  // Special case for supplierGoodWastePercentage
  if (metrics.supplierGoodWastePercentage) {
    const wasteKeys = [
      "veryLowBudgetImpact",
      "lowBudgetImpact",
      "mediumBudgetImpact",
      "hightBudgetImpact",
      "veryHightBudgetImpact",
    ];

    const wasteMetrics = metrics.supplierGoodWastePercentage;

    // Check for any invalid keys inside supplierGoodWastePercentage
    for (const key of Object.keys(wasteMetrics)) {
      if (!wasteKeys.includes(key)) {
        return `Invalid key in supplierGoodWastePercentage: ${key}`;
      }
    }

    // Validate each parameter inside supplierGoodWastePercentage
    for (const key of wasteKeys) {
      const value = wasteMetrics[key as keyof typeof wasteMetrics];

      // Check if value is a number
      if (typeof value !== "number") {
        return `${key} must be a number`;
      }

      // Validate for percentage fields
      if (value < 0 || value > 100) {
        return `${key} must be a number between 0 and 100`;
      }
    }
  }

  return true;
};

export default validateBusinessMetrics;
