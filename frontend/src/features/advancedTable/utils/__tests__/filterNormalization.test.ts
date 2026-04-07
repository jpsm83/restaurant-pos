import { describe, expect, it } from "vitest";
import {
  normalizeDropdownFilterValues,
  normalizeInputFilterValue,
} from "../filterNormalization";

describe("filterNormalization", () => {
  it("normalizes input text and dropdown arrays", () => {
    expect(normalizeInputFilterValue("  abc  ")).toBe("abc");
    expect(normalizeInputFilterValue(null)).toBe("");
    expect(normalizeInputFilterValue(10)).toBe("10");

    expect(
      normalizeDropdownFilterValues(["  A ", "A", "", "B", null, "B"]),
    ).toEqual(["A", "B"]);
    expect(normalizeDropdownFilterValues("not-array")).toEqual([]);
  });
});
