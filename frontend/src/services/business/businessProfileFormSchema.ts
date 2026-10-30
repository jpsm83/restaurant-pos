import { z } from "zod";
import {
  currenctyEnums,
  cuisineTypeEnums,
  foodSubCategoryEnums,
  subscriptionEnums,
} from "restaurant-pos-packages/enums";

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

type BusinessProfileSchemaMessages = {
  invalidSubscription: string;
  invalidCurrency: string;
  invalidTime: string;
  invalidDayOfWeek: string;
  invalidNonNegative: string;
  invalidWeeklyStartDay: string;
  invalidImage: string;
  openingRange: string;
  deliveryRange: string;
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
  messages: BusinessProfileSchemaMessages,
) {
  const optionalString = z.string().trim();
  const optionalEnum = (values: readonly string[], message: string) => {
    const allowed = new Set(values);
    return z
      .string()
      .trim()
      .refine((value) => value === "" || allowed.has(value), message);
  };
  const timeString = optionalString.regex(HHMM_REGEX, messages.invalidTime);

  return z
    .object({
      subscription: optionalEnum(
        subscriptionTuple,
        messages.invalidSubscription,
      ),
      imageUrl: z.string(),
      imageFile: z.custom<File | null>(
        (value) => value === null || value instanceof File,
        { message: messages.invalidImage },
      ),
      tradeName: optionalString,
      phoneNumber: optionalString,
      currencyTrade: optionalEnum(currencyTuple, messages.invalidCurrency),
      address: z.object({
        country: optionalString,
        state: optionalString,
        city: optionalString,
        street: optionalString,
        buildingNumber: optionalString,
        doorNumber: z.string(),
        complement: z.string(),
        postCode: optionalString,
        region: z.string(),
      }),
      contactPerson: z.string(),
      cuisineType: z.array(z.enum(cuisineTypeTuple)),
      categories: z.array(z.enum(foodSubCategoryTuple)),
      acceptsDelivery: z.boolean(),
      deliveryRadius: z
        .number({ error: messages.invalidNonNegative })
        .nonnegative(messages.invalidNonNegative)
        .nullable(),
      minOrder: z
        .number({ error: messages.invalidNonNegative })
        .nonnegative(messages.invalidNonNegative)
        .nullable(),
      metrics: z.object({
        foodCostPercentage: z.number().nonnegative(messages.invalidNonNegative),
        beverageCostPercentage: z.number().nonnegative(messages.invalidNonNegative),
        laborCostPercentage: z.number().nonnegative(messages.invalidNonNegative),
        fixedCostPercentage: z.number().nonnegative(messages.invalidNonNegative),
        supplierGoodWastePercentage: z.object({
          veryLowBudgetImpact: z.number().nonnegative(messages.invalidNonNegative),
          lowBudgetImpact: z.number().nonnegative(messages.invalidNonNegative),
          mediumBudgetImpact: z.number().nonnegative(messages.invalidNonNegative),
          hightBudgetImpact: z.number().nonnegative(messages.invalidNonNegative),
          veryHightBudgetImpact: z.number().nonnegative(messages.invalidNonNegative),
        }),
      }),
      businessOpeningHours: z.array(
        z
          .object({
            dayOfWeek: z
              .number()
              .int(messages.invalidDayOfWeek)
              .min(0, messages.invalidDayOfWeek)
              .max(6, messages.invalidDayOfWeek),
            openTime: timeString,
            closeTime: timeString,
          })
          .refine(
            (row) => isStrictlyIncreasingTimeRange(row.openTime, row.closeTime),
            {
              message: messages.openingRange,
              path: ["closeTime"],
            },
          ),
      ),
      deliveryOpeningWindows: z.array(
        z.object({
          dayOfWeek: z
            .number()
            .int(messages.invalidDayOfWeek)
            .min(0, messages.invalidDayOfWeek)
            .max(6, messages.invalidDayOfWeek),
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
                  message: messages.deliveryRange,
                  path: ["closeTime"],
                },
              ),
          ),
        }),
      ),
      reportingConfig: z.object({
        weeklyReportStartDay: z
          .number()
          .int(messages.invalidWeeklyStartDay)
          .min(0, messages.invalidWeeklyStartDay)
          .max(6, messages.invalidWeeklyStartDay)
          .nullable(),
      }),
    });
}

export type BusinessProfileSchema = ReturnType<typeof buildBusinessProfileSchema>;
export type BusinessProfileSchemaValues = z.infer<BusinessProfileSchema>;
