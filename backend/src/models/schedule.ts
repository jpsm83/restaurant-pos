import { Schema, model } from "mongoose";

const employeesScheduledSchema = new Schema(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee id is required!"],
      index: true,
    },
    role: { type: String, required: [true, "Role is required!"] },
    timeRange: {
      startTime: {
        type: Date,
        required: [true, "Time range start time is required!"],
      },
      endTime: {
        type: Date,
        required: [true, "Time range end time is required!"],
      },
    },
    vacation: { type: Boolean, default: false },
    shiftHours: {
      type: Number,
      required: [true, "Shift hours is required!"],
    },
    employeeCost: {
      type: Number,
      required: [true, "Employee cost is required!"],
    },
  },
  {
    timestamps: true,
    trim: true,
  }
);

const scheduleSchema = new Schema(
  {
    date: {
      type: Date,
      required: [true, "Date is required!"],
    },
    weekNumber: { type: Number, required: [true, "Week number is required!"] },
    employeesSchedules: {
      type: [employeesScheduledSchema],
      default: undefined,
    },
    totalEmployeesScheduled: {
      type: Number,
    },
    totalEmployeesVacation: {
      type: Number,
    },
    totalDayEmployeesCost: {
      type: Number,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true,
    },
    comments: {
      type: String,
    },
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Schedule = model("Schedule", scheduleSchema);
export default Schedule;
