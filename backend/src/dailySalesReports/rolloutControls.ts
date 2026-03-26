import { Types } from "mongoose";

type IncrementalEngineMode = "on" | "off" | "business-list";

const parseMode = (): IncrementalEngineMode => {
  const raw = (process.env.DAILY_SALES_INCREMENTAL_ENGINE_MODE ?? "on")
    .trim()
    .toLowerCase();
  if (raw === "off") return "off";
  if (raw === "business-list") return "business-list";
  return "on";
};

const parseBusinessAllowList = (): Set<string> => {
  const raw = process.env.DAILY_SALES_INCREMENTAL_BUSINESS_IDS ?? "";
  const list = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return new Set(list);
};

export const isIncrementalEngineEnabledForBusiness = (
  businessId: Types.ObjectId,
): boolean => {
  const mode = parseMode();
  if (mode === "on") return true;
  if (mode === "off") return false;
  const allowList = parseBusinessAllowList();
  return allowList.has(String(businessId));
};

export const isAggregateMismatchCheckEnabled = (): boolean =>
  (process.env.DAILY_SALES_AGGREGATE_MISMATCH_CHECK ?? "false")
    .trim()
    .toLowerCase() === "true";

