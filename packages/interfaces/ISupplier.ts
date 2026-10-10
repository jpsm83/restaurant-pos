import { Types } from "mongoose";
import { IAddress } from "./IAddress.ts";

export interface ISupplier {
  _id?: Types.ObjectId | string;
  tradeName: string;
  legalName: string;
  email: string;
  phoneNumber: string;
  taxNumber: string;
  businessId: Types.ObjectId | string;
  address: IAddress;
  currentlyInUse: boolean;
  imageUrl?: string;
  contactPerson?: string;
}
