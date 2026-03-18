import type { IPurchaseItem } from "@shared/interfaces/IPurchase";
import { isObjectIdValid } from "../utils/isObjectIdValid.js";

export const validateInventoryPurchaseItems = (
  purchaseInventoryItems: IPurchaseItem[],
  oneTimePurchase: boolean
): true | string => {
  if (
    !Array.isArray(purchaseInventoryItems) ||
    purchaseInventoryItems.length === 0
  ) {
    return "Purchase items is not an array or it is empty!";
  }

  for (const purchaseItem of purchaseInventoryItems) {
    if (!oneTimePurchase) {
      if (!isObjectIdValid([purchaseItem.supplierGoodId])) {
        return "Incorrect supplier good Id!";
      }
    }

    if (
      !purchaseItem.quantityPurchased ||
      purchaseItem.quantityPurchased === 0
    ) {
      return "Incorrect quantity purchased!";
    }

    if (!purchaseItem.purchasePrice || purchaseItem.purchasePrice === 0) {
      return "Incorrect purchase price!";
    }
  }
  return true;
};
