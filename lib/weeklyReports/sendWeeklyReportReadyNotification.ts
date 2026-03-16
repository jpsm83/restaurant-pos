import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import Employee from "@/lib/db/models/employee";
import Notification from "@/lib/db/models/notification";
import { MANAGEMENT_ROLES } from "@/lib/constants";

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
      .select("_id")
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
    // Fire-and-forget: do not throw; avoid breaking calling flows.
  }
}

