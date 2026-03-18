import type { ISalary } from "@shared/interfaces/IEmployee";

export const calculateEmployeeCost = (
  salary: ISalary,
  shiftDurationMs: number,
  weekdaysInMonth: number
): number => {
  const durationInHours = shiftDurationMs / 3600000;
  switch (salary.payFrequency) {
    case "Monthly":
      return salary.grossSalary / weekdaysInMonth;
    case "Weekly":
      return salary.grossSalary / 5;
    case "Daily":
      return salary.grossSalary;
    default:
      return salary.grossSalary * durationInHours;
  }
};
