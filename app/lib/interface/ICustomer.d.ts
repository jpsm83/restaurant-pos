import { Types } from "mongoose";

export interface ICustomer {
  _id?: Types.ObjectId;
  customerName?: string;
  [key: string]: unknown;
}
