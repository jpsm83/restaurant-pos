import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { mainCategoriesEnums } from "domain/enums";
import type { IAddress } from "domain/interfaces/IAddress";
import { emailSchema } from "domain/schemas/primitives";
import { isValidPassword } from "domain/utils/passwordPolicy";

const require = createRequire(import.meta.url);
const configRoot = dirname(require.resolve("config/package.json"));

const formatAddress = (address: IAddress): string =>
  `${address.city}, ${address.country}`;

/**
 * Workspace-boundary smoke test: the backend resolves the shared package by
 * name through the root npm workspace, not a relative `../../packages` path.
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
});

/**
 * Workspace-boundary smoke test: the shared build tooling resolves from the
 * `config` workspace by package name through its `exports` map — not a copied
 * eslint/tsconfig/tailwind file or a relative `../../packages` path.
 */
describe("config package resolution", () => {
  it("resolves the shared TypeScript base config, ESLint config, and Tailwind preset by package name", () => {
    const tsconfig = JSON.parse(
      readFileSync(require.resolve("config/tsconfig.base.json"), "utf8"),
    );

    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(require.resolve("config/eslint")).toContain(configRoot);
    expect(require.resolve("config/tailwind.css")).toContain(configRoot);
  });
});
