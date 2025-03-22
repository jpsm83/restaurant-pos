import { Types } from "mongoose";

export interface ISalary {
  payFrequency: string;
  grossSalary: number;
  netSalary: number;
}

export interface IEmployee {
  allEmployeeRoles: string[];
  taxNumber: string;
  joinDate: Date;
  active: boolean;
  onDuty: boolean;
  vacationDaysPerYear: number;
  businessId: Types.ObjectId;
  userId: Types.ObjectId;
  vacationDaysLeft?: number;
  currentShiftRole?: string;
  contractHoursWeek?: number; // in milliseconds
  salary?: ISalary;
  terminatedDate?: Date;
  documentsUrl?: string[];
  comments?: string;
}
