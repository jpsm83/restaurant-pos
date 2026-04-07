import { describe, expect, it } from "vitest";
import {
  mapBackendRowsToTableRows,
  normalizeNullableRecordValues,
} from "../dataMapping";

describe("dataMapping", () => {
  it("normalizes nullable values in a mapped row", () => {
    expect(normalizeNullableRecordValues({ a: null, b: 2 })).toEqual({
      a: "-",
      b: 2,
    });
  });

  it("maps rows from supported payload containers and supports null normalization", () => {
    const rows = mapBackendRowsToTableRows(
      { data: [{ name: "A", qty: null }] },
      (row: { name: string; qty: number | null }, index) => ({
        id: `row-${index}`,
        name: row.name,
        qty: row.qty,
      }),
      { normalizeNulls: true, emptyFallback: "-" },
    );

    expect(rows).toEqual([
      { id: "row-0", name: "A", qty: "-" },
    ]);
  });

  it("returns empty array for unsupported payload shape", () => {
    const rows = mapBackendRowsToTableRows(
      { unexpected: true },
      (row: { value: string }) => ({ value: row.value }),
    );
    expect(rows).toEqual([]);
  });
});
