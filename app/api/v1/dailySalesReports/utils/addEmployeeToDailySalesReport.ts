import DailySalesReport from "@/lib/db/models/dailySalesReport";
import isObjectIdValid from "@/lib/utils/isObjectIdValid";
import { ClientSession, Types } from "mongoose";

// add user (employee role) to daily sales report
export const addUserToDailySalesReport = async (
  userId: Types.ObjectId,
  businessId: Types.ObjectId,
  session: ClientSession
) => {
  try {
    // validate ids
    if (isObjectIdValid([userId, businessId]) !== true) {
      return "Invalid user or business ID!";
    }

    // Find the open daily sales report and add the user in one operation
    const updatedDailySalesReport = await DailySalesReport.findOneAndUpdate(
      {
        isDailyReportOpen: true,
        businessId: businessId,
      },
      {
        $addToSet: { employeesDailySalesReport: { userId } }, // Avoid duplicates
      },
      { new: true, lean: true } // Return the updated document
    ).session(session);

    // If no daily sales report found
    if (!updatedDailySalesReport) {
      return "Daily report not found!";
    }

    return true;
  } catch (error) {
    return "Failed to add user to daily report! " + error;
  }
};
