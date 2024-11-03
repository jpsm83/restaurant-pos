export const validateDaysOfTheWeek = (weekDays: string[]) => {
  if (!Array.isArray(weekDays) || !weekDays || weekDays.length === 0)
    return "WeekDaysis required and must be an array of days of the week!";

  const daysOfTheWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // validate weekDays
  const allValid = weekDays.every((day) => daysOfTheWeek.includes(day));

  if (!allValid) {
    return `Invalid day(s) in the weekDays array!`;
  }
  return true;
};
