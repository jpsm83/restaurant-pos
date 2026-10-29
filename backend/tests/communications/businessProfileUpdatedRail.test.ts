/**
 * Deliver business profile updated on the rail without undoing the save
 * (issue #166).
 *
 * Caller-regression seam: the one delivery operation
 * `notificationService.createAndDeliver` (the same rail a hand-created
 * notification uses) is mocked, and the email channel is spied. The tests
 * assert that BUSINESS_PROFILE_UPDATED uses that delivery operation once, for
 * the managers already resolved for that event, as one in-app notification for
 * the group with the stored text and Info severity the caller already supplies;
 * that the email copy keeps using the email rail; that operational in-app off
 * stores and pushes nothing while the email is unchanged; and that a failed
 * in-app delivery after the profile PATCH leaves the saved profile in place.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import User from "../../src/models/user.ts";
import Employee from "../../src/models/employee.ts";
import Business from "../../src/models/business.ts";
import dispatchEvent from "../../src/communications/dispatchEvent.ts";
import notificationService from "../../src/communications/services/notificationService.ts";
import emailChannel from "../../src/communications/channels/emailChannel.ts";
import {
  buildBusinessProfileUpdatedEmailBody,
  buildBusinessProfileUpdatedInAppMessage,
} from "../../src/communications/templates/businessProfileUpdatedTemplate.ts";
import { generateTestToken, getTestApp } from "../setup.ts";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

const createTestUser = async (prefix: string) => {
  const unique = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return User.create({
    personalDetails: {
      username: `${unique}-user`,
      email: `${unique}@test.com`,
      password: "hashedpassword",
      firstName: "Test",
      lastName: "User",
      phoneNumber: "1234567890",
      birthDate: new Date("1990-01-01"),
      gender: "Man",
      nationality: "USA",
      idType: "National ID",
      idNumber: `ID-${unique}`,
      address: validAddress,
    },
    allUserRoles: ["Customer"],
  });
};

/**
 * A manager resolved by the `allManagers` policy this event uses: a
 * management shift role is the only requirement, so `onDuty: false` still
 * joins the delivery.
 */
const createManager = async (
  businessId: Types.ObjectId,
  suffix: string,
  userId?: Types.ObjectId,
) =>
  Employee.create({
    businessId,
    userId: userId ?? new Types.ObjectId(),
    taxNumber: `MGR-${suffix}-${Date.now()}`,
    joinDate: new Date(),
    vacationDaysPerYear: 20,
    vacationDaysLeft: 20,
    allEmployeeRoles: ["Manager"],
    currentShiftRole: "Manager",
    onDuty: false,
    active: true,
  });

const createVenue = async (tradeName: string) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return Business.create({
    tradeName,
    legalName: `${tradeName} LLC`,
    email: `venue-${suffix}@test.com`,
    phoneNumber: "1234567890",
    taxNumber: `TAX-${suffix}`,
    currencyTrade: "USD",
    subscription: "Free",
    address: validAddress,
  });
};

const profileUpdatedPayload = (businessId: Types.ObjectId) => ({
  businessId,
  actor: {
    source: "businessOwner" as const,
    email: "owner@example.com",
  },
  changedFields: ["tradeName", "address.city"],
  changedFieldCount: 2,
  occurredAt: new Date("2026-04-02T18:30:00.000Z"),
});

/** A resolved delivery result so the in-app channel's success path runs. */
const fakeDelivered = (userId: Types.ObjectId) => ({
  notificationId: new Types.ObjectId(),
  recipientUserIds: [userId],
  recipientCount: 1,
  emittedLiveEvent: true,
});

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

describe("Business profile updated on the rail (#166)", () => {
  it("delivers once, to the managers already resolved, as one group notice with the caller's text and Info severity", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const businessId = new Types.ObjectId();
      const managerOne = await createManager(businessId, "group-1");
      const managerTwo = await createManager(businessId, "group-2");
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(new Types.ObjectId()));

      const payload = profileUpdatedPayload(businessId);
      const result = await dispatchEvent("BUSINESS_PROFILE_UPDATED", payload, {
        fireAndForget: true,
      });

      expect(result.success).toBe(true);
      // One in-app notification for the manager group, not one copy each.
      expect(deliverSpy).toHaveBeenCalledTimes(1);

      const input = deliverSpy.mock.calls[0][0];
      expect(input.recipients.employeeIds?.map(String).sort()).toEqual(
        [String(managerOne._id), String(managerTwo._id)].sort(),
      );
      // Managers only: no customer joins this delivery.
      expect(input.recipients.customerUserIds ?? []).toEqual([]);
      expect(input.recipients.employeeUserIds ?? []).toEqual([]);
      // The stored text and Info severity are the ones the caller supplies.
      expect(input.message).toBe(
        buildBusinessProfileUpdatedInAppMessage(payload),
      );
      expect(input.notificationType).toBe("Info");
      expect(String(input.businessId)).toBe(String(businessId));
    });
  });

  it("keeps the email copy on the email rail, unchanged by this delivery", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "true" }, async () => {
      const business = await createVenue("Harbour Kitchen");
      const managerOneUser = await createTestUser("profile-email-1");
      const managerTwoUser = await createTestUser("profile-email-2");
      await createManager(business._id, "email-1", managerOneUser._id);
      await createManager(business._id, "email-2", managerTwoUser._id);
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockResolvedValue(fakeDelivered(managerOneUser._id));
      const emailSpy = vi.spyOn(emailChannel, "send").mockResolvedValue({
        channel: "email",
        success: true,
        sentCount: 1,
      });

      const payload = profileUpdatedPayload(business._id);
      await dispatchEvent("BUSINESS_PROFILE_UPDATED", payload, {
        fireAndForget: true,
      });

      // Each manager still gets their own copy on the email rail.
      expect(emailSpy).toHaveBeenCalledTimes(2);
      const payloads = emailSpy.mock.calls.map((call) => call[0]);
      const addresses = payloads.map((email) => email.to);
      expect(addresses).toEqual(
        expect.arrayContaining([
          managerOneUser.personalDetails.email,
          managerTwoUser.personalDetails.email,
        ]),
      );
      expect(new Set(addresses).size).toBe(2);
      const expectedText = buildBusinessProfileUpdatedEmailBody(payload);
      for (const email of payloads) {
        expect(email.subject).toBe("Business profile updated");
        expect(email.text).toBe(expectedText);
        expect(email.displayName).toBe("Harbour Kitchen");
      }
      // The in-app rail still delivers the group notice once alongside email.
      expect(deliverSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("skips the in-app delivery when operational in-app is off and leaves the email unchanged", async () => {
    await withEnv(
      {
        COMMUNICATIONS_EMAIL_ENABLED: "true",
        COMMUNICATIONS_INAPP_ENABLED: "false",
      },
      async () => {
        const business = await createVenue("Quiet Harbour");
        const managerOneUser = await createTestUser("profile-off-1");
        const managerTwoUser = await createTestUser("profile-off-2");
        await createManager(business._id, "off-1", managerOneUser._id);
        await createManager(business._id, "off-2", managerTwoUser._id);
        const deliverSpy = vi
          .spyOn(notificationService, "createAndDeliver")
          .mockResolvedValue(fakeDelivered(managerOneUser._id));
        const emailSpy = vi.spyOn(emailChannel, "send").mockResolvedValue({
          channel: "email",
          success: true,
          sentCount: 1,
        });

        const payload = profileUpdatedPayload(business._id);
        const result = await dispatchEvent("BUSINESS_PROFILE_UPDATED", payload, {
          fireAndForget: true,
        });

        // Operational in-app off: nothing stored and nothing pushed.
        expect(deliverSpy).not.toHaveBeenCalled();
        expect(
          result.channels.some((channel) => channel.channel === "inApp"),
        ).toBe(false);
        // The email copy still rides the email rail with the same text.
        expect(emailSpy).toHaveBeenCalledTimes(2);
        const expectedText = buildBusinessProfileUpdatedEmailBody(payload);
        for (const email of emailSpy.mock.calls.map((call) => call[0])) {
          expect(email.subject).toBe("Business profile updated");
          expect(email.text).toBe(expectedText);
        }
      },
    );
  });

  it("leaves the saved profile in place when the in-app delivery fails", async () => {
    await withEnv({ COMMUNICATIONS_EMAIL_ENABLED: "false" }, async () => {
      const app = await getTestApp();
      const business = await createVenue("Saved Profile");
      const manager = await createManager(business._id, "fail");
      const deliverSpy = vi
        .spyOn(notificationService, "createAndDeliver")
        .mockRejectedValue(new Error("forced in-app delivery failure"));

      const auth = await generateTestToken({
        id: manager.userId.toString(),
        email: "manager@test.com",
        type: "user",
        role: "Manager",
        businessId: business._id.toString(),
        employeeId: manager._id.toString(),
        canLogAsEmployee: true,
      });
      const boundary = "----formdata";
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="tradeName"\r\n\r\nSaved Despite Notify Fail',
        `--${boundary}`,
        `Content-Disposition: form-data; name="phoneNumber"\r\n\r\n${business.phoneNumber}`,
        `--${boundary}`,
        'Content-Disposition: form-data; name="subscription"\r\n\r\nFree',
        `--${boundary}`,
        'Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD',
        `--${boundary}`,
        `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
        `--${boundary}--`,
      ].join("\r\n");

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/business/${business._id}`,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          authorization: auth,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      // The route dispatches fire-and-forget after the save; wait until the
      // failed delivery has actually been attempted.
      for (
        let attempt = 0;
        attempt < 50 && deliverSpy.mock.calls.length === 0;
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(deliverSpy).toHaveBeenCalledTimes(1);

      const persisted = await Business.findById(business._id).lean();
      expect(persisted).not.toBeNull();
      expect(persisted?.tradeName).toBe("Saved Despite Notify Fail");
      expect(persisted?.legalName).toBe("Saved Profile LLC");
    });
  });
});
