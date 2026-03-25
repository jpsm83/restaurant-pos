import { Types } from "mongoose";

export interface ISalesGroup {
  orderCode: string;
  ordersIds: Types.ObjectId[];
}

export interface ISalesInstance {
  _id?: Types.ObjectId;
  dailyReferenceNumber?: number;
  salesPointId: Types.ObjectId;
  guests: number;
  salesInstanceStatus: string;
  reservationId?: Types.ObjectId;
  openedByUserId?: Types.ObjectId;
  openedAsRole?: "employee" | "customer";
  responsibleByUserId?: Types.ObjectId;
  businessId: Types.ObjectId;
  clientName?: string;
  salesGroup?: ISalesGroup[];
  closedByUserId?: Types.ObjectId;
}
