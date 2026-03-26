import { ClientSession, Types } from "mongoose";
import getEffectiveUserRoleAtTime from "../auth/getEffectiveUserRoleAtTime.ts";
import type { ReportTargetBucket } from "./applyOrderFinalizationToActorReport.ts";

interface ResolveFinalizationActorReportTargetInput {
  userId: Types.ObjectId;
  businessId: Types.ObjectId;
  salesPointType?: string;
  session?: ClientSession;
}

interface ResolveFinalizationActorReportTargetResult {
  targetBucket: ReportTargetBucket;
  employeeOnDuty: boolean;
}

const resolveFinalizationActorReportTarget = async (
  input: ResolveFinalizationActorReportTargetInput,
): Promise<ResolveFinalizationActorReportTargetResult> => {
  const effectiveRole = await getEffectiveUserRoleAtTime({
    userId: input.userId,
    businessId: input.businessId,
    session: input.session,
  });

  if (effectiveRole === "employee") {
    return { targetBucket: "employeesDailySalesReport", employeeOnDuty: true };
  }

  if (input.salesPointType === "delivery") {
    return { targetBucket: "deliveryDailySalesReport", employeeOnDuty: false };
  }

  return { targetBucket: "selfOrderingSalesReport", employeeOnDuty: false };
};

export default resolveFinalizationActorReportTarget;
