import DailySalesReport from "@/app/lib/models/dailySalesReport";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { ClientSession, Types } from "mongoose";

// add employee to daily sales report
export const addEmployeeToDailySalesReport = async (
  employeeId: Types.ObjectId,
  businessId: Types.ObjectId,
  session: ClientSession
) => {
  try {
    // validate ids
    if (isObjectIdValid([employeeId, businessId]) !== true) {
      return "Invalid employee or business ID!";
    }

    // Find the open daily sales report and add the employee in one operation
    const updatedDailySalesReport = await DailySalesReport.findOneAndUpdate(
      {
        isDailyReportOpen: true,
        businessId: businessId,
      },
      {
        $addToSet: { employeesDailySalesReport: { employeeId } }, // Avoid duplicates
      },
      { new: true, lean: true } // Return the updated document
    );

    // If no daily sales report found
    if (!updatedDailySalesReport) {
      return "Daily report not found!";
    }

    return true;
  } catch (error) {
    return "Failed to add employee to daily report! " + error;
  }
};
