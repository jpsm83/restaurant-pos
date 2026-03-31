import { describe, expect, it } from "vitest";
import {
  buildReorderedColumns,
  resolveInitialColumnOrder,
  resolveInitialColumnVisibility,
} from "../useEnhancedTable";

describe("useEnhancedTable helper functions", () => {
  it("resolves initial column order and visibility with fallback", () => {
    expect(resolveInitialColumnOrder(["b", "a"], ["a"])).toEqual(["b", "a"]);
    expect(resolveInitialColumnOrder([], ["a"])).toEqual(["a"]);

    expect(resolveInitialColumnVisibility({ a: false }, { a: true })).toEqual({ a: false });
    expect(resolveInitialColumnVisibility({}, { a: true })).toEqual({ a: true });
  });

  it("reorders columns deterministically", () => {
    expect(buildReorderedColumns(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(buildReorderedColumns(["a", "b", "c"], "b", "b")).toEqual(["a", "b", "c"]);
    expect(buildReorderedColumns(["a", "b", "c"], "x", "b")).toEqual(["a", "b", "c"]);
  });
});
