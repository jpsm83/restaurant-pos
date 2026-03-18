export const getWeekNumber = (date: Date): number => {
  const dateCopy = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );

  dateCopy.setUTCDate(dateCopy.getUTCDate() + 4 - (dateCopy.getUTCDay() || 7));

  const yearStart = new Date(Date.UTC(dateCopy.getUTCFullYear(), 0, 1));

  const weekNo = Math.ceil(
    ((dateCopy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  const year = dateCopy.getUTCFullYear();

  return parseInt(`${year}${weekNo}`);
};
