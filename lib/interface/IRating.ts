import { Types } from "mongoose";

export interface IRating {
  _id?: Types.ObjectId;
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId?: Types.ObjectId;
  score: number;
  comment?: string;
}
