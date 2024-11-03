// Function to check if two time ranges overlap
const isScheduleOverlapping = (
  newStartTime: Date,
  newEndTime: Date,
  existTimeRangeArr: { startTime: Date; endTime: Date }[]
) => {
  let overlap = existTimeRangeArr.some((schedule) => {
    return (
      (newStartTime <= schedule.endTime &&
        newStartTime >= schedule.startTime) ||
      (newEndTime >= schedule.startTime && newEndTime <= schedule.endTime)
    );
  });

  if (overlap) {
    return true;
  } else {
    return false;
  }
};

export default isScheduleOverlapping;
