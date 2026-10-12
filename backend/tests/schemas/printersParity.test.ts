import { describe, it, expect } from "vitest";
import type { z } from "zod";

import Printer from "../../src/models/printer.ts";
import { mainCategoriesEnums } from "restaurant-pos-packages/enums";
import {
  configurationSetupBodySchema,
  configurationSetupParamsSchema,
  createPrinterBodySchema,
  mainCategorySchema,
  printerIdParamsSchema,
  printersByBusinessParamsSchema,
  updatePrinterBodySchema,
} from "../../src/schemas/printers.ts";

/**
 * Parity between the printers DTOs and the Printer model (the domain source of
 * truth): every field a client may send must exist on the model, and every
 * server-owned field must exist on the model but never in a DTO.
 */

const printerOwns = (field: string): boolean =>
  Boolean(Printer.schema.path(field));

const configSubSchema = (
  Printer.schema.path("configurationSetupToPrintOrders") as unknown as {
    schema?: { path: (name: string) => { enumValues?: string[] } | undefined };
  }
).schema;

const allDtos: Record<string, z.ZodObject> = {
  createPrinterBodySchema,
  updatePrinterBodySchema,
  printerIdParamsSchema,
  configurationSetupParamsSchema,
  configurationSetupBodySchema,
  printersByBusinessParamsSchema,
};

describe("printers DTO ↔ model parity", () => {
  it("every create-printer field maps to a Printer model field", () => {
    for (const key of Object.keys(createPrinterBodySchema.shape)) {
      expect(
        printerOwns(key),
        `createPrinter.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("every update-printer field maps to a Printer model field", () => {
    for (const key of Object.keys(updatePrinterBodySchema.shape)) {
      expect(
        printerOwns(key),
        `updatePrinter.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("every configuration-setup field maps to the model subdocument", () => {
    for (const key of Object.keys(configurationSetupBodySchema.shape)) {
      expect(
        Boolean(configSubSchema?.path(key)),
        `configurationSetup.${key} should map to a model field`,
      ).toBe(true);
    }
  });

  it("the DTO mainCategory enum matches the model and shared enums", () => {
    const enumValues = configSubSchema?.path("mainCategory")?.enumValues ?? [];

    expect([...enumValues].sort()).toEqual([...mainCategoriesEnums].sort());

    for (const value of mainCategoriesEnums) {
      expect(
        mainCategorySchema.safeParse(value).success,
        `${value} should be accepted`,
      ).toBe(true);
    }
    expect(mainCategorySchema.safeParse("Bogus").success).toBe(false);
  });

  it("server-owned fields are owned by Printer but accepted by no DTO", () => {
    for (const field of ["createdAt", "updatedAt", "printerStatus"]) {
      expect(printerOwns(field), `${field} should be owned by Printer`).toBe(true);
      for (const [name, schema] of Object.entries(allDtos)) {
        expect(
          Object.keys(schema.shape),
          `${name} should not accept ${field}`,
        ).not.toContain(field);
      }
    }
  });
});
