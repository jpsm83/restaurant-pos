import { describe, expect, it } from "vitest";
import { formValuesToUpdatePayload } from "../businessProfilePayload";
import type { BusinessProfileFormValues } from "../businessService";

function values(overrides?: Partial<BusinessProfileFormValues>): BusinessProfileFormValues {
  return {
    imageUrl: "",
    imageFile: null,
    tradeName: " Demo ",
    email: " Venue@Example.com ",
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
    expect(JSON.parse(String(payload.get("address")))).toEqual({
      country: "US",
      city: "Austin",
    });
  });

  it("omits identity, contact, currency, and address for a manager", () => {
    const payload = formValuesToUpdatePayload(values(), {
      actorLayer: "manager",
    });

    expect(payload.get("tradeName")).toBeNull();
    expect(payload.get("phoneNumber")).toBeNull();
    expect(payload.get("currencyTrade")).toBeNull();
    expect(payload.get("address")).toBeNull();
    expect(payload.get("contactPerson")).toBeNull();

    expect(JSON.parse(String(payload.get("cuisineType")))).toEqual(["Italian"]);
    expect(JSON.parse(String(payload.get("categories")))).toEqual(["Pizza"]);
    expect(payload.get("acceptsDelivery")).toBe("true");
    expect(payload.get("deliveryRadius")).toBe("5");
    expect(payload.get("minOrder")).toBe("20");
    expect(payload.get("metrics")).not.toBeNull();
    expect(payload.get("businessOpeningHours")).not.toBeNull();
    expect(payload.get("deliveryOpeningWindows")).not.toBeNull();
    expect(payload.get("reportingConfig")).not.toBeNull();
  });

  it("keeps identity and address fields for an admin", () => {
    const payload = formValuesToUpdatePayload(values(), {
      actorLayer: "admin",
    });

    expect(payload.get("tradeName")).toBe("Demo");
    expect(payload.get("phoneNumber")).toBe("+1");
    expect(payload.get("currencyTrade")).toBe("USD");
    expect(payload.get("address")).not.toBeNull();
    expect(payload.get("contactPerson")).toBe("Jane");
    expect(payload.get("metrics")).not.toBeNull();
  });

  it("sends the business contact email for an admin but never credentials", () => {
    const payload = formValuesToUpdatePayload(values(), {
      actorLayer: "admin",
    });
    expect(payload.get("email")).toBe("Venue@Example.com");
    expect(payload.get("confirmEmail")).toBeNull();
    expect(payload.get("password")).toBeNull();
    expect(payload.get("currentPassword")).toBeNull();
  });

  it("omits the business contact email for a manager", () => {
    const payload = formValuesToUpdatePayload(values(), {
      actorLayer: "manager",
    });
    expect(payload.get("email")).toBeNull();
  });
});
