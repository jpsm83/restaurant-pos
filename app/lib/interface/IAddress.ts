export interface IAddress {
  country: string;
  state: string;
  city: string;
  street: string;
  buildingNumber: string;
  postCode: string;
  region?: string;
  additionalDetails?: string;
  coordinates?: [number, number];
}
