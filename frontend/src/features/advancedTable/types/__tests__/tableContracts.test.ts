import { describe, expect, it, expectTypeOf } from "vitest";
import type {
  DetailsModalConfig,
  FilterConfig,
  FilterOption,
  FilterType,
  TableColumnConfig,
  TableExportColumn,
  TableExportOptions,
  TableFetchResponse,
  TableRowData,
} from "./tableContracts";

describe("tableContracts types", () => {
  it("keeps expected literal unions for filter and modal trigger contracts", () => {
    expectTypeOf<FilterType>().toEqualTypeOf<"input" | "dropdown">();

    const filterConfig: FilterConfig = {
      columnId: "status",
      filterType: "dropdown",
      options: [{ value: "open", label: "Open" }],
      realtime: false,
    };
    expect(filterConfig.filterType).toBe("dropdown");
  });

  it("supports generic row/fetch/table column contracts", () => {
    type Row = TableRowData & { id: string; amount: number };

    const column: TableColumnConfig<Row> = {
      id: "amount",
      header: "Amount",
      accessorKey: "amount",
      meta: { label: "Amount" },
    };
    expect(column.id).toBe("amount");

    const response: TableFetchResponse<Row> = {
      rows: [{ id: "1", amount: 10 }],
      total: 1,
    };
    expect(response.rows).toHaveLength(1);
  });

  it("matches export and details-modal type contracts", () => {
    const exportColumn: TableExportColumn = {
      id: "total",
      label: "Total",
      formatValue: (value) => String(value ?? "-"),
    };
    const exportOptions: TableExportOptions = {
      fileName: "report.xlsx",
      sheetName: "Sheet1",
      onProgress: () => undefined,
    };
    const detailsConfig: DetailsModalConfig<{ id: string }> = {
      enabled: true,
      trigger: "doubleClick",
      position: "center",
      allowKeyboardNavigation: true,
      renderDetails: (record) => record.id,
      renderHeaderActions: (record) => record.id,
    };

    const option: FilterOption = { value: "v", label: "V" };
    expect(exportColumn.label).toBe("Total");
    expect(exportOptions.fileName).toContain(".xlsx");
    expect(detailsConfig.enabled).toBe(true);
    expect(option.value).toBe("v");
  });
});
