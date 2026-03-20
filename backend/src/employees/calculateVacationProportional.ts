const calculateVacationProportional = (
  joinDate: Date,
  vacationDaysPerYear: number
): number => {
  if (vacationDaysPerYear === 0) return 0;

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const joinYear = joinDate.getFullYear();

  if (joinDate > currentDate) return 0;

  let vacationDaysLeft: number;

  if (currentYear === joinYear) {
    const daysInYear =
      new Date(joinYear, 1, 29).getMonth() === 1 ? 366 : 365;

    const startOfYear = new Date(joinYear, 0, 1);
    const dayOfYear = Math.floor(
      (joinDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    );

    const proportionOfYearRemaining = (daysInYear - dayOfYear) / daysInYear;

    vacationDaysLeft = Math.round(vacationDaysPerYear * proportionOfYearRemaining);
  } else {
    vacationDaysLeft = vacationDaysPerYear;
  }

  return vacationDaysLeft;
};

export default calculateVacationProportional;