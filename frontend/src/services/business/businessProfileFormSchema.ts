import { z } from "zod";
import {
  currenctyEnums,
  cuisineTypeEnums,
  foodSubCategoryEnums,
  subscriptionEnums,
} from "domain/enums";

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

type BusinessProfileSchemaMessages = {
  required: string;
  invalidSubscription: string;
  invalidCurrency: string;
  invalidTime: string;
  invalidDayOfWeek: string;
  invalidNonNegative: string;
  invalidWeeklyStartDay: string;
};

const defaultMessages: BusinessProfileSchemaMessages = {
  required: "This field is required.",
  invalidSubscription: "Invalid subscription.",
  invalidCurrency: "Invalid currency.",
  invalidTime: "Time must be in HH:MM format.",
  invalidDayOfWeek: "Day of week must be an integer from 0 to 6.",
  invalidNonNegative: "Value must be a non-negative number.",
  invalidWeeklyStartDay: "Weekly report start day must be between 0 and 6.",
};

const subscriptionTuple = subscriptionEnums as [string, ...string[]];
const currencyTuple = currenctyEnums as [string, ...string[]];
const foodSubCategoryTuple = foodSubCategoryEnums as [string, ...string[]];
const cuisineTypeTuple = cuisineTypeEnums as [string, ...string[]];

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

function isStrictlyIncreasingTimeRange(start: string, end: string): boolean {
  return toMinutes(start) < toMinutes(end);
}

export function buildBusinessProfileSchema(
  partialMessages?: Partial<BusinessProfileSchemaMessages>,
) {
  const m: BusinessProfileSchemaMessages = {
    ...defaultMessages,
    ...partialMessages,
  };

  const requiredString = z.string().trim().min(1, m.required);
  const timeString = z
    .string()
    .trim()
    .regex(HHMM_REGEX, m.invalidTime);

  return z
    .object({
      subscription: z.enum(subscriptionTuple, m.invalidSubscription),
      imageUrl: z.string(),
      imageFile: z.custom<File | null>(
        (value) => value === null || value instanceof File,
        { message: "Invalid image file." },
      ),
      tradeName: requiredString,
      legalName: requiredString,
      phoneNumber: requiredString,
      taxNumber: requiredString,
      currencyTrade: z.enum(currencyTuple, m.invalidCurrency),
      address: z.object({
        country: requiredString,
        state: requiredString,
        city: requiredString,
        street: requiredString,
        buildingNumber: requiredString,
        doorNumber: z.string(),
        complement: z.string(),
        postCode: requiredString,
        region: z.string(),
      }),
      contactPerson: z.string(),
      cuisineType: z.array(z.enum(cuisineTypeTuple)),
      categories: z.array(z.enum(foodSubCategoryTuple)),
      acceptsDelivery: z.boolean(),
      deliveryRadius: z
        .number({ error: m.invalidNonNegative })
        .nonnegative(m.invalidNonNegative)
        .nullable(),
      minOrder: z
        .number({ error: m.invalidNonNegative })
        .nonnegative(m.invalidNonNegative)
        .nullable(),
      metrics: z.object({
        foodCostPercentage: z.number().nonnegative(m.invalidNonNegative),
        beverageCostPercentage: z.number().nonnegative(m.invalidNonNegative),
        laborCostPercentage: z.number().nonnegative(m.invalidNonNegative),
        fixedCostPercentage: z.number().nonnegative(m.invalidNonNegative),
        supplierGoodWastePercentage: z.object({
          veryLowBudgetImpact: z.number().nonnegative(m.invalidNonNegative),
          lowBudgetImpact: z.number().nonnegative(m.invalidNonNegative),
          mediumBudgetImpact: z.number().nonnegative(m.invalidNonNegative),
          hightBudgetImpact: z.number().nonnegative(m.invalidNonNegative),
          veryHightBudgetImpact: z.number().nonnegative(m.invalidNonNegative),
        }),
      }),
      businessOpeningHours: z.array(
        z
          .object({
            dayOfWeek: z
              .number()
              .int(m.invalidDayOfWeek)
              .min(0, m.invalidDayOfWeek)
              .max(6, m.invalidDayOfWeek),
            openTime: timeString,
            closeTime: timeString,
          })
          .refine(
            (row) => isStrictlyIncreasingTimeRange(row.openTime, row.closeTime),
            {
              message: "Opening range must have closeTime after openTime.",
              path: ["closeTime"],
            },
          ),
      ),
      deliveryOpeningWindows: z.array(
        z.object({
          dayOfWeek: z
            .number()
            .int(m.invalidDayOfWeek)
            .min(0, m.invalidDayOfWeek)
            .max(6, m.invalidDayOfWeek),
          windows: z.array(
            z
              .object({
                openTime: timeString,
                closeTime: timeString,
              })
              .refine(
                (row) =>
                  isStrictlyIncreasingTimeRange(row.openTime, row.closeTime),
                {
                  message: "Delivery range must have closeTime after openTime.",
                  path: ["closeTime"],
                },
              ),
          ),
        }),
      ),
      reportingConfig: z.object({
        weeklyReportStartDay: z
          .number()
          .int(m.invalidWeeklyStartDay)
          .min(0, m.invalidWeeklyStartDay)
          .max(6, m.invalidWeeklyStartDay)
          .nullable(),
      }),
    });
}

export type BusinessProfileSchema = ReturnType<typeof buildBusinessProfileSchema>;
export type BusinessProfileSchemaValues = z.infer<BusinessProfileSchema>;
