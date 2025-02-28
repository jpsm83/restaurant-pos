import { DateExpression, Schema, model, models } from "mongoose";
import { addressSchema } from "./address";
import { idTypes, employeeRoles } from "../enums.js";
import { personalDetailsSchema } from "./personalDetails";

const salarySchema = new Schema({
  payFrequency: {
    type: String,
    enum: ["Hourly", "Daily", "Weekly", "Monthly"],
    required: [true, "Pay frequency is required!"],
  }, // frequency of the payment
  grossSalary: { type: Number, required: [true, "Gross salary is required!"] }, // hourly employee salary before taxes
  netSalary: { type: Number, required: [true, "Net salary is required!"] }, // net employee salary after taxes
});

const employeeSchema = new Schema(
  {
    // required fields
    employeeName: {
      type: String,
      required: [true, "Employee name is required!"],
      unique: true,
    }, // username for the employee
    email: {
      type: String,
      required: [true, "Email is required!"],
      unique: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please enter a valid email address!",
      ],
      trim: true,
      lowecase: true,
    }, // email
    password: {
      type: String,
      required: [true, "Password is required!"],
      match: [
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password must be 8 characters long and contain lowercase, uppercase, symbol and number!",
      ],
      minLength: 8,
    }, // password for the employee
    idType: {
      type: String,
      enum: idTypes,
      required: [true, "Id type is required!"],
    }, // type of ID used by the employee
    idNumber: {
      type: String,
      required: [true, "Id number is required!"],
      unique: true,
    }, // ID number of the employee
    allEmployeeRoles: [
      {
        type: String,
        enum: employeeRoles,
        required: [true, "Employee role is required!"],
      },
    ], // all roles of the employee, can be multiple
    personalDetails: {
      type: personalDetailsSchema,
      required: [true, "Personal details is required!"],
    }, // personal details of the employee
    taxNumber: {
      type: String,
      required: [true, "Tax number is required!"],
      unique: true,
    }, // tax number of the employee
    joinDate: { type: Date, required: [true, "Join date is required!"] }, // date when the employee joined the business
    active: {
      type: Boolean,
      required: [true, "Active is required!"],
      default: true,
    }, // if the employee is active, could be a sesonality worker
    onDuty: {
      type: Boolean,
      required: [true, "On Duty is required!"],
      default: false,
    }, // if the employee is on duty, shift working right now
    vacationDaysPerYear: { type: Number }, // days of holidays per year
    vacationDaysLeft: { type: Number }, // days of holidays left
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true // indexing references is a performance optimization, speed queries that frequently filter by this field
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
    terminatedDate: {
      type: Date,
      validate: {
        validator: function (value: string) {
          // Allow terminatedDate to be null (employee still active)
          if (!value) return true;

          return value > this.joinDate; // Ensure terminatedDate is after joinDate
        },
        message: "Terminate date must be after join date!",
      },
    }, // date when the employee left the business
    notifications: {
      type: [
        {
          notificationId: {
            type: Schema.Types.ObjectId,
            ref: "Notification",
            index: true // indexing references is a performance optimization, speed queries that frequently filter by this field
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
