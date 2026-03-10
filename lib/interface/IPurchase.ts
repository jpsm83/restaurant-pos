import { Types } from "mongoose";

export interface IPurchaseItem {
  supplierGoodId: Types.ObjectId;
  quantityPurchased: number;
  purchasePrice: number;
  lastEditByEmployeeId?: Types.ObjectId;
  lastEditReason?: string;
  lastEditDate?: Date;
}

export interface IPurchase {
  _id?: Types.ObjectId | string;
  supplierId: Types.ObjectId;
  purchaseDate: Date;
  businessId: Types.ObjectId;
  purchasedByEmployeeId: Types.ObjectId;
  totalAmount: number;
  receiptId: string;
  title?: string;
  documentsUrl?: string[];
  purchaseInventoryItems?: IPurchaseItem[];
  oneTimePurchase?: object;
  comment?: string;
}
