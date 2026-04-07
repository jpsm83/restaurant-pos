import { describe, expect, it } from "vitest";
import { reconcileColumnState } from "../columnStateReconciliation";

describe("columnStateReconciliation", () => {
  it("drops unavailable columns and appends missing available columns", () => {
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
});
