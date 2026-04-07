import { describe, expect, it } from "vitest";
import {
  businessDtoToFormValues,
  normalizeBusinessOpeningHours,
  normalizeDeliveryOpeningWindows,
} from "../businessProfileMapper";
import type { BusinessProfileDto } from "../businessService";

function dto(overrides?: Partial<BusinessProfileDto>): BusinessProfileDto {
  return {
    _id: "b-1",
    tradeName: " Demo ",
    legalName: " Demo LLC ",
    imageUrl: " https://img/logo.png ",
    email: " owner@demo.test ",
    phoneNumber: " +1 ",
    taxNumber: " TAX ",
    currencyTrade: "usd",
    subscription: "Free",
    address: {
      country: " US ",
      state: " CA ",
      city: " SF ",
      street: " Main ",
      buildingNumber: " 1 ",
      doorNumber: " 2A ",
      complement: " Floor 1 ",
      postCode: " 12345 ",
      region: " West ",
    },
    contactPerson: " Jane ",
    cuisineType: ["italian", "ITALIAN", "invalid"],
    categories: ["pizza", "PIZZA", "invalid"],
    acceptsDelivery: 1 as unknown as boolean,
    deliveryRadius: 4,
    minOrder: 10,
    metrics: {},
    businessOpeningHours: [],
    deliveryOpeningWindows: [],
    reportingConfig: { weeklyReportStartDay: 1 },
    ...overrides,
  };
}

describe("businessProfileMapper", () => {
  it("normalizes opening hours rows", () => {
    expect(
      normalizeBusinessOpeningHours([
        { dayOfWeek: 1, openTime: "09:00", closeTime: "18:00" },
        { dayOfWeek: 8, openTime: "09:00", closeTime: "18:00" },
        { dayOfWeek: 2, openTime: "", closeTime: "18:00" },
      ]),
    ).toEqual([{ dayOfWeek: 1, openTime: "09:00", closeTime: "18:00" }]);
  });

  it("normalizes delivery windows rows", () => {
    expect(
      normalizeDeliveryOpeningWindows([
        {
          dayOfWeek: 1,
          windows: [
            { openTime: "11:00", closeTime: "14:00" },
            { openTime: "", closeTime: "14:00" },
          ],
        },
        { dayOfWeek: 7, windows: [{ openTime: "11:00", closeTime: "14:00" }] },
      ]),
    ).toEqual([
      {
        dayOfWeek: 1,
        windows: [{ openTime: "11:00", closeTime: "14:00" }],
      },
    ]);
  });

  it("maps dto into trimmed and canonicalized form values", () => {
    const values = businessDtoToFormValues(dto());
    expect(values.tradeName).toBe("Demo");
    expect(values.email).toBe("owner@demo.test");
    expect(values.currencyTrade).toBe("USD");
    expect(values.cuisineType).toEqual(["Italian"]);
    expect(values.categories).toEqual(["Pizza"]);
    expect(values.metrics.foodCostPercentage).toBe(30);
    expect(values.metrics.beverageCostPercentage).toBe(20);
  });
});
