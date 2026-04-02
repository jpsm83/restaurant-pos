import { describe, expect, it } from "vitest";
import {
  businessDtoToFormValues,
  formValuesToUpdatePayload,
  type BusinessProfileDto,
} from "./businessService";
import { buildBusinessProfileSchema } from "./businessProfileFormSchema";

function makeBusinessDto(overrides?: Partial<BusinessProfileDto>): BusinessProfileDto {
  return {
    _id: "64b000000000000000000001",
    tradeName: " Imperium Kitchen ",
    legalName: " Imperium Kitchen LLC ",
    imageUrl: " https://cdn.example.com/logo.png ",
    email: " owner@imperium.test ",
    phoneNumber: " +351999999999 ",
    taxNumber: " TAX-123 ",
    currencyTrade: "USD",
    subscription: "Free",
    address: {
      country: " PT ",
      state: " LX ",
      city: " Lisbon ",
      street: " Main St ",
      buildingNumber: " 10 ",
      postCode: " 1000-100 ",
      region: " Center ",
    },
    contactPerson: " John ",
    cuisineType: " Italian ",
    categories: [" Pizza ", "pasta", "PIZZA", ""],
    acceptsDelivery: true,
    deliveryRadius: 5,
    minOrder: 12,
    metrics: {
      foodCostPercentage: 31,
      beverageCostPercentage: 21,
      laborCostPercentage: 29,
      fixedCostPercentage: 19,
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
      {
        dayOfWeek: 1,
        windows: [{ openTime: "11:00", closeTime: "15:00" }],
      },
    ],
    reportingConfig: { weeklyReportStartDay: 1 },
    ...overrides,
  };
}

describe("Business profile schema + mappers", () => {
  it("maps DTO to normalized form values", () => {
    const formValues = businessDtoToFormValues(makeBusinessDto());

    expect(formValues.tradeName).toBe("Imperium Kitchen");
    expect(formValues.legalName).toBe("Imperium Kitchen LLC");
    expect(formValues.email).toBe("owner@imperium.test");
    expect(formValues.confirmEmail).toBe("owner@imperium.test");
    expect(formValues.categories).toEqual(["pizza", "pasta"]);
    expect(formValues.password).toBe("");
    expect(formValues.confirmPassword).toBe("");
    expect(formValues.reportingConfig.weeklyReportStartDay).toBe(1);
  });

  it("builds backend-compatible FormData payload", () => {
    const values = businessDtoToFormValues(makeBusinessDto());
    values.password = "Valid1!Password";
    values.confirmPassword = "Valid1!Password";
    const payload = formValuesToUpdatePayload(values);

    expect(payload.get("tradeName")).toBe("Imperium Kitchen");
    expect(payload.get("legalName")).toBe("Imperium Kitchen LLC");
    expect(payload.get("email")).toBe("owner@imperium.test");
    expect(payload.get("password")).toBe("Valid1!Password");
    expect(payload.get("subscription")).toBe("Free");

    const address = JSON.parse(String(payload.get("address"))) as Record<string, string>;
    expect(address.country).toBe("PT");
    expect(address.city).toBe("Lisbon");

    const categories = JSON.parse(String(payload.get("categories"))) as string[];
    expect(categories).toEqual(["pizza", "pasta"]);
    // Existing cloudinary URL is server-managed and must not be sent as a manual text field.
    expect(payload.get("imageUrl")).toBeNull();
  });

  it("appends image file for cloudinary upload payload", () => {
    const values = businessDtoToFormValues(makeBusinessDto());
    const file = new File(["mock-image-binary"], "logo.png", {
      type: "image/png",
    });
    values.imageFile = file;

    const payload = formValuesToUpdatePayload(values);
    const sentImage = payload.get("imageUrl");
    expect(sentImage).toBeInstanceOf(File);
    expect((sentImage as File).name).toBe("logo.png");
  });

  it("accepts a valid profile model", () => {
    const schema = buildBusinessProfileSchema();
    const values = businessDtoToFormValues(makeBusinessDto());
    const parsed = schema.safeParse(values);
    expect(parsed.success).toBe(true);
  });

  it("rejects mismatched confirm email", () => {
    const schema = buildBusinessProfileSchema();
    const values = businessDtoToFormValues(makeBusinessDto());
    values.confirmEmail = "different@imperium.test";
    const parsed = schema.safeParse(values);

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join(".") === "confirmEmail")).toBe(true);
    }
  });

  it("rejects invalid password policy when password is provided", () => {
    const schema = buildBusinessProfileSchema();
    const values = businessDtoToFormValues(makeBusinessDto());
    values.password = "weak";
    values.confirmPassword = "weak";
    const parsed = schema.safeParse(values);

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join(".") === "password")).toBe(true);
    }
  });

  it("rejects invalid day/time windows", () => {
    const schema = buildBusinessProfileSchema();
    const values = businessDtoToFormValues(makeBusinessDto());
    values.businessOpeningHours = [
      { dayOfWeek: 8, openTime: "25:00", closeTime: "18:00" },
    ];
    const parsed = schema.safeParse(values);

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) =>
          i.path.join(".").startsWith("businessOpeningHours.0"),
        ),
      ).toBe(true);
    }
  });
});
