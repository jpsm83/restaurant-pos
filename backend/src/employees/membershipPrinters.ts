/**
 * Printer bindings for a membership.
 *
 * A blocked or soft-deleted membership loses its print allowances and its
 * exclusions so a later rehire does not inherit stale printer configuration.
 */
import type { ClientSession, Types } from "mongoose";

import Printer from "../models/printer.ts";

export async function removeMembershipFromPrinters(params: {
  businessId: Types.ObjectId | string;
  employeeId: string;
  session?: ClientSession;
}): Promise<void> {
  await Printer.updateMany(
    {
      businessId: params.businessId,
      $or: [
        { employeesAllowedToPrintDataIds: params.employeeId },
        {
          "configurationSetupToPrintOrders.excludeemployeeIds":
            params.employeeId,
        },
      ],
    },
    {
      $pull: {
        employeesAllowedToPrintDataIds: params.employeeId,
        "configurationSetupToPrintOrders.$[].excludeemployeeIds":
          params.employeeId,
      },
    },
    { session: params.session },
  );
}
