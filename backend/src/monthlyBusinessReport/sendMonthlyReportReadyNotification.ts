/**
 * sendMonthlyReportReadyNotification - Notifies managers when monthly report is ready
 */

import { Types } from "mongoose";
import dispatchEvent from "../communications/dispatchEvent.ts";

const sentMonthlyReadyNotifications = new Set<string>();

const buildDedupKey = (businessId: Types.ObjectId, monthLabel: string): string =>
  `${businessId.toString()}::${monthLabel}`;

/**
 * Sends a notification to manager-level employees that a monthly
 * business report is ready to be reviewed. Fire-and-forget safe: does not throw.
 */
const sendMonthlyReportReadyNotification = async (
  businessId: Types.ObjectId,
  monthLabel: string,
): Promise<void> => {
  try {
    const dedupKey = buildDedupKey(businessId, monthLabel);
    if (sentMonthlyReadyNotifications.has(dedupKey)) return;

    await dispatchEvent(
      "MONTHLY_REPORT_READY",
      {
        businessId,
        monthLabel,
      },
      { fireAndForget: true }
    );

    sentMonthlyReadyNotifications.add(dedupKey);
  } catch {
    // Fire-and-forget: do not throw
  }
};

export default sendMonthlyReportReadyNotification;
