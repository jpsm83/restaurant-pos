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

/**
 * API row consumed by employee-mode schedule checks on the frontend.
 * Backend route: `GET /api/v1/schedules/business/:businessId/daily`.
 */
export interface IScheduleShiftEntry {
  vacation: boolean;
  startTime: string;
  endTime: string;
}

export interface IDailyEmployeeScheduleResponse {
  entries: IScheduleShiftEntry[];
}
