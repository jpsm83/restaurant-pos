import { describe, expect, it } from "vitest";
import { normalizeColumns } from "../columnNormalization";
import {
  normalizeDropdownFilterValues,
  normalizeInputFilterValue,
} from "../filterNormalization";
import { reconcileColumnState } from "../columnStateReconciliation";
import { formatSafeValue } from "../formatValue";

describe("advancedTable core utils", () => {
  it("normalizes columns and removes invalid ids", () => {
    const result = normalizeColumns([
      { id: " lane ", header: "Lane" },
      { id: "", header: "Invalid" },
      { id: "status", header: "Status" },
    ]);

    expect(result).toEqual([
      { id: "lane", header: "Lane" },
      { id: "status", header: "Status" },
    ]);
  });

  it("normalizes input and dropdown filter values", () => {
    expect(normalizeInputFilterValue("  abc  ")).toBe("abc");
    expect(normalizeInputFilterValue(null)).toBe("");

    expect(
      normalizeDropdownFilterValues(["  A ", "A", "", "B", null, "B"])
    ).toEqual(["A", "B"]);
  });

  it("reconciles column order and visibility against available columns", () => {
    const result = reconcileColumnState({
      availableColumnIds: ["a", "b", "c"],
      order: ["b", "x", "a"],
      visibility: { a: false, x: false },
    });

    expect(result.order).toEqual(["b", "a", "c"]);
    expect(result.visibility).toEqual({
      a: false,
      b: true,
      c: true,
    });
  });

  it("formats safe values with fallback behavior", () => {
    expect(formatSafeValue("  hi  ")).toBe("hi");
    expect(formatSafeValue("   ")).toBe("-");
    expect(formatSafeValue(null)).toBe("-");
    expect(formatSafeValue(10)).toBe("10");
    expect(formatSafeValue({ a: 1 })).toBe('{"a":1}');
  });
});
