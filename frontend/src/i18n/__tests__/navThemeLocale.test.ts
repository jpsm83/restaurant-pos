import { describe, expect, it } from "vitest";
import en from "../locales/en/nav.json";
import es from "../locales/es/nav.json";

function flattenKeys(
  value: Record<string, unknown>,
  prefix = "",
): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return flattenKeys(entry as Record<string, unknown>, path);
    }
    return [path];
  });
}

describe("nav locale theme labels", () => {
  it("keeps English and Spanish keys in parity", () => {
    expect(flattenKeys(es).sort()).toEqual(flattenKeys(en).sort());
  });

  it("provides Light, Dark, and System labels in both languages", () => {
    expect(en.account.theme).toEqual({
      label: "Theme",
      light: "Light",
      dark: "Dark",
      system: "System",
    });
    expect(es.account.theme).toEqual({
      label: "Tema",
      light: "Claro",
      dark: "Oscuro",
      system: "Sistema",
    });
  });
});
