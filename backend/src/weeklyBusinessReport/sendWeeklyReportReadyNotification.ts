import { Types } from "mongoose";

import connectDb from "../db/connectDb.ts";
import Employee from "../models/employee.ts";
import Notification from "../models/notification.ts";
import User from "../models/user.ts";
import { MANAGEMENT_ROLES } from "../utils/constants.ts";

/**
 * Sends a notification to on-duty manager-level employees that a weekly
 * business report is ready. Fire-and-forget safe: does not throw.
 */
export async function sendWeeklyReportReadyNotification(
  businessId: Types.ObjectId,
  weekLabel: string
): Promise<void> {
  try {
    await connectDb();

    const managerEmployees = await Employee.find({
      businessId,
      onDuty: true,
      currentShiftRole: { $in: MANAGEMENT_ROLES },
    })
      .select("_id userId")
      .lean();

    if (!managerEmployees?.length) return;

    const message = `Weekly business report for ${weekLabel} is ready.`;

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
    // Fire-and-forget: do not throw; avoid breaking calling flows.
  }
}

