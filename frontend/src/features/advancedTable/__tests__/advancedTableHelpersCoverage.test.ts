import { describe, expect, it } from "vitest";
import { formatSafeValue } from "../utils/formatValue";
import {
  normalizeDropdownFilterValues,
  normalizeInputFilterValue,
} from "../utils/filterNormalization";
import { normalizeColumns } from "../utils/columnNormalization";
import {
  mapBackendRowsToTableRows,
  normalizeNullableRecordValues,
} from "../utils/dataMapping";
import { reconcileColumnState } from "../utils/columnStateReconciliation";
import {
  buildTablePersistenceKeyPrefix,
  createPersistenceAdapter,
} from "../services/persistenceService";
import {
  buildColumnPersistenceKeys,
  persistColumnState,
  readPersistedColumnState,
} from "../hooks/useColumnPersistence";
import {
  normalizeLoadedConfigColumns,
  normalizeSaveRequestPayload,
} from "../hooks/useTableConfigData";
import {
  getFilteredRows,
  getVisibleExportColumns,
} from "../hooks/useTableExport";
import {
  getInitialDropdownState,
  getNextSelectedValues,
  reconcileDropdownStateWithVisibleColumns,
  reconcileFilterInputsWithVisibleColumns,
} from "../hooks/useTableFilters";
import { createTableQueryOptions } from "../services/fetchService";
import { normalizeQueryError } from "../hooks/useDynamicTableData";

describe("advancedTable helpers coverage", () => {
  it("normalizes and formats utility values", () => {
    expect(formatSafeValue(null)).toBe("-");
    expect(formatSafeValue("  ")).toBe("-");
    expect(formatSafeValue(12)).toBe("12");
    expect(normalizeInputFilterValue("  abc ")).toBe("abc");
    expect(normalizeDropdownFilterValues([" a ", "", "a", "b"])).toEqual(["a", "b"]);
  });

  it("normalizes columns and row mappings", () => {
    expect(
      normalizeColumns([
        { id: "  colA  ", accessorKey: "a", header: "A" },
        { id: "   ", accessorKey: "b", header: "B" },
      ]),
    ).toHaveLength(1);

    expect(normalizeNullableRecordValues({ a: null, b: 2 })).toEqual({ a: "-", b: 2 });

    const mapped = mapBackendRowsToTableRows(
      { rows: [{ name: "one", total: null }] },
      (row: { name: string; total: number | null }) => ({ name: row.name, total: row.total }),
      { normalizeNulls: true, emptyFallback: "-" },
    );
    expect(mapped).toEqual([{ name: "one", total: "-" }]);
  });

  it("reconciles column state and persistence helpers", () => {
    const reconciled = reconcileColumnState({
      availableColumnIds: ["a", "b"],
      order: ["b", "missing"],
      visibility: { a: false },
    });
    expect(reconciled.order).toEqual(["b", "a"]);
    expect(reconciled.visibility).toEqual({ a: false, b: true });

    const prefix = buildTablePersistenceKeyPrefix({
      screenId: "dashboard",
      tableId: "orders",
    });
    expect(prefix).toContain("advanced-table");
    const keys = buildColumnPersistenceKeys(prefix);
    expect(keys.orderKey).toContain("column-order");

    const adapter = createPersistenceAdapter("localStorage");
    persistColumnState(adapter, keys, ["a"], { a: true });
    const loaded = readPersistedColumnState(adapter, keys, [], {});
    expect(loaded).toEqual({ order: ["a"], visibility: { a: true } });
  });

  it("covers table config normalization and filter helper branches", () => {
    const loaded = normalizeLoadedConfigColumns({
      tableConfig: { columns: [{ key: "ticket", label: "Ticket" }] },
    });
    expect(loaded[0]).toMatchObject({ columnKey: "ticket", columnName: "Ticket" });

    const savePayload = normalizeSaveRequestPayload(
      [{ columnKey: "c1", columnName: "C1", order: 99, enable: true, visible: false }],
      false,
    );
    expect(savePayload.tableConfig.columns[0].order).toBe(0);
    expect(savePayload.tableConfig.columns[0].visible).toBe(true);

    expect(
      getInitialDropdownState([
        { columnId: "status", filterType: "dropdown", options: [{ value: "open", label: "Open" }] },
      ]),
    ).toEqual({
      status: { selectedValues: ["open"], isOpen: false },
    });
    expect(getNextSelectedValues(["a"], "a", false)).toEqual([]);
    expect(reconcileFilterInputsWithVisibleColumns({ a: "1", b: "2" }, ["b"])).toEqual({
      a: "1",
    });
    expect(
      reconcileDropdownStateWithVisibleColumns(
        { a: { selectedValues: ["1"], isOpen: false }, b: { selectedValues: ["2"], isOpen: true } },
        ["a"],
      ),
    ).toEqual({ b: { selectedValues: ["2"], isOpen: true } });
  });

  it("covers export and query helper behavior", async () => {
    const tableMock = {
      getFilteredRowModel: () => ({ rows: [{ original: { id: 1 } }, { original: { id: 2 } }] }),
      getVisibleLeafColumns: () => [{ id: "id" }, { id: "name" }],
    } as never;

    expect(getFilteredRows(tableMock)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(
      getVisibleExportColumns(tableMock, [{ columnKey: "id", columnName: "Identifier" }]),
    ).toEqual([
      { id: "id", label: "Identifier" },
      { id: "name", label: "name" },
    ]);

    const options = createTableQueryOptions({
      queryKey: (params: { q: string }) => ["k", params.q],
      params: { q: "abc" },
      queryFn: async (params: { q: string }) => [{ q: params.q }],
    });
    const result = await options.queryFn({});
    expect(options.queryKey).toEqual(["k", "abc"]);
    expect(result.rows).toEqual([{ q: "abc" }]);

    expect(normalizeQueryError("boom")?.message).toBe("boom");
  });
});
