/**
 * Salary shape check — a named post-parse check for the employees routes.
 *
 * The `salary` field arrives JSON-encoded in the multipart body; the DTO parses
 * it into an object but leaves the shape to this guard. It mirrors the fields
 * the `salary` subdocument requires: exactly `payFrequency`, `grossSalary` and
 * `netSalary`, each present with a value, and a pay frequency from
 * `employeePayFrequencyEnums`. Returns `true` or a human-readable reason.
 */
import { employeePayFrequencyEnums } from "../../../packages/enums.ts";

const requiredSalaryFields = ["payFrequency", "grossSalary", "netSalary"];

const validateSalary = (salary: unknown): true | string => {
  if (typeof salary !== "object" || salary === null) {
    return "Salary must be a non-null object!";
  }

  const record = salary as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!requiredSalaryFields.includes(key)) {
      return `Invalid key: ${key}`;
    }
    if (!record[key]) {
      return `${key} must have a value!`;
    }
  }

  for (const key of requiredSalaryFields) {
    if (!(key in record)) {
      return `Missing key: ${key}`;
    }
  }

  if (
    !(employeePayFrequencyEnums as readonly string[]).includes(
      record.payFrequency as string,
    )
  ) {
    return "Invalid pay frequency!";
  }

  return true;
};

export default validateSalary;
