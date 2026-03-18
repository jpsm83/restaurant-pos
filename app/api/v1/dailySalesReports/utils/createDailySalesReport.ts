import { ClientSession, Types } from "mongoose";

// imported utils
import isObjectIdValid from "@/lib/utils/isObjectIdValid";

// imported models
import DailySalesReport from "@/lib/db/models/dailySalesReport";
import Business from "@/lib/db/models/business";
import WeeklyBusinessReport from "@/lib/db/models/weeklyBusinessReport";

// imported interfaces
import { IDailySalesReport } from "@shared/interfaces/IDailySalesReport";
import connectDb from "@/lib/db/connectDb";

import { aggregateDailyReportsIntoWeekly } from "@/app/api/v1/weeklyBusinessReport/utils/aggregateDailyReportsIntoWeekly";
import { getWeekReference } from "@/app/api/v1/weeklyBusinessReport/utils/createWeeklyBusinessReport";
import { sendWeeklyReportReadyNotification } from "@/lib/weeklyReports/sendWeeklyReportReadyNotification";

// this function will create daily report if not exists
// it will be imported to be used on the salesInstance route
// if a sales instance is created and the daily report is not opened or doesnt exist it will create one
export const createDailySalesReport = async (
  businessId: Types.ObjectId,
  session: ClientSession
) => {
  try {
    // check required fields
    if (isObjectIdValid([businessId]) !== true) {
      return "Business ID not valid!";
    }

    // get current date with real time to be the dailyReferenceNumber
    const currentTimeUnix = Date.now();
    const currentDate = new Date(currentTimeUnix);

    // miliseconds in a day - this will be add to the currentTimeUnix to create the timeCountdownToClose - 1 day from the current date to be the time to close the daily report
    const millisecondsInADay = 24 * 60 * 60 * 1000;
    const countdownToClose = currentTimeUnix + millisecondsInADay;

    // connect before first call to DB
    await connectDb();

    // load business to determine weekly reporting configuration
    const business = await Business.findById(businessId)
      .select("reportingConfig.weeklyReportStartDay")
      .lean() as { reportingConfig?: { weeklyReportStartDay?: number } } | null;

    const weeklyReportStartDay =
      business?.reportingConfig?.weeklyReportStartDay ?? 1; // default Monday

    // Compute current and previous week references
    const currentWeekReference = getWeekReference(
      currentDate,
      weeklyReportStartDay
    );
    const previousWeekDate = new Date(currentWeekReference);
    previousWeekDate.setDate(previousWeekDate.getDate() - 1);
    const previousWeekReference = getWeekReference(
      previousWeekDate,
      weeklyReportStartDay
    );

    // If there is an open weekly report for the previous week, aggregate and close it
    const previousWeekOpen = await WeeklyBusinessReport.findOne({
      businessId,
      weekReference: previousWeekReference,
      isReportOpen: true,
    })
      .select("_id")
      .session(session)
      .lean();

    if (previousWeekOpen) {
      try {
        await aggregateDailyReportsIntoWeekly(
          businessId,
          previousWeekReference,
          weeklyReportStartDay
        );
        await WeeklyBusinessReport.updateOne(
          { _id: previousWeekOpen._id },
          { $set: { isReportOpen: false } },
          { session }
        );
        const weekLabel = `${previousWeekReference.toISOString().slice(0, 10)} to ${currentWeekReference
          .toISOString()
          .slice(0, 10)}`;
        await sendWeeklyReportReadyNotification(businessId, weekLabel);
      } catch (error) {
        // If weekly aggregation fails, we still allow the daily report to be created;
        // errors can be logged by the caller/monitoring layer.
        console.error(
          "Weekly report aggregation/close failed when creating daily report:",
          error
        );
      }
    }

    // create daily report object
    const dailySalesReportObj: IDailySalesReport = {
      dailyReferenceNumber: currentTimeUnix, // This should be a valid number
      isDailyReportOpen: true,
      timeCountdownToClose: countdownToClose,
      employeesDailySalesReport: [],
      selfOrderingSalesReport: [],
      businessId: businessId,
    };

    const dailySalesReport = await DailySalesReport.create(
      [dailySalesReportObj],
      { session }
    );

    if (!dailySalesReport) {
      return "Fail to create a deily sales report!";
    }

    // return daily reference number
    return dailySalesReport[0].dailyReferenceNumber;
  } catch (error) {
    return "Fail to create a deily sales report! " + error;
  }
};
