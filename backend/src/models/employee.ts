import mongoose, { Schema, model } from "mongoose";
import * as enums from "restaurant-pos-packages/enums";
import { applyActiveOnlySoftDelete, softDeleteSchemaFields } from "./softDelete.ts";

const {
  employeePayFrequencyEnums,
  userRolesEnums,
  employmentStatusEnums,
  activeEmploymentStatusEnums,
} = enums;

const ACTIVE_EMPLOYMENT_STATUSES = new Set(activeEmploymentStatusEnums);
const TERMINATED_STATUS = "Terminated";

function isActiveEmploymentStatus(status: string): boolean {
  return ACTIVE_EMPLOYMENT_STATUSES.has(status);
}

const salarySchema = new Schema(
  {
    payFrequency: {
      type: String,
      enum: employeePayFrequencyEnums,
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
  },
);

const employeeSchema = new Schema(
  {
    allEmployeeRoles: [
      {
        type: String,
        enum: userRolesEnums,
        required: [true, "Employee role is required!"],
      },
    ], // all roles of the employee, can be multiple
    taxNumber: {
      type: String,
      required: [true, "Tax number is required!"],
    }, // tax number of the employee
    joinDate: { type: Date, required: [true, "Join date is required!"] }, // date when the employee joined the business
    employmentStatus: {
      type: String,
      enum: employmentStatusEnums,
    }, // closed employment status; absent on legacy rows that predate it
    active: {
      type: Boolean,
      default: true,
    }, // server-derived compatibility mirror of employmentStatus
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
    currentShiftRole: { type: String, enum: userRolesEnums }, // current shift role of the employee

    // *** IMPORTANTE ***
    // employee might input the contract hours per week as a whole hour number on the front of the application and them it will be converted to milliseconds
    contractHoursWeek: { type: Number }, // contract hours per week
    salary: { type: salarySchema }, // salary of the employee
    terminatedDate: {
      type: Date,
      validate: {
        validator: function (value: string | Date) {
          // Allow terminatedDate to be null (employee still active)
          if (!value) return true;

          const joinDate = (this as { joinDate?: Date }).joinDate;
          // A same-day start and end is a valid termination.
          return !joinDate || new Date(value).getTime() >= joinDate.getTime();
        },
        message: "Terminate date must be on or after join date!",
      },
    }, // date when the employee left the business
    documentsUrl: { type: [String], default: undefined }, // photo of the employee documents as id, contract, tax, etc
    comments: { type: String }, // comments about the employee
    ...softDeleteSchemaFields,
  },
  { timestamps: true, trim: true },
);

/** Derive the compatibility mirror and termination-date invariant from status. */
employeeSchema.pre("validate", function () {
  const employee = this as unknown as {
    employmentStatus?: string;
    active?: boolean;
    terminatedDate?: Date;
    invalidate(path: string, message: string): void;
  };

  // Legacy rows without a stored status keep their active/terminatedDate facts.
  if (employee.employmentStatus == null) return;

  employee.active = isActiveEmploymentStatus(employee.employmentStatus);

  if (employee.employmentStatus === TERMINATED_STATUS) {
    if (!employee.terminatedDate) {
      employee.invalidate(
        "employmentStatus",
        "Termination date is required for a terminated employee!",
      );
    }
    return;
  }

  employee.terminatedDate = undefined;
});

/**
 * A query update that stores a status must also store the derived mirror and
 * clear a stale termination date. Document saves get the same rule from the
 * `validate` hook above.
 */
function deriveStatusOnUpdate(update: Record<string, unknown>): void {
  const set = update.$set as Record<string, unknown> | undefined;
  const status = set?.employmentStatus ?? update.employmentStatus;
  if (typeof status !== "string") return;

  const target = set ?? update;
  target.active = isActiveEmploymentStatus(status);

  if (status === TERMINATED_STATUS) return;

  delete target.terminatedDate;
  const unset = (update.$unset as Record<string, unknown> | undefined) ?? {};
  unset.terminatedDate = 1;
  update.$unset = unset;
}

employeeSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate() as Record<string, unknown> | null;
  if (update) deriveStatusOnUpdate(update);
});

employeeSchema.pre("updateOne", function () {
  const update = this.getUpdate() as Record<string, unknown> | null;
  if (update) deriveStatusOnUpdate(update);
});

employeeSchema.index(
  { businessId: 1, taxNumber: 1 },
  { unique: true, partialFilterExpression: { deleted: false } },
);

employeeSchema.index(
  { businessId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { deleted: false } },
);

applyActiveOnlySoftDelete(employeeSchema);

const Employee = mongoose.models.Employee || model("Employee", employeeSchema);
export default Employee;
