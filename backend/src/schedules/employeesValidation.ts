/**
 * The client-settable shape this guard inspects. It is deliberately permissive:
 * the route calls the guard *after* the zod DTO has parsed, so the DTO owns
 * field presence, types and unknown-key rejection. The guard's job is the
 * cross-field `startTime <= endTime` rule (and keeping the legacy invalid-key
 * defence for any non-HTTP caller).
 */
export interface EmployeeScheduleInput {
  employeeId?: unknown;
  role?: unknown;
  timeRange?: { startTime?: unknown; endTime?: unknown };
  vacation?: unknown;
}

const employeesValidation = (
  employee: EmployeeScheduleInput,
): true | string => {
  if (typeof employee !== "object" || employee === undefined) {
    return "Invalid employee object";
  }

  const validKeys = ["employeeId", "role", "timeRange"];

  for (const key of validKeys) {
    const value = (employee as Record<string, unknown>)[key];
    if (!value) {
      return `${key} must have a value!`;
    }
  }

  for (const key of Object.keys(employee)) {
    if (key !== "vacation") {
      if (!validKeys.includes(key)) {
        return `Invalid key: ${key}`;
      }
    }
  }

  const timeRange = employee.timeRange;
  if (
    !timeRange?.startTime ||
    !timeRange?.endTime ||
    typeof timeRange !== "object" ||
    (timeRange.startTime as Date) > (timeRange.endTime as Date)
  ) {
    return "Invalid timeRange object";
  }

  return true;
};

export default employeesValidation;
