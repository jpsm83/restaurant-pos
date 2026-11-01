import type { Types } from "mongoose";

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
  /** Optional until HR completion. */
  taxNumber?: string;
  joinDate: Date;
  /** Optional until HR completion. */
  vacationDaysPerYear?: number;
  businessId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  /** Closed employment status; absent on legacy rows that predate it. */
  employmentStatus?: string;
  /** Server-derived compatibility mirror of `employmentStatus`. */
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
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}
