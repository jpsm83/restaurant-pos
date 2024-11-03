import { Schema, model, models } from "mongoose";

const employeesScheduledSchema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
  }, // employee scheduled
  role: { type: String, required: true }, // role of the employee in the shift
  timeRange: {
    startTime: { type: Date, required: true }, // start time of the shift
    endTime: { type: Date, required: true }, // end time of the shift
  }, // time range of the shift
  vacation: { type: Boolean, default: false, required: true }, // if the employee is on vacation

  // not required from the front end
  // calculated in the back end
  shiftHours: {
    type: Number,
    required: true,
  }, // quantity of shift hours worked , startTime - endTime
  employeeCost: {
    type: Number,
    required: true,
  }, // cost of the employee for the shift, employee.grossMonthlySalary / employee.contractHoursMonth * shiftHours - calculated in the front end
});

const scheduleSchema = new Schema(
  {
    // required fields
    date: {
      type: Date,
      required: true,
    }, // date of the schedule without time
    weekNumber: { type: Number, required: true }, // week number of the year
    employeesSchedules: [employeesScheduledSchema],
    totalEmployeesScheduled: {
      type: Number,
      required: true,
      default: 0,
    }, // total employees scheduled
    totalEmployeesVacation: {
      type: Number,
      required: true,
      default: 0,
    }, // total employees on vacation
    totalDayEmployeesCost: {
      type: Number,
      required: true,
      default: 0,
    }, // sun of all employeeCost / scheduled and on vacation - REQUIERED FOR ANALYTICS
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    }, // business where the schedule is created

    // non reaquired fields
    comments: {
      type: String,
    }, // comments for the schedule, games, parties, events, etc
  },
  {
    timestamps: true,
  }
);

const Schedule = models.Schedule || model("Schedule", scheduleSchema);
export default Schedule;
