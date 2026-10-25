/**
 * Deliver weekly and monthly report-ready on the rail without undoing the
 * report (issue #165).
 *
 * Caller-regression seam: the one delivery operation
 * `notificationService.createAndDeliver` (the same rail a hand-created
 * notification uses) is mocked, and the email channel is spied. The tests
 * assert that WEEKLY_REPORT_READY and MONTHLY_REPORT_READY each use that
 * delivery operation once, for the managers already resolved for that event,
 * with the stored text and Info severity the caller already supplies; that
 * these deliveries send no email; that operational in-app off stores and pushes
 * nothing; and that a failed in-app delivery leaves the report in place.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import Employee from "../../src/models/employee.ts";
import WeeklyBusinessReport from "../../src/models/weeklyBusinessReport.ts";
import MonthlyBusinessReport from "../../src/models/monthlyBusinessReport.ts";
import dispatchEvent from "../../src/communications/dispatchEvent.ts";
import notificationService from "../../src/communications/services/notificationService.ts";
import emailChannel from "../../src/communications/channels/emailChannel.ts";
import {
  buildMonthlyReportReadyTemplate,
  buildWeeklyReportReadyTemplate,
} from "../../src/communications/templates/reportReadyTemplate.ts";
import sendWeeklyReportReadyNotification from "../../src/weeklyBusinessReport/sendWeeklyReportReadyNotification.ts";
import sendMonthlyReportReadyNotification from "../../src/monthlyBusinessReport/sendMonthlyReportReadyNotification.ts";

/**
 * A manager resolved by the `allManagers` policy that both report events use:
 * a management shift role is the only requirement, so `onDuty: false` still
 * joins the delivery.
 */
const createManager = async (businessId: Types.ObjectId, suffix: string) =>
  Employee.create({
    businessId,
    userId: new Types.ObjectId(),
    taxNumber: `MGR-${suffix}-${Date.now()}`,
    joinDate: new Date(),
    vacationDaysPerYear: 20,
    vacationDaysLeft: 20,
    allEmployeeRoles: ["Manager"],
    currentShiftRole: "Manager",
    onDuty: false,
    active: true,
  });

/** A resolved delivery result so the in-app channel's success path runs. */
const fakeDelivered = (userId: Types.ObjectId) => ({
  notificationId: new Types.ObjectId(),
  recipientUserIds: [userId],
  recipientCount: 1,
  emittedLiveEvent: true,
});

/** A unique suffix so the monthly sender's process-local dedup never bites. */
const uniqueSuffix = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const withEnv = async (
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
) => {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Report-ready on the rail (#165)", () => {
  it("weekly report ready delivers once, to the managers already resolved, with the caller's text and Info severity", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const businessId = new Types.ObjectId();
      const manager = await createManager(businessId, "weekly");
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(new Types.ObjectId()));

      const weekLabel = "2026-W12";
      const result = await dispatchEvent(
        "WEEKLY_REPORT_READY",
        { businessId, weekLabel },
        { fireAndForget: true },
      );

      expect(result.success).toBe(true);
      // One delivery to the managers already resolved for that event.
      expect(deliverSpy).toHaveBeenCalledTimes(1);

      const input = deliverSpy.mock.calls[0][0];
      expect(input.recipients.employeeIds?.map(String)).toEqual([
        String(manager._id),
      ]);
      // Managers only: no customer joins this delivery.
      expect(input.recipients.customerUserIds ?? []).toEqual([]);
      expect(input.recipients.employeeUserIds ?? []).toEqual([]);
      // The stored text and Info severity are the ones the caller supplies.
      expect(input.message).toBe(buildWeeklyReportReadyTemplate(weekLabel));
      expect(input.notificationType).toBe("Info");
      expect(String(input.businessId)).toBe(String(businessId));
    });
  });

  it("monthly report ready delivers once, to the managers already resolved, with the caller's text and Info severity", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const businessId = new Types.ObjectId();
      const manager = await createManager(businessId, "monthly");
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(new Types.ObjectId()));

      const monthLabel = "2026-03";
      const result = await dispatchEvent(
        "MONTHLY_REPORT_READY",
        { businessId, monthLabel },
        { fireAndForget: true },
      );

      expect(result.success).toBe(true);
      // One delivery to the managers already resolved for that event.
      expect(deliverSpy).toHaveBeenCalledTimes(1);

      const input = deliverSpy.mock.calls[0][0];
      expect(input.recipients.employeeIds?.map(String)).toEqual([
        String(manager._id),
      ]);
      // Managers only: no customer joins this delivery.
      expect(input.recipients.customerUserIds ?? []).toEqual([]);
      expect(input.recipients.employeeUserIds ?? []).toEqual([]);
      // The stored text and Info severity are the ones the caller supplies.
      expect(input.message).toBe(buildMonthlyReportReadyTemplate(monthLabel));
      expect(input.notificationType).toBe("Info");
      expect(String(input.businessId)).toBe(String(businessId));
    });
  });

  it("sends no email for either report-ready notice, even with the email channel on", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "true" }, async () => {
      const businessId = new Types.ObjectId();
      await createManager(businessId, "no-email");
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(new Types.ObjectId()));
      const emailSpy = vi.spyOn(emailChannel, "send").mockResolvedValue({
        channel: "email",
        success: true,
        sentCount: 1,
      });

      await dispatchEvent(
        "WEEKLY_REPORT_READY",
        { businessId, weekLabel: "2026-W12" },
        { fireAndForget: true },
      );
      await dispatchEvent(
        "MONTHLY_REPORT_READY",
        { businessId, monthLabel: "2026-03" },
        { fireAndForget: true },
      );

      // In-app only: both report notices ride the rail and never email.
      expect(deliverSpy).toHaveBeenCalledTimes(2);
      expect(emailSpy).not.toHaveBeenCalled();
    });
  });

  it("weekly report ready stores and pushes nothing when operational in-app delivery is switched off", async () => {
    await withEnv(
      {
        COMMUNICATIONS_EMAIL_ENABLED: "false",
        COMMUNICATIONS_INAPP_ENABLED: "false",
      },
      async () => {
        const businessId = new Types.ObjectId();
        await createManager(businessId, "weekly-off");
        const deliverSpy = vi
          .spyOn(notificationService, "createAndDeliver")
          .mockResolvedValue(fakeDelivered(new Types.ObjectId()));

        const result = await dispatchEvent(
          "WEEKLY_REPORT_READY",
          { businessId, weekLabel: "2026-W12" },
          { fireAndForget: true },
        );

        // Operational in-app off: nothing stored and nothing pushed.
        expect(result.channels.length).toBe(0);
        expect(deliverSpy).not.toHaveBeenCalled();
      },
    );
  });

  it("monthly report ready stores and pushes nothing when operational in-app delivery is switched off", async () => {
    await withEnv(
      {
        COMMUNICATIONS_EMAIL_ENABLED: "false",
        COMMUNICATIONS_INAPP_ENABLED: "false",
      },
      async () => {
        const businessId = new Types.ObjectId();
        await createManager(businessId, "monthly-off");
        const deliverSpy = vi
          .spyOn(notificationService, "createAndDeliver")
          .mockResolvedValue(fakeDelivered(new Types.ObjectId()));

        const result = await dispatchEvent(
          "MONTHLY_REPORT_READY",
          { businessId, monthLabel: "2026-03" },
          { fireAndForget: true },
        );

        // Operational in-app off: nothing stored and nothing pushed.
        expect(result.channels.length).toBe(0);
        expect(deliverSpy).not.toHaveBeenCalled();
      },
    );
  });

  it("leaves the weekly report in place when the in-app delivery fails", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const businessId = new Types.ObjectId();
      await createManager(businessId, "weekly-fail");

      const weekReference = new Date("2026-03-16T00:00:00.000Z");
      const report = await WeeklyBusinessReport.create({
        businessId,
        weekReference,
        isReportOpen: false,
      });

      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockRejectedValue(new Error("forced in-app delivery failure"));

      // The delivery is attempted and throws, yet the sender swallows the
      // failure rather than propagating it, so the finalized report stays.
      await expect(
        sendWeeklyReportReadyNotification(businessId, "2026-W12"),
      ).resolves.toBeUndefined();
      expect(deliverSpy).toHaveBeenCalledTimes(1);

      const persisted = await WeeklyBusinessReport.findById(report._id).lean();
      expect(persisted).not.toBeNull();
      expect(persisted?.isReportOpen).toBe(false);
    });
  });

  it("leaves the monthly report in place when the in-app delivery fails", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const businessId = new Types.ObjectId();
      await createManager(businessId, "monthly-fail");

      const monthReference = new Date("2026-03-01T00:00:00.000Z");
      const report = await MonthlyBusinessReport.create({
        businessId,
        monthReference,
        isReportOpen: false,
      });

      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockRejectedValue(new Error("forced in-app delivery failure"));

      // A unique label keeps the monthly sender's process-local dedup from
      // suppressing this dispatch regardless of test order.
      await expect(
        sendMonthlyReportReadyNotification(
          businessId,
          `2026-03-${uniqueSuffix()}`,
        ),
      ).resolves.toBeUndefined();
      expect(deliverSpy).toHaveBeenCalledTimes(1);

      const persisted = await MonthlyBusinessReport.findById(report._id).lean();
      expect(persisted).not.toBeNull();
      expect(persisted?.isReportOpen).toBe(false);
    });
  });
});
