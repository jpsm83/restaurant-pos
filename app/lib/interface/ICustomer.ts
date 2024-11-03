import { Types } from "mongoose";
import { IAddress } from "./IAddress";
import { IPersonalDetails } from "./IPersonalDetails";

export interface ICustomerOrders {
  orderId: Types.ObjectId[];
  saleDate: Date;
  paymentToken: string;
  paymentMethodId: string;
}

export interface ICustomer {
  customerName: string;
  email: string;
  password: string;
  idType: string;
  idNumber: string;
  personalDetails: IPersonalDetails;
  businessId: Types.ObjectId;
  deviceToken?: string;
  address?: IAddress;
  imageUrl?: string;
  customerOrders?: ICustomerOrders[];
  notifications?: { notificationId: Types.ObjectId; readFlag: boolean }[];
}
