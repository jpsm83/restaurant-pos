import { Types } from "mongoose";
import { IPersonalDetails } from "./IPersonalDetails";

export interface ICustomer {
  personalDetails: IPersonalDetails;
  selfOrders: Types.ObjectId[];
}
