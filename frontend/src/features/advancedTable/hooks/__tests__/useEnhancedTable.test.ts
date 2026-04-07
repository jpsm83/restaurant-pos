import { describe, expect, it } from "vitest";
import {
  buildReorderedColumns,
  resolveInitialColumnOrder,
  resolveInitialColumnVisibility,
} from "../useEnhancedTable";

describe("useEnhancedTable exports", () => {
  it("resolves initial visibility/order with fallbacks", () => {
    expect(resolveInitialColumnVisibility({ a: true }, { b: false })).toEqual({ a: true });
    expect(resolveInitialColumnVisibility(undefined, { b: false })).toEqual({ b: false });

    expect(resolveInitialColumnOrder(["b", "a"], ["x"])).toEqual(["b", "a"]);
    expect(resolveInitialColumnOrder([], ["x"])).toEqual(["x"]);
  });

  it("reorders columns when drag and target are valid", () => {
    const current = ["a", "b", "c"];
    expect(buildReorderedColumns(current, "a", "c")).toEqual(["b", "c", "a"]);
    expect(buildReorderedColumns(current, "a", "a")).toEqual(current);
    expect(buildReorderedColumns(current, "x", "a")).toEqual(current);
  });
});
