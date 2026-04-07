import { describe, expect, it } from "vitest";
import { formValuesToUpdatePayload } from "../businessProfilePayload";
import type { BusinessProfileFormValues } from "../businessService";

function values(overrides?: Partial<BusinessProfileFormValues>): BusinessProfileFormValues {
  return {
    subscription: "Free",
    imageUrl: "",
    imageFile: null,
    tradeName: " Demo ",
    legalName: " Demo LLC ",
    email: " owner@demo.test ",
    confirmEmail: " owner@demo.test ",
    currentPassword: "",
    password: "",
    confirmPassword: "",
    phoneNumber: " +1 ",
    taxNumber: " TAX-1 ",
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
    expect(payload.get("legalName")).toBe("Demo LLC");
    expect(payload.get("email")).toBe("owner@demo.test");
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

  it("sends password/currentPassword only when password is present", () => {
    const withPassword = formValuesToUpdatePayload(
      values({ password: "Valid1!Pass", currentPassword: "Old1!Pass" }),
    );
    expect(withPassword.get("password")).toBe("Valid1!Pass");
    expect(withPassword.get("currentPassword")).toBe("Old1!Pass");

    const withoutPassword = formValuesToUpdatePayload(values());
    expect(withoutPassword.get("password")).toBeNull();
    expect(withoutPassword.get("currentPassword")).toBeNull();
  });
});
