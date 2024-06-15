import { Schema, model, models } from "mongoose";

const employeesScheduled = new Schema({
  employee: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, // employee scheduled
  role: { type: String, required: true }, // role of the employee in the shift
  timeRange: {
    startTime: { type: String, required: true }, // start time of the shift
    endTime: { type: String, required: true }, // end time of the shift
  }, // time range of the shift
  shiftHours: {
    type: Number,
    required: true,
  }, // quantity of shift hours worked , startTime - endTime
  weekHoursLeft: {
    type: Number,
    required: true,
  }, // hours left to work in the week, user.contractHoursWeek - ( sun of shiftHours of the week) - calculated in the front end
  employeeCost: {
    type: Number,
    required: true,
  }, // cost of the employee for the shift, user.grossMonthlySalary / user.contractHoursMonth * shiftHours - calculated in the front end
  vacation: { type: Boolean, default: false, required: true }, // if the employee is on vacation
  vacationDaysLeft: { type: Number, default: 0, required: true }, // days left for the employee to take vacation - ( user.vacationDaysPerYear - sun of vacation days taken in the year) - calculated in the front end
});

const scheduleSchema = new Schema(
  {
    // required fields
    date: {
      type: Date,
      required: true,
    }, // date of the schedule without time
    employees: {
      type: [employeesScheduled],
      required: true,
    },
    totalEmployeesScheduled: {
      type: Number,
      required: true,
    }, // total users scheduled
    totalDayEmployeesCost: {
      type: Number,
      required: true,
    }, // total daily employees, sun of all employeeCost - REQUIERED FOR ANALYTICS
    business: {
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
    minimize: false,
  }
);

const Schedule = models.Schedule || model("Schedule", scheduleSchema);

export default Schedule;