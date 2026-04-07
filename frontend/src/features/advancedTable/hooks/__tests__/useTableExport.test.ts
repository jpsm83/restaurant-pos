import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  getFilteredRows,
  getVisibleExportColumns,
  useTableExport,
} from "../useTableExport";

const mockExportRowsToExcel = vi.fn(async () => undefined);

vi.mock("@/features/advancedTable/services/exportService", () => ({
  exportRowsToExcel: (...args: unknown[]) => mockExportRowsToExcel(...args),
}));

describe("useTableExport", () => {
  const tableMock = {
    getFilteredRowModel: () => ({
      rows: [{ original: { id: 1, total: 10 } }],
    }),
    getVisibleLeafColumns: () => [{ id: "id" }, { id: "total" }],
  } as never;

  it("builds filtered rows and export columns", () => {
    expect(getFilteredRows(tableMock)).toEqual([{ id: 1, total: 10 }]);
    expect(
      getVisibleExportColumns(tableMock, [{ columnKey: "id", columnName: "Identifier" }]),
    ).toEqual([
      { id: "id", label: "Identifier" },
      { id: "total", label: "total" },
    ]);
  });

  it("exports filtered rows and reports handler context on error", async () => {
    const onError = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useTableExport({
        table: tableMock,
        storeColumns: [{ columnKey: "id", columnName: "Identifier" }],
        options: { fileName: "x.xlsx", sheetName: "Sheet1" },
        onError,
      }),
    );

    await result.current.handleExportFiltered();
    expect(mockExportRowsToExcel).toHaveBeenCalledTimes(1);

    mockExportRowsToExcel.mockRejectedValueOnce(new Error("boom"));
    await result.current.handleExportFiltered();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "boom" }),
      "useTableExport.handleExportFiltered",
    );
  });
});
