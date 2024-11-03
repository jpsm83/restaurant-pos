export const calculateVacationProportional = (
  joinDate: Date,
  vacationDaysPerYear: number
) => {
  if(vacationDaysPerYear === 0) return 0;
  // Assuming joinDate is a Date object and vacationDaysPerYear is already defined

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const joinYear = joinDate.getFullYear();

  let vacationDaysLeft;

  if (currentYear === joinYear) {
    // Calculate the day of the year for joinDate
    const startOfYear = new Date(joinYear, 0, 0);
    const diff = joinDate.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    // Calculate the proportion of the year that has passed
    const proportionOfYearPassed = dayOfYear / 365;

    // Calculate vacation days left based on the proportion of the year remaining
    vacationDaysLeft = Math.round(
      vacationDaysPerYear * (1 - proportionOfYearPassed)
    );
  } else {
    // If the employee joined in a previous year, they have the full vacation days available
    vacationDaysLeft = vacationDaysPerYear;
  }

  return vacationDaysLeft;
};
