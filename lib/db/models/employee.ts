import { Schema, model, models } from "mongoose";
import { userRoles } from "@/lib/enums";
// import { personalDetailsSchema } from "./personalDetails";

const salarySchema = new Schema(
  {
    payFrequency: {
      type: String,
      enum: ["Hourly", "Daily", "Weekly", "Monthly"],
      required: [true, "Pay frequency is required!"],
    }, // frequency of the payment
    grossSalary: {
      type: Number,
      required: [true, "Gross salary is required!"],
    }, // hourly employee salary before taxes
    netSalary: { type: Number, required: [true, "Net salary is required!"] }, // net employee salary after taxes
  },
  {
    timestamps: true,
    trim: true,
  }
);

const employeeSchema = new Schema(
  {
    // personalDetails: {
    //   type: personalDetailsSchema,
    //   required: [true, "Personal details is required!"],
    // }, // personal details of the employee
    allEmployeeRoles: [
      {
        type: String,
        enum: userRoles,
        required: [true, "Employee role is required!"],
      },
    ], // all roles of the employee, can be multiple
    taxNumber: {
      type: String,
      required: [true, "Tax number is required!"],
      unique: true,
    }, // tax number of the employee
    joinDate: { type: Date, required: [true, "Join date is required!"] }, // date when the employee joined the business
    active: {
      type: Boolean,
      default: true,
    }, // if the employee is active, could be a sesonality worker
    onDuty: {
      type: Boolean,
      default: false,
    }, // if the employee is on duty, shift working right now
    vacationDaysPerYear: {
      type: Number,
      required: [true, "Vacations days per year is required!"],
    }, // days of holidays per year
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // business where the employee works
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // business where the employee works

    // optional fields
    vacationDaysLeft: { type: Number }, // days of holidays left
    currentShiftRole: { type: String, enum: userRoles }, // current shift role of the employee

    // *** IMPORTANTE ***
    // employee might input the contract hours per week as a whole hour number on the front of the application and them it will be converted to milliseconds
    contractHoursWeek: { type: Number }, // contract hours per week
    salary: { type: salarySchema }, // salary of the employee
    terminatedDate: {
      type: Date,
      validate: {
        validator: function (value: string) {
          // Allow terminatedDate to be null (employee still active)
          if (!value) return true;

          return value > (this as typeof employeeSchema.methods).joinDate; // Ensure terminatedDate is after joinDate
        },
        message: "Terminate date must be after join date!",
      },
    }, // date when the employee left the business
    documentsUrl: { type: [String] }, // photo of the employee documents as id, contract, tax, etc
    comments: { type: String }, // comments about the employee
    // notifications: {
    //   type: [
    //     {
    //       notificationId: {
    //         type: Schema.Types.ObjectId,
    //         ref: "Notification",
    //       },
    //       readFlag: { type: Boolean, default: false },
    //       deletedFlag: { type: Boolean, default: false },
    //     },
    //   ],
    //   default: undefined,
    // }, // if the customer wants to receive notifications
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Employee = models.Employee || model("Employee", employeeSchema);
export default Employee;
