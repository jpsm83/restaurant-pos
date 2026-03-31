import { describe, expect, it } from "vitest";
import {
  buildEnabledColumnIds,
  createDetailsRenderContext,
  getNextRecordByDirection,
  resolveExportAction,
  resolveSelectedIndex,
  resolveTableRenderState,
  resolveTableRows,
  shouldUseFetchMode,
} from "../StandaloneAdvancedTable.helpers";

describe("StandaloneAdvancedTable helpers", () => {
  it("builds enabled column ids from column definitions", () => {
    const ids = buildEnabledColumnIds([
      { id: "lane", header: "Lane" },
      { id: "status", header: "Status" },
    ]);

    expect(ids).toEqual(["lane", "status"]);
  });

  it("resolves fetch mode and row source", () => {
    expect(
      shouldUseFetchMode(undefined, { queryKey: () => ["q"], params: {}, queryFn: async () => [] })
    ).toBe(true);
    expect(shouldUseFetchMode([], { queryKey: () => ["q"], params: {}, queryFn: async () => [] })).toBe(false);
    expect(shouldUseFetchMode(undefined, undefined)).toBe(false);

    expect(resolveTableRows([{ id: 1 }], [{ id: 2 }], false)).toEqual([{ id: 1 }]);
    expect(resolveTableRows(undefined, [{ id: 2 }], true)).toEqual([{ id: 2 }]);
  });

  it("resolves render state for loading, error, empty and ready", () => {
    expect(
      resolveTableRenderState({
        useFetchMode: true,
        isLoading: true,
        isError: false,
        rowsLength: 0,
      })
    ).toBe("loading");

    expect(
      resolveTableRenderState({
        useFetchMode: true,
        isLoading: false,
        isError: true,
        rowsLength: 0,
      })
    ).toBe("error");

    expect(
      resolveTableRenderState({
        useFetchMode: false,
        isLoading: false,
        isError: false,
        rowsLength: 0,
      })
    ).toBe("empty");

    expect(
      resolveTableRenderState({
        useFetchMode: false,
        isLoading: false,
        isError: false,
        rowsLength: 2,
      })
    ).toBe("ready");
  });

  it("resolves selected index and navigates records by direction", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(resolveSelectedIndex(rows, rows[1])).toBe(1);
    expect(resolveSelectedIndex(rows, null)).toBe(-1);

    expect(getNextRecordByDirection(rows, 1, "previous")).toEqual({ id: "a" });
    expect(getNextRecordByDirection(rows, 1, "next")).toEqual({ id: "c" });
    expect(getNextRecordByDirection(rows, 0, "previous")).toBeNull();
    expect(getNextRecordByDirection(rows, 2, "next")).toBeNull();
  });

  it("creates generic details render context", () => {
    const close = () => undefined;
    const navigatePrevious = () => undefined;
    const navigateNext = () => undefined;

    const context = createDetailsRenderContext({
      index: 2,
      total: 5,
      close,
      navigatePrevious,
      navigateNext,
    });

    expect(context.index).toBe(2);
    expect(context.total).toBe(5);
    expect(context.close).toBe(close);
    expect(context.navigatePrevious).toBe(navigatePrevious);
    expect(context.navigateNext).toBe(navigateNext);
  });

  it("resolves export action precedence", () => {
    const external = () => undefined;
    const internal = () => undefined;

    expect(resolveExportAction(external, internal, true)).toBe(external);
    expect(resolveExportAction(undefined, internal, true)).toBe(internal);
    expect(resolveExportAction(undefined, internal, false)).toBeUndefined();
  });
});
