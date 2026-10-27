import { describe, expect, it } from "vitest";
import {
  businessDtoToFormValues,
  formValuesToUpdatePayload,
  type BusinessProfileDto,
} from "../businessService";
import { buildBusinessProfileSchema } from "../businessProfileFormSchema";

const schemaMessages = {
  required: "Required.",
  invalidSubscription: "Invalid subscription.",
  invalidCurrency: "Invalid currency.",
  invalidTime: "Invalid time.",
  invalidDayOfWeek: "Invalid day of week.",
  invalidNonNegative: "Invalid non-negative.",
  invalidWeeklyStartDay: "Invalid weekly start day.",
  invalidImage: "Invalid image file.",
  openingRange: "Opening range must increase.",
  deliveryRange: "Delivery range must increase.",
};

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
      doorNumber: " 2 ",
      complement: " Floor 1 ",
      postCode: " 1000-100 ",
      region: " Center ",
    },
    contactPerson: " John ",
    cuisineType: ["Italian"],
    categories: ["Pizza", "Pasta"],
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
    expect(formValues.categories).toEqual(["Pizza", "Pasta"]);
    expect(formValues.cuisineType).toEqual(["Italian"]);
    expect(formValues.address.doorNumber).toBe("2");
    expect(formValues.address.complement).toBe("Floor 1");
    expect(formValues.reportingConfig.weeklyReportStartDay).toBe(1);
  });

  it("builds backend-compatible FormData payload", () => {
    const values = businessDtoToFormValues(makeBusinessDto());
    const payload = formValuesToUpdatePayload(values);

    expect(payload.get("tradeName")).toBe("Imperium Kitchen");
    expect(payload.get("legalName")).toBe("Imperium Kitchen LLC");
    expect(payload.get("subscription")).toBe("Free");

    const address = JSON.parse(String(payload.get("address"))) as Record<string, string>;
    expect(address.country).toBe("PT");
    expect(address.city).toBe("Lisbon");
    expect(address.doorNumber).toBe("2");
    expect(address.complement).toBe("Floor 1");

    const categories = JSON.parse(String(payload.get("categories"))) as string[];
    expect(categories).toEqual(["Pizza", "Pasta"]);
    const cuisinePayload = JSON.parse(String(payload.get("cuisineType"))) as string[];
    expect(cuisinePayload).toEqual(["Italian"]);
    expect(payload.get("contactPerson")).toBe("John");
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
    const schema = buildBusinessProfileSchema(schemaMessages);
    const values = businessDtoToFormValues(makeBusinessDto());
    const parsed = schema.safeParse(values);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid day/time windows", () => {
    const schema = buildBusinessProfileSchema(schemaMessages);
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

  it("uses caller-supplied image and range messages", () => {
    const schema = buildBusinessProfileSchema({
      ...schemaMessages,
      invalidImage: "Imagen no válida.",
      openingRange: "La apertura debe terminar después.",
      deliveryRange: "La entrega debe terminar después.",
    });
    const values = businessDtoToFormValues(makeBusinessDto());
    values.imageFile = "not-a-file" as unknown as File;
    values.businessOpeningHours = [
      { dayOfWeek: 1, openTime: "18:00", closeTime: "09:00" },
    ];
    values.deliveryOpeningWindows = [
      {
        dayOfWeek: 1,
        windows: [{ openTime: "18:00", closeTime: "09:00" }],
      },
    ];

    const parsed = schema.safeParse(values);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      expect(messages).toContain("Imagen no válida.");
      expect(messages).toContain("La apertura debe terminar después.");
      expect(messages).toContain("La entrega debe terminar después.");
    }
  });
});
