/**
 * sendMonthlyReportReadyNotification - Notifies managers when monthly report is ready
 */

import { Types } from "mongoose";
import Employee from "../models/employee.ts";
import User from "../models/user.ts";
import Notification from "../models/notification.ts";
import { MANAGEMENT_ROLES } from "../utils/constants.ts";

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
      .select("_id userId")
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
      const managerUserIds = managerEmployees.map((e) => e.userId).filter(Boolean);

      await User.updateMany(
        { _id: { $in: managerUserIds } },
        {
          $push: {
            notifications: {
              notificationId: newNotification._id,
              // readFlag/deletedFlag default to false in the User schema
            },
          },
        }
      );
    }
  } catch {
    // Fire-and-forget: do not throw
  }
}
