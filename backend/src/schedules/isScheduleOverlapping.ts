export const isScheduleOverlapping = (
  newStartTime: Date,
  newEndTime: Date,
  existTimeRangeArr: { startTime: Date; endTime: Date }[]
): boolean => {
  const overlap = existTimeRangeArr.some((schedule) => {
    return (
      (newStartTime <= schedule.endTime &&
        newStartTime >= schedule.startTime) ||
      (newEndTime >= schedule.startTime && newEndTime <= schedule.endTime)
    );
  });

  return overlap;
};
