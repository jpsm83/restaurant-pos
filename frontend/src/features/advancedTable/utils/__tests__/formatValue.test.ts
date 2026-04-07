import { describe, expect, it } from "vitest";
import { formatSafeValue } from "../formatValue";

describe("formatValue", () => {
  it("formats primitives and falls back for empty/null values", () => {
    expect(formatSafeValue("  hi  ")).toBe("hi");
    expect(formatSafeValue("   ")).toBe("-");
    expect(formatSafeValue(null)).toBe("-");
    expect(formatSafeValue(10)).toBe("10");
    expect(formatSafeValue(false)).toBe("false");
    expect(formatSafeValue({ a: 1 })).toBe('{"a":1}');
  });
});
