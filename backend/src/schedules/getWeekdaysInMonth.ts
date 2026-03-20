const getWeekdaysInMonth = (year: number, month: number): number => {
  let weekdays = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDay = new Date(year, month, day).getDay();
    if (currentDay !== 0 && currentDay !== 6) {
      weekdays++;
    }
  }
  return weekdays;
};

export default getWeekdaysInMonth;
