/**
 * sendMonthlyReportReadyNotification - Notifies managers when monthly report is ready
 */

import { Types } from "mongoose";
import Employee from "../models/employee.js";
import Notification from "../models/notification.js";
import { MANAGEMENT_ROLES } from "../utils/constants.js";

/**
 * Sends a notification to manager-level employees that a monthly
 * business report is ready to be reviewed. Fire-and-forget safe: does not throw.
 */
export async function sendMonthlyReportReadyNotification(
  businessId: Types.ObjectId,
  monthLabel: string
): Promise<void> {
  try {
    const managerEmployees = await Employee.find({
      businessId,
      currentShiftRole: { $in: MANAGEMENT_ROLES },
    })
      .select("_id")
      .lean();

    if (!managerEmployees?.length) return;

    const message = `Monthly business report for ${monthLabel} is ready to be reviewed.`;

    const [newNotification] = await Notification.create([
      {
        notificationType: "Info",
        message,
        employeesRecipientsIds: managerEmployees.map((e) => e._id),
        businessId,
      },
    ]);

    if (newNotification) {
      await Employee.updateMany(
        { _id: { $in: managerEmployees.map((e) => e._id) } },
        {
          $push: {
            notifications: {
              notificationId: newNotification._id,
            },
          },
        }
      );
    }
  } catch {
    // Fire-and-forget: do not throw
  }
}
