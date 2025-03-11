// export interface IPersonalDetails {
//   firstName: string;
//   lastName: string;
//   nationality: string;
//   gender: string;
//   birthDate: Date;
//   phoneNumber: string;
// }

import { Types } from "mongoose";
import { IAddress } from "./IAddress";

export interface IPersonalDetails {
  username: string;
  email: string;
  password: string;
  idType: string;
  idNumber: string;
  address: IAddress;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  nationality?: string;
  gender?: string;
  birthDate?: Date;
  phoneNumber: string;
  deviceToken?: string;
  notifications?: { notificationId: Types.ObjectId; readFlag: boolean }[];
}
