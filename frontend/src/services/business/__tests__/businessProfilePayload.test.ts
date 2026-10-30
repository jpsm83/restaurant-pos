import { describe, expect, it } from "vitest";
import { formValuesToUpdatePayload } from "../businessProfilePayload";
import type { BusinessProfileFormValues } from "../businessService";

function values(overrides?: Partial<BusinessProfileFormValues>): BusinessProfileFormValues {
  return {
    subscription: "Free",
    imageUrl: "",
    imageFile: null,
    tradeName: " Demo ",
    phoneNumber: " +1 ",
    currencyTrade: " USD ",
    address: {
      country: " US ",
      state: " CA ",
      city: " SF ",
      street: " Main ",
      buildingNumber: " 1 ",
      doorNumber: " ",
      complement: " ",
      postCode: " 12345 ",
      region: " ",
    },
    contactPerson: " Jane ",
    cuisineType: ["Italian", "Invalid"],
    categories: ["Pizza", "Invalid"],
    acceptsDelivery: true,
    deliveryRadius: 5,
    minOrder: 20,
    metrics: {
      foodCostPercentage: 30,
      beverageCostPercentage: 20,
      laborCostPercentage: 30,
      fixedCostPercentage: 20,
      supplierGoodWastePercentage: {
        veryLowBudgetImpact: 9,
        lowBudgetImpact: 7,
        mediumBudgetImpact: 5,
        hightBudgetImpact: 3,
        veryHightBudgetImpact: 1,
      },
    },
    businessOpeningHours: [{ dayOfWeek: 1, openTime: "09:00", closeTime: "18:00" }],
    deliveryOpeningWindows: [
      { dayOfWeek: 1, windows: [{ openTime: "11:00", closeTime: "14:00" }] },
    ],
    reportingConfig: { weeklyReportStartDay: 1 },
    ...overrides,
  };
}

describe("businessProfilePayload", () => {
  it("builds expected FormData fields", () => {
    const payload = formValuesToUpdatePayload(values());
    expect(payload.get("tradeName")).toBe("Demo");
    expect(payload.get("legalName")).toBeNull();
    expect(payload.get("taxNumber")).toBeNull();
    expect(payload.get("currencyTrade")).toBe("USD");
    expect(payload.get("acceptsDelivery")).toBe("true");
    expect(payload.get("deliveryRadius")).toBe("5");
    expect(payload.get("minOrder")).toBe("20");

    const address = JSON.parse(String(payload.get("address"))) as Record<string, string>;
    expect(address.country).toBe("US");
    expect(address).not.toHaveProperty("doorNumber");
    expect(address).not.toHaveProperty("complement");
    expect(address).not.toHaveProperty("region");

    expect(JSON.parse(String(payload.get("cuisineType")))).toEqual(["Italian"]);
    expect(JSON.parse(String(payload.get("categories")))).toEqual(["Pizza"]);
  });

  it("omits blank profile fields and partial address fields for a draft save", () => {
    const payload = formValuesToUpdatePayload(
      values({
        tradeName: " ",
        phoneNumber: "",
        currencyTrade: "",
        subscription: "",
        address: {
          country: "US",
          state: "",
          city: "Austin",
          street: "",
          buildingNumber: "",
          doorNumber: "",
          complement: "",
          postCode: "",
          region: "",
        },
      }),
    );

    expect(payload.get("tradeName")).toBeNull();
    expect(payload.get("phoneNumber")).toBeNull();
    expect(payload.get("currencyTrade")).toBeNull();
    expect(payload.get("subscription")).toBeNull();
    expect(JSON.parse(String(payload.get("address")))).toEqual({
      country: "US",
      city: "Austin",
    });
  });

  it("never sends the business contact email or credentials (they are server-owned)", () => {
    const payload = formValuesToUpdatePayload(values());
    expect(payload.get("email")).toBeNull();
    expect(payload.get("confirmEmail")).toBeNull();
    expect(payload.get("password")).toBeNull();
    expect(payload.get("currentPassword")).toBeNull();
  });
});
