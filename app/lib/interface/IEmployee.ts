import { Types } from "mongoose";
import { IAddress } from "./IAddress";
import { IPersonalDetails } from "./IPersonalDetails";

export interface ISalary {
  payFrequency: string;
  grossSalary: number;
  netSalary: number;
}

export interface IEmployee {
  employeeName: string;
  email: string;
  password: string;
  idType: string;
  idNumber: string;
  allEmployeeRoles: string[];
  personalDetails: IPersonalDetails;
  taxNumber: string;
  joinDate: Date;
  active: boolean;
  onDuty: boolean;
  vacationDaysPerYear?: number;
  vacationDaysLeft: number;
  businessId: Types.ObjectId;
  deviceToken?: string;
  currentShiftRole?: string;
  address?: IAddress;
  imageUrl?: string;
  contractHoursWeek?: number; // in milliseconds
  salary?: ISalary;
  terminatedDate?: Date;
  notifications?: { notificationId: Types.ObjectId; readFlag: boolean }[];
  comments?: string;
}
