import { ISalary } from "@/app/lib/interface/IEmployee";

// Function to calculate employee cost
const calculateEmployeeCost = (
  salary: ISalary,
  shiftDurationMs: number,
  weekdaysInMonth: number
) => {
  const durationInHours = shiftDurationMs / 3600000;
  switch (salary.payFrequency) {
    case "Monthly":
      return salary.grossSalary / weekdaysInMonth;
    case "Weekly":
      return salary.grossSalary / 5; // Assuming 5 working days
    case "Daily":
      return salary.grossSalary;
    default:
      return salary.grossSalary * durationInHours;
  }
};

export default calculateEmployeeCost;