import { Types } from "mongoose";
import { IPersonalDetails } from "./IPersonalDetails";

export interface ISalary {
  payFrequency: string;
  grossSalary: number;
  netSalary: number;
}

export interface IEmployee {
  personalDetails: IPersonalDetails;
  allEmployeeRoles: string[];
  taxNumber: string;
  joinDate: Date;
  active: boolean;
  onDuty: boolean;
  vacationDaysPerYear: number;
  businessId: Types.ObjectId;
  vacationDaysLeft?: number;
  deviceToken?: string;
  currentShiftRole?: string;
  contractHoursWeek?: number; // in milliseconds
  salary?: ISalary;
  terminatedDate?: Date;
  comments?: string;
}
