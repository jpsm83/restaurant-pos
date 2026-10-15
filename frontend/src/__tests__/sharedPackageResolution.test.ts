import { describe, expect, it } from "vitest";
import { mainCategoriesEnums } from "domain/enums";
import type { IAddress } from "domain/interfaces/IAddress";
import { emailSchema } from "domain/schemas/primitives";
import { isValidPassword } from "domain/utils/passwordPolicy";
import { Button } from "ui/button";
import { cn } from "ui/utils";

const formatAddress = (address: IAddress): string =>
  `${address.city}, ${address.country}`;

/**
 * Workspace-boundary smoke test: the frontend resolves the shared package by
 * name through the root npm workspace, not a hand-maintained path alias.
 */
describe("shared package resolution", () => {
  it("resolves enums, schemas/primitives, interfaces, and utils by package name", () => {
    expect(mainCategoriesEnums).toContain("Food");

    expect(emailSchema.safeParse("owner@restaurant.test").success).toBe(true);
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(isValidPassword("Passw0rd!")).toBe(true);
    expect(isValidPassword("weak")).toBe(false);

    expect(
      formatAddress({
        country: "PT",
        state: "Lisboa",
        city: "Lisbon",
        street: "Rua A",
        buildingNumber: "1",
        postCode: "1000-000",
      }),
    ).toBe("Lisbon, PT");
  });

  it("resolves the design system's primitives and cn by package name", () => {
    expect(typeof Button).toBe("function");
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
