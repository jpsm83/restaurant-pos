import { Types } from "mongoose";

export interface ISalary {
  payFrequency: string;
  grossSalary: number;
  netSalary: number;
}

export interface INotificationEntry {
  notificationId: Types.ObjectId | string;
  readFlag?: boolean;
  deletedFlag?: boolean;
}

export interface IEmployee {
  _id?: Types.ObjectId | string;
  allEmployeeRoles: string[];
  taxNumber: string;
  joinDate: Date;
  vacationDaysPerYear: number;
  businessId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  active?: boolean;
  onDuty?: boolean;
  vacationDaysLeft?: number;
  currentShiftRole?: string;
  contractHoursWeek?: number; // in milliseconds
  salary?: ISalary;
  terminatedDate?: Date;
  comments?: string;
  documentsUrl?: string[];
  notifications?: INotificationEntry[];
}
