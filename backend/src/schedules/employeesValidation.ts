import type { IEmployeeSchedule } from "@shared/interfaces/ISchedule";

export const employeesValidation = (employee: IEmployeeSchedule): true | string => {
  if (typeof employee !== "object" || employee === undefined) {
    return "Invalid employee object";
  }

  const validKeys = ["employeeId", "role", "timeRange"];

  for (const key of validKeys) {
    const value = employee[key as keyof IEmployeeSchedule];
    if (!value) {
      return `${key} must have a value!`;
    }
  }

  for (const key of Object.keys(employee)) {
    if (key !== "vacation") {
      if (!validKeys.includes(key as keyof IEmployeeSchedule)) {
        return `Invalid key: ${key}`;
      }
    }
  }

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
