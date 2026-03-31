import ExcelJS from "exceljs";
import type { TableExportColumn, TableExportOptions } from "@/features/advancedTable/types/tableContracts";
import { formatSafeValue } from "@/features/advancedTable/utils/formatValue";

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const urlApi = globalThis.URL;
  const doc = globalThis.document;
  if (!urlApi?.createObjectURL || !urlApi?.revokeObjectURL || !doc?.createElement) {
    throw new Error("Browser download APIs are unavailable in current environment.");
  }

  const url = urlApi.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  urlApi.revokeObjectURL(url);
}

/**
 * Exports table rows/columns into an Excel file.
 */
export async function exportRowsToExcel<TData = Record<string, unknown>>(
  rows: TData[],
  columns: TableExportColumn[],
  options: TableExportOptions
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(options.sheetName);

  worksheet.columns = columns.map((column) => ({
    header: column.label,
    key: column.id,
    width: options.columnWidth ?? 20,
  }));

  const total = rows.length || 1;
  rows.forEach((row, index) => {
    const exportRow = columns.reduce<Record<string, unknown>>((acc, column) => {
      const value = (row as Record<string, unknown>)[column.id];
      const mapped = column.formatValue ? column.formatValue(value) : value;
      acc[column.id] = mapped == null ? formatSafeValue(mapped) : mapped;
      return acc;
    }, {});

    worksheet.addRow(exportRow);
    if (options.onProgress) {
      options.onProgress(Math.round(((index + 1) / total) * 100));
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  triggerBrowserDownload(blob, options.fileName);
}
