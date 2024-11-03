import { Schema, model, models } from "mongoose";
import { addressSchema } from "./address";
import { idTypes, employeeRoles } from "../enums.js";
import { personalDetailsSchema } from "./personalDetails";

const salarySchema = new Schema({
  payFrequency: {
    type: String,
    enum: ["Hourly", "Daily", "Weekly", "Monthly"],
    required: true,
  }, // frequency of the payment
  grossSalary: { type: Number, required: true }, // hourly employee salary before taxes
  netSalary: { type: Number, required: true }, // net employee salary after taxes
});

const employeeSchema = new Schema(
  {
    // required fields
    employeeName: { type: String, required: true, unique: true }, // username for the employee
    email: { type: String, required: true, unique: true }, // email
    password: { type: String, required: true }, // password for the employee
    idType: {
      type: String,
      enum: idTypes,
      required: true,
    }, // type of ID used by the employee
    idNumber: { type: String, required: true, unique: true }, // ID number of the employee
    allEmployeeRoles: [
      {
        type: String,
        enum: employeeRoles,
        required: true,
      },
    ], // all roles of the employee, can be multiple
    personalDetails: { type: personalDetailsSchema, required: true }, // personal details of the employee
    taxNumber: { type: String, required: true, unique: true }, // tax number of the employee
    joinDate: { type: Date, required: true }, // date when the employee joined the business
    active: { type: Boolean, required: true, default: true }, // if the employee is active, could be a sesonality worker
    onDuty: { type: Boolean, required: true, default: false }, // if the employee is on duty, shift working right now
    vacationDaysPerYear: { type: Number }, // days of holidays per year
    vacationDaysLeft: { type: Number }, // days of holidays left
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business where the employee works

    // optional fields
    deviceToken: { type: String }, // token for push notifications with Firebase Cloud Messaging
    currentShiftRole: { type: String, enum: employeeRoles }, // current shift role of the employee
    address: addressSchema, // address of the employee
    imageUrl: { type: String }, // photo of the employee
    // *** IMPORTANTE ***
    // employee might input the contract hours per week as a whole hour number on the front of the application and them it will be converted to milliseconds
    contractHoursWeek: { type: Number }, // contract hours per week in milliseconds
    salary: { type: salarySchema }, // salary of the employee
    terminatedDate: { type: Date }, // date when the employee left the business
    notifications: {
      type: [
        {
          notificationId: {
            type: Schema.Types.ObjectId,
            ref: "Notification",
          },
          readFlag: { type: Boolean, default: false },
          deletedFlag: { type: Boolean, default: false },
        },
      ],
      default: undefined,
    }, // if the employee wants to receive notifications
    comments: { type: String }, // comments about the employee
  },
  { timestamps: true }
);

const Employee = models.Employee || model("Employee", employeeSchema);
export default Employee;
