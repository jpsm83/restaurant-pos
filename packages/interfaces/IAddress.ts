export interface IAddress {
  country: string;
  state: string;
  city: string;
  street: string;
  buildingNumber: string;
  /** Unit, door, or apartment identifier when applicable. */
  doorNumber?: string;
  /** Second line (e.g. floor, block, “apto 3”). */
  complement?: string;
  postCode: string;
  region?: string;
  additionalDetails?: string;
  coordinates?: [number, number];
}