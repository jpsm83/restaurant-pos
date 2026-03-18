import { ClientSession } from "mongoose";

// imported utils
import connectDb from "@/lib/db/connectDb";
import { addUserToDailySalesReport } from "../../dailySalesReports/utils/addEmployeeToDailySalesReport";

// imported interfaces
import { ISalesInstance } from "@shared/interfaces/ISalesInstance";

// imported models
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import SalesInstance from "@/lib/db/models/salesInstance";

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

    for (const key of requiredKeys) {
      if (!(key in newSalesInstanceObj)) {
        return `${key} is missing!`;
      }
    }

    const {
      dailyReferenceNumber,
      openedByUserId,
      openedAsRole,
      businessId,
      responsibleByUserId,
    } = newSalesInstanceObj;

    await connectDb();

    if (openedByUserId && openedAsRole === "employee") {
      const exists = await DailySalesReport.exists({
        dailyReferenceNumber,
        businessId,
        "employeesDailySalesReport.userId": openedByUserId,
      });
      if (!exists) {
        const addResult = await addUserToDailySalesReport(
          openedByUserId,
          businessId,
          session
        );
        if (addResult !== true) {
          return addResult;
        }
      }
    }

    if (responsibleByUserId) {
      const responsibleExists = await DailySalesReport.exists({
        dailyReferenceNumber,
        businessId,
        "employeesDailySalesReport.userId": responsibleByUserId,
      });
      if (!responsibleExists) {
        const addResult = await addUserToDailySalesReport(
          responsibleByUserId,
          businessId,
          session
        );
        if (addResult !== true) {
          return addResult;
        }
      }
    }

    const newSalesInstance = await SalesInstance.create(newSalesInstanceObj, {
      session,
    });

    if (!newSalesInstance) {
      return "Create sales instance failed!";
    }

    return newSalesInstance;
  } catch (error) {
    return "Create sales instance failed! " + error;
  }
};
