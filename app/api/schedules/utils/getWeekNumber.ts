export const getWeekNumber = (date: Date) => {
  // This function calculates the week number of the year starting on Monday, following the ISO 8601 standard

  // Create a copy of the date object to avoid modifying the original date
  const dateCopy = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );

  // Set the dateCopy to the nearest Thursday (current date + 4 - day number from Sunday)
  dateCopy.setUTCDate(dateCopy.getUTCDate() + 4 - (dateCopy.getUTCDay() || 7));

  // Get the first day of the year
  const yearStart = new Date(Date.UTC(dateCopy.getUTCFullYear(), 0, 1));

  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil(
    ((dateCopy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  // Get the full year from the dateCopy
  const year = dateCopy.getUTCFullYear();

  // Return the year followed by the week number as a single number
  return parseInt(`${year}${weekNo}`);
};
