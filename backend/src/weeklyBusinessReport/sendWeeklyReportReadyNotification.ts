import { Types } from "mongoose";

import connectDb from "../db/connectDb.ts";
import Employee from "../models/employee.ts";
import Notification from "../models/notification.ts";
import User from "../models/user.ts";
import { managementRolesEnums } from "../../../lib/enums.ts";
import type { WeekLabel } from "../../../lib/interface/IWeeklyBusinessReport.ts";

/**
 * Sends a notification to on-duty manager-level employees that a weekly
 * business report is ready. Fire-and-forget safe: does not throw.
 */
const sendWeeklyReportReadyNotification = async (
  businessId: Types.ObjectId,
  weekLabel: WeekLabel,
): Promise<void> => {
  try {
    await connectDb();

    const managerEmployees = await Employee.find({
      businessId,
      onDuty: true,
      currentShiftRole: { $in: managementRolesEnums },
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
      const managerUserIds = managerEmployees
        .map((e) => e.userId)
        .filter(Boolean);

      await User.updateMany(
        { _id: { $in: managerUserIds } },
        {
          $push: {
            notifications: {
              notificationId: newNotification._id,
              // readFlag/deletedFlag default to false in the User schema
            },
          },
        },
      );
    }
  } catch {
    // Fire-and-forget: do not throw; avoid breaking calling flows.
  }
};

export default sendWeeklyReportReadyNotification;
