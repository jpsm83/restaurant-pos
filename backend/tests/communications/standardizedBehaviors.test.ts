import { afterEach, describe, expect, it } from "vitest";
import { getManagerRecipientPolicy } from "../../src/communications/recipientResolvers/managerRecipientPolicy.ts";

const clearPolicyEnv = () => {
  delete process.env.RESERVATION_PENDING_MANAGER_POLICY;
  delete process.env.LOW_STOCK_MANAGER_POLICY;
  delete process.env.WEEKLY_REPORT_MANAGER_POLICY;
  delete process.env.MONTHLY_REPORT_MANAGER_POLICY;
  delete process.env.BUSINESS_PROFILE_UPDATED_MANAGER_POLICY;
};

describe("Standardized communications behaviors", () => {
  afterEach(() => {
    clearPolicyEnv();
  });

  it("uses standardized default manager policy matrix", () => {
    clearPolicyEnv();
    expect(getManagerRecipientPolicy("RESERVATION_PENDING")).toBe("onDutyManagers");
    expect(getManagerRecipientPolicy("LOW_STOCK_ALERT")).toBe("onDutyManagers");
    expect(getManagerRecipientPolicy("WEEKLY_REPORT_READY")).toBe("allManagers");
    expect(getManagerRecipientPolicy("MONTHLY_REPORT_READY")).toBe("allManagers");
    expect(getManagerRecipientPolicy("BUSINESS_PROFILE_UPDATED")).toBe("allManagers");
  });

  it("supports per-event manager policy overrides", () => {
    process.env.RESERVATION_PENDING_MANAGER_POLICY = "allManagers";
    process.env.LOW_STOCK_MANAGER_POLICY = "allManagers";
    process.env.WEEKLY_REPORT_MANAGER_POLICY = "onDutyManagers";
    process.env.MONTHLY_REPORT_MANAGER_POLICY = "onDutyManagers";
    process.env.BUSINESS_PROFILE_UPDATED_MANAGER_POLICY = "onDutyManagers";

    expect(getManagerRecipientPolicy("RESERVATION_PENDING")).toBe("allManagers");
    expect(getManagerRecipientPolicy("LOW_STOCK_ALERT")).toBe("allManagers");
    expect(getManagerRecipientPolicy("WEEKLY_REPORT_READY")).toBe("onDutyManagers");
    expect(getManagerRecipientPolicy("MONTHLY_REPORT_READY")).toBe("onDutyManagers");
    expect(getManagerRecipientPolicy("BUSINESS_PROFILE_UPDATED")).toBe("onDutyManagers");
  });
});
