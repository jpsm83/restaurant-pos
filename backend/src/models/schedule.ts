import mongoose, { Schema, model } from "mongoose";

const employeesScheduledSchema = new Schema(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // employee scheduled
    role: { type: String, required: [true, "Role is required!"] }, // role of the employee in the shift
    timeRange: {
      startTime: {
        type: Date,
        required: [true, "Time range start time is required!"],
      }, // start time of the shift
      endTime: {
        type: Date,
        required: [true, "Time range end time is required!"],
      }, // end time of the shift
    }, // time range of the shift
    vacation: { type: Boolean, default: false }, // if the employee is on vacation

    // not required from the front end
    // calculated in the back end
    shiftHours: {
      type: Number,
      required: [true, "Shift hours is required!"],
    }, // quantity of shift hours worked , startTime - endTime
    employeeCost: {
      type: Number,
      required: [true, "Employee cost is required!"],
    }, // cost of the employee for the shift, employee.grossMonthlySalary / employee.contractHoursMonth * shiftHours - calculated in the front end
  },
  {
    timestamps: true,
    trim: true,
  }
);

const scheduleSchema = new Schema(
  {
    // required fields
    date: {
      type: Date,
      required: [true, "Date is required!"],
    }, // date of the schedule without time
    weekNumber: { type: Number, required: [true, "Week number is required!"] }, // week number of the year
    employeesSchedules: {
      type: [employeesScheduledSchema],
      default: undefined,
    }, // employees scheduled for the day
    totalEmployeesScheduled: {
      type: Number,
    }, // total employees scheduled
    totalEmployeesVacation: {
      type: Number,
    }, // total employees on vacation
    totalDayEmployeesCost: {
      type: Number,
    }, // sun of all employeeCost / scheduled and on vacation - REQUIERED FOR ANALYTICS
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business id is required!"],
      index: true, // indexing references is a performance optimization, speed queries that frequently filter by this field
    }, // business where the schedule is created

    // non reaquired fields
    comments: {
      type: String,
    }, // comments for the schedule, games, parties, events, etc
  },
  {
    timestamps: true,
    trim: true,
  }
);

const Schedule = mongoose.models.Schedule || model("Schedule", scheduleSchema);
export default Schedule;
