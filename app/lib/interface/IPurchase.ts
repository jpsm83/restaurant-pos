import { Types } from "mongoose";

export interface IPurchaseItem {
  supplierGoodId: Types.ObjectId;
  quantityPurchased: number;
  purchasePrice: number;
}

export interface IPurchase {
  title?: string;
  supplierId: Types.ObjectId;
  imageUrl?: string;
  purchaseDate: Date;
  businessId: Types.ObjectId;
  purchasedByEmployeeId: Types.ObjectId;
  purchaseInventoryItems?: IPurchaseItem[];
  oneTimePurchase?: object;
  totalAmount: number;
  receiptId: string;
  comment?: string;
}
