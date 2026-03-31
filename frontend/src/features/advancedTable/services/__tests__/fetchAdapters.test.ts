import { describe, expect, it } from "vitest";
import {
  createFetchTransformAdapters,
  defaultParamsMapper,
  defaultResponseMapper,
} from "../fetchAdapters";

describe("advancedTable fetchAdapters", () => {
  it("uses default adapters when none provided", () => {
    const adapters = createFetchTransformAdapters();

    expect(adapters.mapParams({ page: 1 })).toEqual({ page: 1 });
    expect(adapters.mapResponse([{ id: "1" }])).toEqual([{ id: "1" }]);
  });

  it("uses custom adapter overrides", () => {
    const adapters = createFetchTransformAdapters({
      mapParams: (params: { q: string }) => ({ search: params.q }),
      mapResponse: (raw) => (raw as { data: Array<{ id: string }> }).data,
    });

    expect(adapters.mapParams({ q: "lane" })).toEqual({ search: "lane" });
    expect(adapters.mapResponse({ data: [{ id: "9" }] })).toEqual([{ id: "9" }]);
  });

  it("exports default mapper helpers", () => {
    expect(defaultParamsMapper({ a: 1 })).toEqual({ a: 1 });
    expect(defaultResponseMapper([{ x: true }])).toEqual([{ x: true }]);
    expect(defaultResponseMapper([{ x: null }])).toEqual([{ x: "-" }]);
  });
});
