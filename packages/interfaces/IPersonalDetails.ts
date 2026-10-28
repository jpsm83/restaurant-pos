import type { IAddress } from "./IAddress.ts";

export interface IPersonalDetails {
  email: string;
  emailVerified?: boolean;
  username?: string;
  password?: string;
  address?: IAddress;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  nationality?: string;
  gender?: string;
  birthDate?: Date | string;
  phoneNumber?: string;
}
