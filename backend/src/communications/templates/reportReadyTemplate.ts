const buildMonthlyReportReadyTemplate = (monthLabel: string): string =>
  `Monthly business report for ${monthLabel} is ready to be reviewed.`;

const buildWeeklyReportReadyTemplate = (weekLabel: string): string =>
  `Weekly business report for ${weekLabel} is ready.`;

export { buildMonthlyReportReadyTemplate, buildWeeklyReportReadyTemplate };

