import { ClientSession, Types } from "mongoose";
import DailySalesReport from "../models/dailySalesReport.ts";
import { isObjectIdValid } from "../utils/isObjectIdValid.ts";

export async function createDailySalesReport(
  businessId: Types.ObjectId,
  session: ClientSession
): Promise<number | string> {
  try {
    if (isObjectIdValid([businessId]) !== true) return "Business ID not valid!";

    const currentTimeUnix = Date.now();
    const millisecondsInADay = 24 * 60 * 60 * 1000;
    const countdownToClose = currentTimeUnix + millisecondsInADay;

    const dailySalesReportObj = {
      dailyReferenceNumber: currentTimeUnix,
      isDailyReportOpen: true,
      timeCountdownToClose: countdownToClose,
      employeesDailySalesReport: [],
      selfOrderingSalesReport: [],
      businessId,
    };

    const dailySalesReport = await DailySalesReport.create([dailySalesReportObj], {
      session,
    });

    if (!dailySalesReport) return "Fail to create a daily sales report!";
    return dailySalesReport[0].dailyReferenceNumber as number;
  } catch (error) {
    return "Fail to create a daily sales report! " + error;
  }
}

