import type { WeekDays } from "../../../lib/interface/IPromotion.ts";

const validateDaysOfTheWeek = (weekDays: WeekDays): true | string => {
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

  const allValid = weekDays.every((day) => daysOfTheWeek.includes(day));

  if (!allValid) {
    return `Invalid day(s) in the weekDays array!`;
  }
  return true;
};

export default validateDaysOfTheWeek;
