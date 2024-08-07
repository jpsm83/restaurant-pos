import { Types } from "mongoose";

export interface ISupplierGood {
  _id?: Types.ObjectId;
  name: string;
  keyword: string;
  category: {
    mainCategory: string;
    foodSubCategory?: string;
    beverageSubCategory?: string;
    merchandiseSubCategory?: string;
    cleaningSubCategory?: string;
    officeSubCategory?: string;
    furnitureSubCategory?: string;
    disposableSubCategory?: string;
    servicesSubCategory?: string;
    equipmentSubCategory?: string;
    othersSubCategory?: string;
  };
  subCategory?: string;
  currentlyInUse: boolean;
  supplier: Types.ObjectId;
  business?: Types.ObjectId;
  description?: string;
  allergens?: string[];
  budgetImpact?: string;
  image?: string;
  saleUnit?: string;
  wholeSalePrice?: number;
  measurementUnit?: string;
  totalQuantityPerUnit?: number;
  pricePerUnit?: number;
  parLevel?: number;
  minimumQuantityRequired?: number;
  inventorySchedule?: string;
  dynamicCountFromLastInventory?: number;
  lastInventoryCountDate?: Date;
}
