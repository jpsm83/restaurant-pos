import { ClientSession, Types } from "mongoose";
import type { ISalesInstance } from "../../../packages/interfaces/ISalesInstance.ts";
import SalesInstance from "../models/salesInstance.ts";
import DailySalesReport from "../models/dailySalesReport.ts";
import { isTransientMongoClusterError } from "../mongo/transientClusterError.ts";

const createSalesInstance = async (
  newSalesInstanceObj: ISalesInstance,
  session: ClientSession
): Promise<unknown | string> => {
  try {
    const requiredKeys = [
      "dailyReferenceNumber",
      "salesPointId",
      "guests",
      "salesInstanceStatus",
      "businessId",
    ];

    for (const key of requiredKeys) {
      if (
        !(key in (newSalesInstanceObj as unknown as Record<string, unknown>))
      ) {
        return `${key} is missing!`;
      }
    }

    const { dailyReferenceNumber, openedByUserId, openedAsRole, businessId } =
      newSalesInstanceObj;

    if (openedByUserId && openedAsRole === "employee") {
      const exists = await DailySalesReport.exists({
        dailyReferenceNumber,
        businessId,
        "employeesDailySalesReport.userId": openedByUserId as unknown as Types.ObjectId,
      }).session(session);

      if (!exists) {
        await DailySalesReport.updateOne(
          { dailyReferenceNumber, businessId },
          {
            $push: {
              employeesDailySalesReport: {
                userId: openedByUserId,
                hasOpenSalesInstances: true,
              },
            },
          },
          { session }
        );
      }
    }

    const newSalesInstance = await SalesInstance.create([newSalesInstanceObj], {
      session,
    });

    if (!newSalesInstance?.length) return "Create sales instance failed!";

    return newSalesInstance[0];
  } catch (error) {
    if (isTransientMongoClusterError(error)) {
      throw error;
    }
    return "Create sales instance failed! " + error;
  }
};

export default createSalesInstance;