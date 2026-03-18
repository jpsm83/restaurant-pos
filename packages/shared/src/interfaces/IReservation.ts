import { Types } from "mongoose";

export interface IReservation {
  _id?: Types.ObjectId;
  businessId: Types.ObjectId;
  createdByUserId: Types.ObjectId;
  createdByRole: "customer" | "employee";
  employeeResponsableByUserId?: Types.ObjectId;
  guestCount: number;
  reservationStart: Date;
  reservationEnd?: Date;
  description?: string;
  status?:
    | "Pending"
    | "Confirmed"
    | "Arrived"
    | "Seated"
    | "Cancelled"
    | "NoShow"
    | "Completed";
  salesPointId?: Types.ObjectId;
  salesInstanceId?: Types.ObjectId;
}

