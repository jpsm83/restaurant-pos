import { Types } from "mongoose";

export interface ISalesInstance {
  _id?: Types.ObjectId;
  dailyReferenceNumber?: number;
  salesPointId: Types.ObjectId;
  guests: number;
  salesInstanceStatus: string;
  openedByCustomerId?: Types.ObjectId;
  openedByEmployeeId?: Types.ObjectId;
  responsibleById?: Types.ObjectId;
  businessId: Types.ObjectId;
  clientName?: string;
  salesGroup?: {
    orderCode: string;
    ordersIds: Types.ObjectId[];
  }[];
  closedById?: Types.ObjectId;
}
