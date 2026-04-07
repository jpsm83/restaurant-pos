import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  getInitialDropdownState,
  getNextSelectedValues,
  reconcileDropdownStateWithVisibleColumns,
  reconcileFilterInputsWithVisibleColumns,
  useTableFilters,
} from "../useTableFilters";

describe("useTableFilters", () => {
  it("covers pure helper functions", () => {
    expect(
      getInitialDropdownState([
        { columnId: "status", filterType: "dropdown", options: [{ value: "open", label: "Open" }] },
      ]),
    ).toEqual({
      status: { selectedValues: ["open"], isOpen: false },
    });
    expect(getNextSelectedValues(["a"], "b", true)).toEqual(["a", "b"]);
    expect(reconcileFilterInputsWithVisibleColumns({ a: "x", b: "y" }, ["b"])).toEqual({ a: "x" });
    expect(
      reconcileDropdownStateWithVisibleColumns(
        { a: { selectedValues: ["1"], isOpen: true }, b: { selectedValues: ["2"], isOpen: false } },
        ["a"],
      ),
    ).toEqual({ b: { selectedValues: ["2"], isOpen: false } });
  });

  it("updates dropdown state and forwards filter operations to table columns", () => {
    const setFilterValue = vi.fn();
    const table = {
      getColumn: () => ({ setFilterValue }),
      resetColumnFilters: vi.fn(),
      getAllColumns: () => [{ id: "status", getIsVisible: () => false }],
    } as never;

    const { result } = renderHook(() =>
      useTableFilters(table, [
        {
          columnId: "status",
          filterType: "dropdown",
          options: [
            { value: "open", label: "Open" },
            { value: "closed", label: "Closed" },
          ],
        },
      ]),
    );

    act(() => {
      result.current.onDropdownOpenChange("status", true);
      result.current.onDropdownToggleOption("status", "open", false);
    });
    expect(setFilterValue).toHaveBeenCalled();

    act(() => {
      result.current.clearAllFilters();
      result.current.clearHiddenColumnFilters();
      result.current.closeAllDropdowns();
    });
  });
});
