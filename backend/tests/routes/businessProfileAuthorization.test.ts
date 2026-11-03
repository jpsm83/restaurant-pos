/**
 * Field-level authorization for `PATCH /api/v1/business/:businessId`.
 *
 * These tests exercise the route through Fastify inject: the membership hook
 * runs first, then the whole request is refused when any submitted field sits
 * above the actor's effective layer. A mixed request must write nothing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

import { generateTestToken, getTestApp } from "../setup.ts";
import Business from "../../src/models/business.ts";
import Company from "../../src/models/company.ts";
import DailySalesReport from "../../src/models/dailySalesReport.ts";
import Employee from "../../src/models/employee.ts";
import Order from "../../src/models/order.ts";
import Owner from "../../src/models/owner.ts";
import Purchase from "../../src/models/purchase.ts";
import User from "../../src/models/user.ts";
import {
  createTestBusiness,
  createTestOwnerCompany,
} from "../helpers/fixtures.ts";

vi.mock("../../src/communications/dispatchEvent.ts", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

const managerFields = {
  cuisineType: JSON.stringify(["Italian"]),
  categories: JSON.stringify(["Pizza"]),
  acceptsDelivery: "true",
  deliveryRadius: "5",
  minOrder: "20",
  businessOpeningHours: JSON.stringify([
    { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00" },
  ]),
  deliveryOpeningWindows: JSON.stringify([
    { dayOfWeek: 1, windows: [{ openTime: "11:00", closeTime: "14:00" }] },
  ]),
  metrics: JSON.stringify({
    foodCostPercentage: 31,
    beverageCostPercentage: 17,
    laborCostPercentage: 29,
    fixedCostPercentage: 23,
    supplierGoodWastePercentage: {
      veryLowBudgetImpact: 8,
      lowBudgetImpact: 6,
      mediumBudgetImpact: 4,
      hightBudgetImpact: 2,
      veryHightBudgetImpact: 1,
    },
  }),
  reportingConfig: JSON.stringify({ weeklyReportStartDay: 3 }),
} as const;

function multipart(fields: Record<string, string>): {
  boundary: string;
  payload: string;
} {
  const boundary = "----formdata";
  const parts = Object.entries(fields).flatMap(([name, value]) => [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${name}"\r\n\r\n${value}`,
  ]);
  parts.push(`--${boundary}--`);
  return { boundary, payload: parts.join("\r\n") };
}

async function createMemberSession(
  businessId: Types.ObjectId,
  roles: string[],
): Promise<{ auth: string; userId: string }> {
  const userId = new Types.ObjectId();
  const email = `profile-auth-${userId}@test.com`;
  await User.create({
    _id: userId,
    personalDetails: { email, firstName: "Profile", lastName: "Member" },
  });
  const employee = await Employee.create({
    businessId,
    userId,
    allEmployeeRoles: roles,
    currentShiftRole: roles[0],
    taxNumber: `EMP-${new Types.ObjectId()}`,
    joinDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    vacationDaysPerYear: 20,
    active: true,
  });
  const auth = await generateTestToken({
    id: userId.toString(),
    email,
    type: "user",
    role: roles[0],
    businessId: businessId.toString(),
    employeeId: employee._id.toString(),
    canLogAsEmployee: true,
  });
  return { auth, userId: userId.toString() };
}

async function createOwnerSession(
  businessId: Types.ObjectId,
): Promise<string> {
  const business = await Business.findById(businessId)
    .select("companyId")
    .lean();
  const company = await Company.findById(business!.companyId)
    .select("ownerId")
    .lean();
  const owner = await Owner.findById(company!.ownerId).select("userId").lean();
  const user = await User.findById(owner!.userId).lean();
  return generateTestToken({
    id: String(user!._id),
    email: user!.personalDetails.email,
    type: "user",
    role: "Customer",
  });
}

async function patch(
  auth: string,
  businessId: Types.ObjectId | string,
  fields: Record<string, string>,
) {
  const app = await getTestApp();
  const { boundary, payload } = multipart(fields);
  return app.inject({
    method: "PATCH",
    url: `/api/v1/business/${businessId}`,
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      authorization: auth,
    },
    payload,
  });
}

async function newVenue(overrides: Record<string, unknown> = {}) {
  return createTestBusiness({
    tradeName: "Authorization Venue",
    phoneNumber: "1234567890",
    currencyTrade: "USD",
    address: validAddress,
    ...overrides,
  });
}

describe("PATCH business profile field authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["employee", "Waiter"],
    ["supervisor", "Supervisor"],
  ])("refuses a %s's manager-field submission", async (_label, role) => {
    const business = await newVenue();
    const { auth } = await createMemberSession(business._id, [role]);

    const response = await patch(auth, business._id, {
      acceptsDelivery: "true",
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    const stored = await Business.findById(business._id).lean();
    expect(stored?.acceptsDelivery).toBeFalsy();
  });

  it("lets a manager write every operational field", async () => {
    const business = await newVenue();
    const { auth } = await createMemberSession(business._id, ["Manager"]);

    const response = await patch(auth, business._id, managerFields);

    expect(response.statusCode).toBe(200);
    const stored = await Business.findById(business._id).lean();
    expect(stored?.acceptsDelivery).toBe(true);
    expect(stored?.deliveryRadius).toBe(5);
    expect(stored?.minOrder).toBe(20);
    expect(stored?.cuisineType).toEqual(["Italian"]);
    expect(stored?.categories).toEqual(["Pizza"]);
    expect(stored?.businessOpeningHours?.[0]).toMatchObject({
      dayOfWeek: 1,
      openTime: "09:00",
      closeTime: "18:00",
    });
    expect(stored?.deliveryOpeningWindows?.[0]?.windows[0]).toMatchObject({
      openTime: "11:00",
      closeTime: "14:00",
    });
    expect(stored?.metrics?.foodCostPercentage).toBe(31);
    expect(stored?.reportingConfig?.weeklyReportStartDay).toBe(3);
  });

  it("refuses a manager's identity-field submission", async () => {
    const business = await newVenue();
    const { auth } = await createMemberSession(business._id, ["Manager"]);

    const response = await patch(auth, business._id, {
      tradeName: "Manager Renamed",
    });

    expect(response.statusCode).toBe(403);
    const stored = await Business.findById(business._id).lean();
    expect(stored?.tradeName).toBe("Authorization Venue");
  });

  it("refuses a blank above-layer field instead of silently dropping it", async () => {
    const business = await newVenue();
    const { auth } = await createMemberSession(business._id, ["Manager"]);

    const response = await patch(auth, business._id, { address: "" });

    expect(response.statusCode).toBe(403);
    const stored = await Business.findById(business._id).lean();
    expect(stored?.address?.city).toBe("Los Angeles");
  });

  it("refuses a malformed above-layer field with 403 before validation", async () => {
    const business = await newVenue();
    const { auth } = await createMemberSession(business._id, ["Manager"]);

    const response = await patch(auth, business._id, {
      address: "{not-json",
    });

    expect(response.statusCode).toBe(403);
    const stored = await Business.findById(business._id).lean();
    expect(stored?.address?.city).toBe("Los Angeles");
  });

  it("refuses a mixed request as a whole and writes nothing", async () => {
    const business = await newVenue();
    const { auth } = await createMemberSession(business._id, ["Manager"]);

    const response = await patch(auth, business._id, {
      acceptsDelivery: "true",
      tradeName: "Mixed Renamed",
    });

    expect(response.statusCode).toBe(403);
    const stored = await Business.findById(business._id).lean();
    expect(stored?.acceptsDelivery).toBeFalsy();
    expect(stored?.tradeName).toBe("Authorization Venue");
  });

  it("lets an admin write identity, contact, currency, and address", async () => {
    const business = await newVenue();
    const { auth } = await createMemberSession(business._id, ["Admin"]);

    const response = await patch(auth, business._id, {
      tradeName: "Admin Renamed",
      phoneNumber: "5550000",
      currencyTrade: "EUR",
      contactPerson: "Alex Admin",
      address: JSON.stringify({ city: "Austin", state: "TX" }),
    });

    expect(response.statusCode).toBe(200);
    const stored = await Business.findById(business._id).lean();
    expect(stored?.tradeName).toBe("Admin Renamed");
    expect(stored?.phoneNumber).toBe("5550000");
    expect(stored?.currencyTrade).toBe("EUR");
    expect(stored?.contactPerson).toBe("Alex Admin");
    expect(stored?.address?.city).toBe("Austin");
    expect(stored?.address?.state).toBe("TX");
    expect(stored?.address?.country).toBe("USA");
  });

  it("lets the owner write identity and operational fields together", async () => {
    const business = await newVenue();
    const auth = await createOwnerSession(business._id);

    const response = await patch(auth, business._id, {
      tradeName: "Owner Renamed",
      ...managerFields,
    });

    expect(response.statusCode).toBe(200);
    const stored = await Business.findById(business._id).lean();
    expect(stored?.tradeName).toBe("Owner Renamed");
    expect(stored?.acceptsDelivery).toBe(true);
  });

  it("rejects the removed venue subscription field", async () => {
    const business = await newVenue();
    const { auth } = await createMemberSession(business._id, ["Admin"]);

    const response = await patch(auth, business._id, {
      subscription: "Premium",
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(
      body.errors?.some((error: { message: string }) =>
        error.message.includes("subscription"),
      ),
    ).toBe(true);
  });

  it("lets an admin change currency while the venue is pristine", async () => {
    const business = await newVenue();
    const { auth } = await createMemberSession(business._id, ["Admin"]);

    const response = await patch(auth, business._id, {
      currencyTrade: "EUR",
    });

    expect(response.statusCode).toBe(200);
    const stored = await Business.findById(business._id).lean();
    expect(stored?.currencyTrade).toBe("EUR");
  });

  it.each([
    [
      "order",
      (businessId: Types.ObjectId) =>
        Order.create({
          businessId,
          dailyReferenceNumber: 1,
          orderGrossPrice: 10,
          orderNetPrice: 10,
          orderCostPrice: 4,
          salesInstanceId: new Types.ObjectId(),
          businessGoodId: new Types.ObjectId(),
        }),
    ],
    [
      "purchase",
      (businessId: Types.ObjectId) =>
        Purchase.create({
          businessId,
          purchaseDate: new Date(),
          supplierId: new Types.ObjectId(),
          purchasedByEmployeeId: new Types.ObjectId(),
          totalAmount: 10,
          receiptId: `RECEIPT-${businessId}`,
        }),
    ],
    [
      "report",
      (businessId: Types.ObjectId) =>
        DailySalesReport.create({
          businessId,
          dailyReferenceNumber: 1,
          timeCountdownToClose: 3600,
        }),
    ],
  ])(
    "refuses a currency change once an %s exists",
    async (_label, createRecord) => {
      const business = await newVenue();
      const { auth } = await createMemberSession(business._id, ["Admin"]);
      await createRecord(business._id);

      const response = await patch(auth, business._id, {
        currencyTrade: "EUR",
        tradeName: "Should Not Persist",
      });

      expect(response.statusCode).toBe(409);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      const stored = await Business.findById(business._id).lean();
      expect(stored?.currencyTrade).toBe("USD");
      expect(stored?.tradeName).toBe("Authorization Venue");
    },
  );
});
