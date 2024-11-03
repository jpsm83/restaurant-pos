import { IEmployeeSchedule } from "@/app/lib/interface/ISchedule";

export const employeesValidation = (employee: IEmployeeSchedule) => {
  // check if the schedule is an array
  if (typeof employee !== "object" || employee === undefined) {
    return "Invalid employee object";
  }

  const validKeys = ["employeeId", "role", "timeRange"];

  // check required fields
  for (const key of validKeys) {
    const value = employee[key as keyof IEmployeeSchedule];

    if (!value) {
      return `${key} must have a value!`;
    }
  }

  // Check for any invalid keys
  for (const key of Object.keys(employee)) {
    if (key !== "vacation") {
      if (!validKeys.includes(key as keyof IEmployeeSchedule)) {
        return `Invalid key: ${key}`;
      }
    }
  }

  // check if timeRange has the required fields
  if (
    !employee.timeRange.startTime ||
    !employee.timeRange.endTime ||
    typeof employee.timeRange !== "object" ||
    employee.timeRange.startTime > employee.timeRange.endTime
  ) {
    return "Invalid timeRange object";
  }

  return true;
};
