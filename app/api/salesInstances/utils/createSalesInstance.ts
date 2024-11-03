import { ClientSession } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { addEmployeeToDailySalesReport } from "../../dailySalesReports/utils/addEmployeeToDailySalesReport";

// imported interfaces
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import SalesInstance from "@/app/lib/models/salesInstance";

export const createSalesInstance = async (
  newSalesInstanceObj: ISalesInstance,
  session: ClientSession
) => {
  try {
    const requiredKeys = [
      "dailyReferenceNumber",
      "salesPointId",
      "guests",
      "salesInstanceStatus",
      "businessId",
    ];

    // check required fields
    for (const key of requiredKeys) {
      if (!(key in newSalesInstanceObj)) {
        return `${key} is missing!`;
      }
    }

    const { dailyReferenceNumber, openedByEmployeeId, businessId } =
      newSalesInstanceObj;

    // connect before first call to DB
    await connectDb();

    if (openedByEmployeeId) {
      // Check if the employee exists in the dailySalesReport
      if (
        !(await DailySalesReport.exists({
          dailyReferenceNumber: dailyReferenceNumber,
          businessId: businessId,
          "employeesDailySalesReport.employeeId": openedByEmployeeId,
        }))
      ) {
        const addEmployeeToDailySalesReportResult =
          await addEmployeeToDailySalesReport(
            openedByEmployeeId,
            businessId,
            session
          );

        if (addEmployeeToDailySalesReportResult !== true) {
          return addEmployeeToDailySalesReportResult;
        }
      }
    }

    // Create the sales instance and return it
    const newSalesInstance = await SalesInstance.create(newSalesInstanceObj, {
      session,
    });

    if (!newSalesInstance) {
      return "Create sales instance failed!";
    }

    return newSalesInstance;
  } catch (error) {
    return "Create sales instance failed!";
  }
};
