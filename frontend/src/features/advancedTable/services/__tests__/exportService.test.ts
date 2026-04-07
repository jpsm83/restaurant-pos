import { describe, expect, it, vi } from "vitest";
import { exportRowsToExcel } from "../exportService";

const addRow = vi.fn();
const writeBuffer = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
const addWorksheet = vi.fn(() => ({
  columns: [],
  addRow,
}));

vi.mock("exceljs", () => ({
  default: {
    Workbook: class WorkbookMock {
      addWorksheet = addWorksheet;
      xlsx = { writeBuffer };
    },
  },
}));

describe("advancedTable exportService", () => {
  it("exports rows, reports progress, and triggers download", async () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const createElement = vi.fn(() => ({ click, href: "", download: "" }));

    Object.defineProperty(globalThis, "URL", {
      value: { createObjectURL, revokeObjectURL },
      configurable: true,
    });
    Object.defineProperty(globalThis, "document", {
      value: { createElement },
      configurable: true,
    });

    const onProgress = vi.fn();
    await exportRowsToExcel(
      [{ id: 1, total: null }],
      [{ id: "total", label: "Total" }],
      { fileName: "table.xlsx", sheetName: "Sheet1", onProgress },
    );

    expect(addWorksheet).toHaveBeenCalledWith("Sheet1");
    expect(addRow).toHaveBeenCalledWith({ total: "-" });
    expect(onProgress).toHaveBeenCalledWith(100);
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(writeBuffer).toHaveBeenCalled();
  });
});
