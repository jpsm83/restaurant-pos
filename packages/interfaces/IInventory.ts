import type { Types } from "mongoose";

export interface IReedited {
  reeditedByEmployeeId: Types.ObjectId;
  date: Date;
  /** Legacy free-text reason kept for historical and dummy records. */
  reason?: string;
  /** Selected code from the closed count-reedit catalogue. */
  reasonCode?: string;
  /** Optional Other note, only stored when the code is `other`. */
  reasonNote?: string;
  originalValues: {
    currentCountQuantity: number;
    dynamicSystemCount: number;
    deviationPercent: number;
  };
}

export interface IInventoryCount {
  _id?: Types.ObjectId;
  countedDate?: Date;
  currentCountQuantity: number;
  deviationPercent?: number;
  quantityNeeded?: number;
  countedByEmployeeId: Types.ObjectId;
  lastCount?: boolean;
  comments?: string;
  reedited?: IReedited;
}

export interface IInventoryGood {
  supplierGoodId: Types.ObjectId;
  monthlyCounts: IInventoryCount[];
  averageDeviationPercent?: number;
  dynamicSystemCount: number;
}

export interface IInventory {
  _id?: Types.ObjectId;
  businessId: Types.ObjectId;
  setFinalCount: boolean;
  inventoryGoods: IInventoryGood[];
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}
