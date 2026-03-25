import { Types } from "mongoose";
import type { WeekLabel } from "../../../packages/interfaces/IWeeklyBusinessReport.ts";
import dispatchEvent from "../communications/dispatchEvent.ts";

/**
 * Sends a notification to on-duty manager-level employees that a weekly
 * business report is ready. Fire-and-forget safe: does not throw.
 */
const sendWeeklyReportReadyNotification = async (
  businessId: Types.ObjectId,
  weekLabel: WeekLabel,
): Promise<void> => {
  try {
    await dispatchEvent(
      "WEEKLY_REPORT_READY",
      {
        businessId,
        weekLabel,
      },
      { fireAndForget: true },
    );
  } catch {
    // Fire-and-forget: do not throw; avoid breaking calling flows.
  }
};

export default sendWeeklyReportReadyNotification;
