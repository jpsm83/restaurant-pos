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
  openedByCustomerId?: Types.ObjectId;
  openedByEmployeeId?: Types.ObjectId;
  responsibleById?: Types.ObjectId;
  businessId: Types.ObjectId;
  clientName?: string;
  salesGroup?: ISalesGroup[];
  closedById?: Types.ObjectId;
}
