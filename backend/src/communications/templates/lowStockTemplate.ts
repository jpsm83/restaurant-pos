export interface LowStockTemplateItem {
  name: string;
  currentCount: number;
  threshold: number | string;
}

const buildLowStockTemplate = (items: LowStockTemplateItem[]): string => {
  if (items.length === 0) return "Low stock.";

  const details = items
    .map((item) => `${item.name} (${item.currentCount}/${item.threshold})`)
    .join(", ");

  return `Low stock: ${details}`;
};

export default buildLowStockTemplate;

