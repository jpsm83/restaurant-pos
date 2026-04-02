import { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import type { CommunicationsEventName } from "../types.ts";
import resolveAllManagers from "./resolveAllManagers.ts";
import resolveOnDutyManagers from "./resolveOnDutyManagers.ts";

export type ManagerRecipientPolicy = "onDutyManagers" | "allManagers";

const POLICY_BY_EVENT: Partial<Record<CommunicationsEventName, ManagerRecipientPolicy>> = {
  RESERVATION_PENDING: "onDutyManagers",
  LOW_STOCK_ALERT: "onDutyManagers",
  MONTHLY_REPORT_READY: "allManagers",
  WEEKLY_REPORT_READY: "allManagers",
  BUSINESS_PROFILE_UPDATED: "allManagers",
};

const POLICY_OVERRIDE_ENV_BY_EVENT: Partial<Record<CommunicationsEventName, string>> =
  {
    RESERVATION_PENDING: "RESERVATION_PENDING_MANAGER_POLICY",
    LOW_STOCK_ALERT: "LOW_STOCK_MANAGER_POLICY",
    MONTHLY_REPORT_READY: "MONTHLY_REPORT_MANAGER_POLICY",
    WEEKLY_REPORT_READY: "WEEKLY_REPORT_MANAGER_POLICY",
    BUSINESS_PROFILE_UPDATED: "BUSINESS_PROFILE_UPDATED_MANAGER_POLICY",
  };

const getPolicyOverride = (
  eventName?: CommunicationsEventName
): ManagerRecipientPolicy | undefined => {
  if (!eventName) return undefined;
  const envKey = POLICY_OVERRIDE_ENV_BY_EVENT[eventName];
  if (!envKey) return undefined;

  const raw = process.env[envKey]?.trim();
  if (!raw) return undefined;
  if (raw === "onDutyManagers" || raw === "allManagers") return raw;
  return undefined;
};

export const getManagerRecipientPolicy = (
  eventName?: CommunicationsEventName
): ManagerRecipientPolicy => {
  return getPolicyOverride(eventName) ??
    (eventName ? POLICY_BY_EVENT[eventName] : undefined) ??
    "onDutyManagers";
};

export const resolveManagersByPolicy = async (input: {
  businessId: Types.ObjectId;
  eventName?: CommunicationsEventName;
  session?: ClientSession;
}) => {
  const policy = getManagerRecipientPolicy(input.eventName);
  if (policy === "allManagers") {
    return resolveAllManagers(input.businessId, input.session);
  }
  return resolveOnDutyManagers(input.businessId, input.session);
};

