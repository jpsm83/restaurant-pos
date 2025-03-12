export const calculateVacationProportional = (
  joinDate: Date,
  vacationDaysPerYear: number
) => {
  if (vacationDaysPerYear === 0) return 0;

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const joinYear = joinDate.getFullYear();

  // If the join date is in the future, return 0
  if (joinDate > currentDate) return 0;

  let vacationDaysLeft: number;

  if (currentYear === joinYear) {
    // Get the number of days in the current year (account for leap years)
    const daysInYear =
      new Date(joinYear, 1, 29).getMonth() === 1 ? 366 : 365;

    // Calculate the day of the year for joinDate
    const startOfYear = new Date(joinYear, 0, 1);
    const dayOfYear = Math.floor(
      (joinDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate the proportion of the year remaining
    const proportionOfYearRemaining = (daysInYear - dayOfYear) / daysInYear;

    // Calculate vacation days left
    vacationDaysLeft = Math.round(vacationDaysPerYear * proportionOfYearRemaining);
  } else {
    // If the employee joined in a previous year, they have the full vacation days available
    vacationDaysLeft = vacationDaysPerYear;
  }

  return vacationDaysLeft;
};
