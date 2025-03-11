import { Types } from "mongoose";
// import { IAddress } from "./IAddress";
import { IPersonalDetails } from "./IPersonalDetails";

// export interface ICustomerOrders {
//   readonly orderId: Types.ObjectId[];
//   saleDate: Date;
//   paymentToken: string;
//   paymentMethodId: string;
// }

// export interface ICustomer { // customerUser insted
//   customerName: string;
//   email: string;
//   password: string;
//   idType: string;
//   idNumber: string;
//   personalDetails: IPersonalDetails;
//   address?: IAddress;
//   imageUrl?: string;

//   deviceToken?: string;
//   notifications?: { notificationId: Types.ObjectId; readFlag: boolean }[];
//   customerOrders?: ICustomerOrders[];
//   readonly businessId: Types.ObjectId;
// }

export interface ICustomer {
  // customerUser insted
  personalDetails: IPersonalDetails;
  selfOrders: Types.ObjectId[];
}
