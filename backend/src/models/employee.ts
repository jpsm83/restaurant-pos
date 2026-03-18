import mongoose, { Schema, model } from "mongoose";
import { employeePayFrequencyEnums, userRolesEnums } from "../enums.js";

const salarySchema = new Schema(
  {
    payFrequency: {
      type: String,
      enum: employeePayFrequencyEnums,
      required: [true, "Pay frequency is required!"],
    },
    grossSalary: { type: Number, required: [true, "Gross salary is required!"] },
    netSalary: { type: Number, required: [true, "Net salary is required!"] },
  },
  { timestamps: true, trim: true }
);

const notificationEntrySchema = new Schema(
  {
    notificationId: { type: Schema.Types.ObjectId, ref: "Notification", required: true },
    readFlag: { type: Boolean, default: false },
    deletedFlag: { type: Boolean, default: false },
  },
  { _id: false }
);

const employeeSchema = new Schema(
  {
    allEmployeeRoles: [
      { type: String, enum: userRolesEnums, required: [true, "Employee role is required!"] },
    ],
    taxNumber: { type: String, required: [true, "Tax number is required!"], unique: true },
    joinDate: { type: Date, required: [true, "Join date is required!"] },
    active: { type: Boolean, default: true },
    onDuty: { type: Boolean, default: false },
    vacationDaysPerYear: { type: Number, required: [true, "Vacations days per year is required!"] },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    vacationDaysLeft: { type: Number },
    currentShiftRole: { type: String, enum: userRolesEnums },
    contractHoursWeek: { type: Number },
    salary: { type: salarySchema },
    terminatedDate: { type: Date },
    documentsUrl: { type: [String], default: undefined },
    comments: { type: String },
    notifications: { type: [notificationEntrySchema], default: undefined },
  },
  { timestamps: true, trim: true }
);

const Employee = model("Employee", employeeSchema);
export default Employee;

