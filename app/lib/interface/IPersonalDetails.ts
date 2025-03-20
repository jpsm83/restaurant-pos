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
}
