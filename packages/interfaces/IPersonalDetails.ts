import { IAddress } from "./IAddress.ts";

export interface IPersonalDetails {
  username: string;
  email: string;
  emailVerified?: boolean;
  password: string;
  idType: string;
  idNumber: string;
  address: IAddress;
  firstName: string;
  lastName: string;
  imageUrl?: string;
  nationality?: string;
  gender?: string;
  birthDate?: Date | string;
  phoneNumber: string;
}
