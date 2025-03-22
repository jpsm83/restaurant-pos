import { Types } from "mongoose";

export interface ITimeRange {
  startTime: Date;
  endTime: Date;
}

export interface IEmployeeSchedule {
  _id: Types.ObjectId;
  employeeId: Types.ObjectId;
  role: string;
  timeRange: ITimeRange;
  vacation: boolean;
  shiftHours: number;
  employeeCost: number;
}

export interface ISchedule {
  _id: Types.ObjectId;
  date: Date;
  weekNumber: number;
  employeesSchedules?: IEmployeeSchedule[];
  totalEmployeesScheduled?: number;
  totalEmployeesVacation?: number;
  totalDayEmployeesCost?: number;
  businessId: Types.ObjectId;
  comments?: string;
}
