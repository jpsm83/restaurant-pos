// imported interfaces
import { IPurchaseItem } from "@/app/lib/interface/IPurchase";

// imported utils
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

export const validateInventoryPurchaseItems = (
  purchaseInventoryItems: IPurchaseItem[],
  oneTimePurchase: boolean
) => {
  // example of a purchase item object
  // purchaseInventoryItems = [
  //   {
  //     supplierGood: "5f5e5e5e5e5e5e5e5e5e5e5e",
  //     quantityPurchased: 5,
  //     purchasePrice: 100,
  //   },
  //   {
  //     supplierGood: "5f5e5e5e5e5e5e5e5e5e5e5e",
  //     quantityPurchased: 10,
  //     purchasePrice: 200,
  //   },
  //   {
  //     supplierGood: "5f5e5e5e5e5e5e5e5e5e5e5e",
  //     quantityPurchased: 15,
  //     purchasePrice: 300,
  //   },
  // ];

  if (
    !Array.isArray(purchaseInventoryItems) ||
    purchaseInventoryItems.length === 0
  ) {
    return "Purchase items is not an array or it is empty!";
  }

  // validate each supplierGood
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
