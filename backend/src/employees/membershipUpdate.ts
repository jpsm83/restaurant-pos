/**
 * Membership update planning.
 *
 * Builds the write payload for an edit from the stored membership and the
 * validated request fields. Keeps the field-by-field diff and the vacation
 * recalculation out of the HTTP route.
 */
import type { IEmployee } from "restaurant-pos-packages/interfaces/IEmployee";
import type { UpdateEmployeeRecordBody } from "restaurant-pos-packages/schemas/employee";

import calculateVacationProportional from "./calculateVacationProportional.ts";

export function planMembershipUpdate(params: {
  employee: IEmployee;
  fields: UpdateEmployeeRecordBody;
  terminatedDate?: Date;
}): Partial<IEmployee> {
  const { employee, fields, terminatedDate } = params;

  const changes: Partial<IEmployee> = {
    employmentStatus: fields.employmentStatus,
    allEmployeeRoles: fields.allEmployeeRoles,
  };

  if (fields.joinDate.getTime() !== employee.joinDate?.getTime())
    changes.joinDate = fields.joinDate;
  if (
    fields.taxNumber !== undefined &&
    fields.taxNumber !== employee.taxNumber
  )
    changes.taxNumber = fields.taxNumber;
  if (
    fields.vacationDaysPerYear !== undefined &&
    fields.vacationDaysPerYear !== employee.vacationDaysPerYear
  )
    changes.vacationDaysPerYear = fields.vacationDaysPerYear;
  if (terminatedDate) changes.terminatedDate = terminatedDate;
  if (
    fields.contractHoursWeek !== undefined &&
    fields.contractHoursWeek !== employee.contractHoursWeek
  )
    changes.contractHoursWeek = fields.contractHoursWeek;
  if (fields.comments !== undefined && fields.comments !== employee.comments)
    changes.comments = fields.comments;

  const salary = fields.salary;
  if (
    salary &&
    (salary.payFrequency !== employee.salary?.payFrequency ||
      salary.grossSalary !== employee.salary?.grossSalary ||
      salary.netSalary !== employee.salary?.netSalary)
  ) {
    changes.salary = salary;
  }

  const vacationDaysPerYear =
    fields.vacationDaysPerYear ?? employee.vacationDaysPerYear;
  const joinDateChanged =
    fields.joinDate.getTime() !== employee.joinDate?.getTime();
  const vacationChanged =
    fields.vacationDaysPerYear !== undefined &&
    fields.vacationDaysPerYear !== employee.vacationDaysPerYear;
  if (
    vacationDaysPerYear !== undefined &&
    (joinDateChanged || vacationChanged)
  ) {
    changes.vacationDaysLeft = calculateVacationProportional(
      fields.joinDate,
      vacationDaysPerYear,
    );
  }

  return changes;
}
