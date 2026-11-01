/**
 * Employee date rule — a named post-parse check for the employees routes.
 *
 * A terminated employee cannot leave before they joined; a same-day start and
 * end is valid. The DTOs coerce `joinDate` and `terminatedDate` to dates but
 * cannot express this cross-field rule. Returns `true` or a human-readable
 * reason.
 */
const validateEmployeeDates = (
  joinDate: Date,
  terminatedDate?: Date,
): true | string => {
  if (terminatedDate && terminatedDate < joinDate) {
    return "Terminate date must be on or after join date!";
  }

  return true;
};

export default validateEmployeeDates;
