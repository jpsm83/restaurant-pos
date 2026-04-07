import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StandaloneAdvancedTable } from "../StandaloneAdvancedTable";

const mockUseDynamicTableData = vi.fn();
const mockUseEnhancedTable = vi.fn();
const mockUseTableFilters = vi.fn();
const mockUseColumnPersistence = vi.fn();
const mockUseTableExport = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

vi.mock("@/features/advancedTable/hooks/useDynamicTableData", () => ({
  useDynamicTableData: (...args: unknown[]) => mockUseDynamicTableData(...args),
}));
vi.mock("@/features/advancedTable/hooks/useEnhancedTable", () => ({
  useEnhancedTable: (...args: unknown[]) => mockUseEnhancedTable(...args),
}));
vi.mock("@/features/advancedTable/hooks/useTableFilters", () => ({
  useTableFilters: (...args: unknown[]) => mockUseTableFilters(...args),
}));
vi.mock("@/features/advancedTable/hooks/useColumnPersistence", () => ({
  useColumnPersistence: (...args: unknown[]) => mockUseColumnPersistence(...args),
}));
vi.mock("@/features/advancedTable/hooks/useTableExport", () => ({
  useTableExport: (...args: unknown[]) => mockUseTableExport(...args),
}));

vi.mock("@/features/advancedTable/components/genericTable/TableHeader", () => ({
  TableHeader: ({ children }: { children?: React.ReactNode }) => <thead><tr><th>header</th></tr>{children}</thead>,
}));
vi.mock("@/features/advancedTable/components/genericTable/TableFilterRow", () => ({
  TableFilterRow: () => <tr><th>filters</th></tr>,
}));
vi.mock("@/features/advancedTable/components/genericTable/TableBody", () => ({
  TableBody: () => <tbody><tr><td>body</td></tr></tbody>,
}));
vi.mock("@/features/advancedTable/components/genericTable/TablePagination", () => ({
  TablePagination: () => <div>pagination</div>,
}));
vi.mock("@/features/advancedTable/components/RecordDetailsModal", () => ({
  RecordDetailsModal: () => <div>details-modal</div>,
}));

describe("StandaloneAdvancedTable", () => {
  it("renders ready table shell with generic table subcomponents", () => {
    mockUseDynamicTableData.mockReturnValue({
      rows: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      total: 0,
    });
    mockUseColumnPersistence.mockReturnValue({
      initialColumnOrder: [],
      initialColumnVisibility: {},
      handleColumnOrderChange: vi.fn(),
      handleColumnVisibilityChange: vi.fn(),
    });
    mockUseEnhancedTable.mockReturnValue({
      table: {
        setPageIndex: vi.fn(),
      },
      draggedColumn: null,
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDrop: vi.fn(),
      handleDragEnd: vi.fn(),
      resetColumns: vi.fn(),
      columnVisibility: {},
    });
    mockUseTableFilters.mockReturnValue({
      clearAllFilters: vi.fn(),
      clearHiddenColumnFilters: vi.fn(),
      getFilterValue: vi.fn(() => ""),
      setFilterInputs: vi.fn(),
      isRealtimeFilterColumn: vi.fn(() => false),
      dropdownState: {},
      onDropdownOpenChange: vi.fn(),
      onDropdownToggleOption: vi.fn(),
      onDropdownSelectAllToggle: vi.fn(),
      closeAllDropdowns: vi.fn(),
    });
    mockUseTableExport.mockReturnValue({
      handleExportFiltered: vi.fn(),
    });

    render(
      <StandaloneAdvancedTable
        columns={[
          {
            id: "id",
            header: "ID",
            accessorKey: "id",
          },
        ]}
        data={[{ id: 1 }]}
      />,
    );

    expect(screen.getByText("header")).toBeInTheDocument();
    expect(screen.getByText("filters")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByText("pagination")).toBeInTheDocument();
  });
});
