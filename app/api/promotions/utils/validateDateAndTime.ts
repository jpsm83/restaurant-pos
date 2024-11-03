export const validateDateAndTime = (promotionPeriod: {
  start: Date;
  end: Date;
}) => {
  if (typeof promotionPeriod !== "object" || !promotionPeriod)
    return "The promotion period is required and must be an object!";

  if (
    promotionPeriod.hasOwnProperty("start") &&
    promotionPeriod.hasOwnProperty("end")
  ) {
    const startDate = new Date(promotionPeriod.start);
    const endDate = new Date(promotionPeriod.end);

    if (startDate >= endDate) {
      return "The start date must be before the end date.";
    }

    return true;
  }
  return "The promotion period must have a start and end valid date!";
};
