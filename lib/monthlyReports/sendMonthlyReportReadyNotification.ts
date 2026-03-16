import { Types } from "mongoose";

import connectDb from "@/lib/db/connectDb";
import Employee from "@/lib/db/models/employee";
import Notification from "@/lib/db/models/notification";
import { MANAGEMENT_ROLES } from "@/lib/constants";

/**
 * Sends a notification to manager-level employees that a monthly
 * business report is ready to be reviewed. Fire-and-forget safe: does not throw.
 *
 * Unlike weekly notifications (which are scoped to on-duty managers),
 * monthly notifications are sent to all employees whose currentShiftRole
 * is a management role, regardless of on-duty flag, so owners/admins
 * not on shift are also informed.
 */
export async function sendMonthlyReportReadyNotification(
  businessId: Types.ObjectId,
  monthLabel: string
): Promise<void> {
  try {
    await connectDb();

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
    // Fire-and-forget: do not throw; avoid breaking calling flows.
  }
}

