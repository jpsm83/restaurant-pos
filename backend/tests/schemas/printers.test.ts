import { describe, it, expect } from "vitest";
import { z } from "zod";

import { mainCategoriesEnums } from "restaurant-pos-packages/enums";
import {
  configurationSetupBodySchema,
  configurationSetupParamsSchema,
  createPrinterBodySchema,
  mainCategorySchema,
  printerIdParamsSchema,
  printersIncludeDeletedQuerySchema,
  printersByBusinessParamsSchema,
  updatePrinterBodySchema,
} from "../../src/schemas/printers.ts";

const VALID_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

describe("createPrinterBodySchema", () => {
  const valid = {
    printerAlias: "Desert Printer",
    ipAddress: "192.168.1.100",
    port: 9100,
    businessId: VALID_ID,
  };

  it("accepts the minimum required fields", () => {
    expect(createPrinterBodySchema.safeParse(valid).success).toBe(true);
  });

  it("requires printerAlias, ipAddress, port and businessId", () => {
    for (const key of [
      "printerAlias",
      "ipAddress",
      "port",
      "businessId",
    ] as const) {
      const payload: Record<string, unknown> = { ...valid };
      delete payload[key];
      expect(
        createPrinterBodySchema.safeParse(payload).success,
        `missing ${key} should fail`,
      ).toBe(false);
    }
  });

  it("coerces a numeric-string port", () => {
    const parsed = createPrinterBodySchema.parse({ ...valid, port: "9100" });
    expect(parsed.port).toBe(9100);
  });

  it("rejects a non-numeric port", () => {
    expect(
      createPrinterBodySchema.safeParse({ ...valid, port: "abc" }).success,
    ).toBe(false);
  });

  it("rejects a non-positive port", () => {
    expect(
      createPrinterBodySchema.safeParse({ ...valid, port: 0 }).success,
    ).toBe(false);
  });

  it("trims an ObjectId", () => {
    const parsed = createPrinterBodySchema.parse({
      ...valid,
      businessId: `  ${VALID_ID}  `,
    });
    expect(parsed.businessId).toBe(VALID_ID);
  });

  it("rejects a malformed businessId", () => {
    expect(
      createPrinterBodySchema.safeParse({ ...valid, businessId: "invalid-id" })
        .success,
    ).toBe(false);
  });

  it("accepts an optional backupPrinterId and rejects a malformed one", () => {
    expect(
      createPrinterBodySchema.safeParse({ ...valid, backupPrinterId: OTHER_ID })
        .success,
    ).toBe(true);
    expect(
      createPrinterBodySchema.safeParse({ ...valid, backupPrinterId: "nope" })
        .success,
    ).toBe(false);
  });

  it("accepts ObjectId employee arrays and rejects a malformed id", () => {
    const parsed = createPrinterBodySchema.parse({
      ...valid,
      employeesAllowedToPrintDataIds: [VALID_ID, OTHER_ID],
    });
    expect(parsed.employeesAllowedToPrintDataIds).toEqual([VALID_ID, OTHER_ID]);
    expect(
      createPrinterBodySchema.safeParse({
        ...valid,
        employeesAllowedToPrintDataIds: ["nope"],
      }).success,
    ).toBe(false);
  });

  it("sanitizes the description as free text", () => {
    const parsed = createPrinterBodySchema.parse({
      ...valid,
      description: "  <b>Front</b> desk\n\n\nprinter  ",
    });
    expect(parsed.description).toBe("Front desk\n\nprinter");
  });

  it("rejects the server-owned printerStatus", () => {
    expect(
      createPrinterBodySchema.safeParse({ ...valid, printerStatus: "Online" })
        .success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      createPrinterBodySchema.safeParse({ ...valid, configurationSetupToPrintOrders: [] })
        .success,
    ).toBe(false);
  });
});

describe("updatePrinterBodySchema", () => {
  it("accepts an empty body", () => {
    expect(updatePrinterBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial update", () => {
    expect(
      updatePrinterBodySchema.safeParse({
        printerAlias: "Renamed",
        port: 9101,
      }).success,
    ).toBe(true);
  });

  it("rejects the server-owned businessId", () => {
    expect(
      updatePrinterBodySchema.safeParse({ businessId: VALID_ID }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      updatePrinterBodySchema.safeParse({ printerStatus: "Online" }).success,
    ).toBe(false);
  });
});

describe("printer params schemas", () => {
  it.each([
    [printerIdParamsSchema, "printerId"],
    [printersByBusinessParamsSchema, "businessId"],
  ] as const)("accepts a valid ObjectId and rejects junk/unknown keys", (schema, key) => {
    expect(schema.safeParse({ [key]: VALID_ID }).success).toBe(true);
    expect(schema.safeParse({ [key]: "invalid-id" }).success).toBe(false);
    expect(schema.safeParse({ [key]: VALID_ID, extra: "x" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("requires both printerId and configId", () => {
    expect(
      configurationSetupParamsSchema.safeParse({
        printerId: VALID_ID,
        configId: OTHER_ID,
      }).success,
    ).toBe(true);
    expect(
      configurationSetupParamsSchema.safeParse({ printerId: VALID_ID }).success,
    ).toBe(false);
  });
});

describe("configurationSetupBodySchema", () => {
  const valid = {
    mainCategory: "Food",
    salesPointIds: [VALID_ID],
  };

  it("accepts the minimum required fields", () => {
    expect(configurationSetupBodySchema.safeParse(valid).success).toBe(true);
  });

  it.each(mainCategoriesEnums)("accepts the mainCategory %s", (value) => {
    expect(
      configurationSetupBodySchema.safeParse({ ...valid, mainCategory: value })
        .success,
    ).toBe(true);
  });

  it("rejects a mainCategory outside the shared enum", () => {
    expect(
      configurationSetupBodySchema.safeParse({
        ...valid,
        mainCategory: "Bogus",
      }).success,
    ).toBe(false);
  });

  it("accepts optional subCategories and excludeEmployeeIds", () => {
    const parsed = configurationSetupBodySchema.parse({
      ...valid,
      subCategories: ["Main"],
      excludeEmployeeIds: [OTHER_ID],
    });
    expect(parsed.subCategories).toEqual(["Main"]);
    expect(parsed.excludeEmployeeIds).toEqual([OTHER_ID]);
  });

  it("rejects malformed ObjectId arrays", () => {
    expect(
      configurationSetupBodySchema.safeParse({ ...valid, salesPointIds: ["nope"] })
        .success,
    ).toBe(false);
    expect(
      configurationSetupBodySchema.safeParse({
        ...valid,
        excludeEmployeeIds: ["nope"],
      }).success,
    ).toBe(false);
  });
});

describe("mainCategorySchema is pinned to the shared enum", () => {
  it.each(mainCategoriesEnums)("accepts %s", (value) => {
    expect(mainCategorySchema.safeParse(value).success).toBe(true);
  });

  it("rejects a value outside the shared enum", () => {
    expect(mainCategorySchema.safeParse("Bogus").success).toBe(false);
  });
});

describe("server-owned fields are excluded from every printers DTO", () => {
  const dtoSchemas: Record<string, z.ZodObject> = {
    createPrinterBodySchema,
    updatePrinterBodySchema,
    printerIdParamsSchema,
    configurationSetupParamsSchema,
    configurationSetupBodySchema,
    printersByBusinessParamsSchema,
    printersIncludeDeletedQuerySchema,
  };

  it.each(Object.entries(dtoSchemas))(
    "%s has no server-owned key",
    (_name, schema) => {
      const keys = Object.keys(schema.shape);
      expect(keys).not.toContain("_id");
      expect(keys).not.toContain("createdAt");
      expect(keys).not.toContain("updatedAt");
      expect(keys).not.toContain("printerStatus");
    },
  );
});
