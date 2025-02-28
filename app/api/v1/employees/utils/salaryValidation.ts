import { ISalary } from "@/app/lib/interface/IEmployee";

const salaryValidation = (salary: ISalary) => {
  const validKeys = ["payFrequency", "grossSalary", "netSalary"];
  const frequency = ["Hourly", "Daily", "Weekly", "Monthly"];

  for (const key of Object.keys(salary)) {
    if (!validKeys.includes(key)) {
      return `Invalid key: ${key}`;
    }
  }

  for (const key of validKeys) {
    if (!salary[key as keyof ISalary]) {
      return `${key} must have a value!`;
    }
    if (salary.payFrequency) {
      if (!frequency.includes(salary.payFrequency)) {
        return `Invalid pay frequency: ${salary.payFrequency}`;
      }
    }
  }
  return true;
};
export default salaryValidation;
