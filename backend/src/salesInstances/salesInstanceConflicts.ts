import { ClientSession, Types } from "mongoose";
import SalesInstance from "../models/salesInstance.ts";

type ConflictBaseParams = {
  salesPointId: Types.ObjectId;
  businessId: Types.ObjectId;
  session?: ClientSession;
  excludeSalesInstanceId?: Types.ObjectId;
};

/**
 * Employee flow "busy" rule (idea doc §1 and §2):
 * - A point is busy for employees if there exists an open SalesInstance
 *   on that salesPointId for that businessId where:
 *   - openedAsRole === "employee"
 *   - salesInstanceStatus != "Closed"
 *
 * Important: this rule is temporal ("at a time"), so it must NOT depend
 * on dailyReferenceNumber.
 */
export const pointBusyForEmployee = async (
  params: ConflictBaseParams,
): Promise<boolean> => {
  const { salesPointId, businessId, session, excludeSalesInstanceId } = params;

  const filter: Record<string, unknown> = {
    salesPointId,
    businessId,
    openedAsRole: "employee",
    salesInstanceStatus: { $ne: "Closed" },
  };

  if (excludeSalesInstanceId) {
    filter._id = { $ne: excludeSalesInstanceId };
  }

  const query = SalesInstance.exists(filter);
  if (session) {
    query.session(session);
  }

  return Boolean(await query);
};

/**
 * Customer self-order / QR customer busy rule (idea doc §2):
 * - Customer flows only conflict with employee-open instances.
 */
export const pointBusyForCustomerSelfOrder = async (
  params: ConflictBaseParams,
): Promise<boolean> => {
  return pointBusyForEmployee(params);
};

