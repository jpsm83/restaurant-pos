import { Types } from "mongoose";
import { IAddress } from "./IAddress";
import { IPersonalDetails } from "./IPersonalDetails";

export interface ISalary {
  payFrequency: string;
  grossSalary: number;
  netSalary: number;
}

export interface IEmployee { // workeruser insted
  employeeName: string; // change to username
  email: string;
  password: string;
  idType: string;
  idNumber: string;
  personalDetails: IPersonalDetails;
  businessId: Types.ObjectId; // DELETE change to business
  deviceToken?: string;
  address?: IAddress;
  imageUrl?: string;

  allEmployeeRoles: string[]; // DELETE change to roles

  businessAndRoles: { businessId: Types.ObjectId; roles: string[] }[];// added, change on code

  taxNumber: string;
  joinDate: Date;
  active: boolean;
  onDuty: boolean;
  vacationDaysPerYear?: number;
  vacationDaysLeft: number;
  currentShiftRole?: string;
  contractHoursWeek?: number; // in milliseconds
  salary?: ISalary;
  terminatedDate?: Date;
  notifications?: { notificationId: Types.ObjectId; readFlag: boolean }[];
  comments?: string;
}
