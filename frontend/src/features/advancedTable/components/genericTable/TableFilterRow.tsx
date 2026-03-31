import { useEffect } from "react";
import type { Column, Table } from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FilterConfig } from "@/features/advancedTable/types/tableContracts";
import type { DropdownFilterState } from "@/features/advancedTable/hooks/useTableFilters";

export interface StandaloneTableFilterRowProps<TData> {
  table: Table<TData>;
  filterConfigs?: FilterConfig[];
  getFilterValue?: (columnId: string) => string;
  setFilterInputs?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isRealtimeFilterColumn?: (columnId: string) => boolean;
  dropdownState?: Record<string, DropdownFilterState>;
  onDropdownOpenChange?: (columnId: string, open: boolean) => void;
  onDropdownToggleOption?: (columnId: string, value: string, checked: boolean) => void;
  onDropdownSelectAllToggle?: (columnId: string) => void;
  onCloseAllDropdowns?: () => void;
}

function getFilterDisplayText(selectedValues: string[] | undefined, total: number): string {
  const selectedCount = selectedValues?.length ?? 0;
  if (selectedCount === 0) return "All";
  if (selectedCount === 1) return selectedValues?.[0] ?? "All";
  if (selectedCount === total) return "All";
  return `${selectedCount} selected`;
}

export const TableFilterRow = <TData,>({
  table,
  filterConfigs = [],
  getFilterValue,
  setFilterInputs,
  isRealtimeFilterColumn,
  dropdownState,
  onDropdownOpenChange,
  onDropdownToggleOption,
  onDropdownSelectAllToggle,
  onCloseAllDropdowns,
}: StandaloneTableFilterRowProps<TData>) => {
  const { t } = useTranslation("business");
  const filterConfigMap = new Map(filterConfigs.map((config) => [config.columnId, config]));
  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const hasOpenDropdown = Object.values(dropdownState ?? {}).some((state) => state.isOpen);

  useEffect(() => {
    if (!hasOpenDropdown) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-table-filter-dropdown="true"]')) return;
      onCloseAllDropdowns?.();
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [hasOpenDropdown, onCloseAllDropdowns]);

  const renderInputFilter = (columnId: string, column: Column<TData, unknown>) => {
    const isRealtime = isRealtimeFilterColumn?.(columnId) ?? false;
    return (
      <input
        aria-label={`Filter ${columnId}`}
        className="h-8 w-full rounded border border-border bg-card px-2 text-sm"
        value={getFilterValue?.(columnId) ?? ""}
        placeholder={
          isRealtime
            ? t("advancedTable.filters.typeToFilter", { defaultValue: "Type to filter" })
            : t("advancedTable.filters.pressEnterToFilter", { defaultValue: "Press Enter to filter" })
        }
        onChange={(event) => {
          const value = event.target.value;
          setFilterInputs?.((prev) => ({ ...prev, [columnId]: value }));
          if (isRealtime) {
            column.setFilterValue(value);
          } else if (!value) {
            column.setFilterValue(undefined);
          }
        }}
        onKeyDown={(event) => {
          if (!isRealtime && event.key === "Enter") {
            column.setFilterValue(event.currentTarget.value);
          }
        }}
      />
    );
  };

  const renderDropdownFilter = (columnId: string, column: Column<TData, unknown>, config: FilterConfig) => {
    const options = config.options ?? [];
    const selectedValues =
      dropdownState?.[columnId]?.selectedValues ??
      ((column.getFilterValue() as string[] | undefined) ?? []);
    const isOpen = dropdownState?.[columnId]?.isOpen ?? false;
    const isAllSelected = options.length > 0 && selectedValues.length === options.length;

    return (
      <div className="relative" data-table-filter-dropdown="true">
        <button
          type="button"
          aria-label={`Filter ${columnId}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className="flex h-8 w-full items-center justify-between gap-2 rounded border border-border bg-card px-2 text-left text-sm"
          title={getFilterDisplayText(selectedValues, options.length)}
          onClick={() => onDropdownOpenChange?.(columnId, !isOpen)}
        >
          <span className="truncate">
            {selectedValues.length === 0 || selectedValues.length === options.length
              ? t("advancedTable.filters.all", { defaultValue: "All" })
              : selectedValues.length === 1
                ? selectedValues[0]
                : t("advancedTable.filters.selectedCount", {
                    defaultValue: "{{count}} selected",
                    count: selectedValues.length,
                  })}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        {isOpen && (
          <div className="absolute z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded border border-border bg-card p-2 shadow">
            <label className="mb-1 flex items-center gap-2 border-b border-border py-1 text-sm">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() => onDropdownSelectAllToggle?.(columnId)}
              />
              <span>{t("advancedTable.filters.selectAll", { defaultValue: "Select all" })}</span>
            </label>
            {options.map((option) => {
              const checked = selectedValues.includes(option.value);
              return (
                <label key={option.value} className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      if (onDropdownToggleOption) {
                        onDropdownToggleOption(columnId, option.value, event.target.checked);
                      } else {
                        const values = event.target.checked
                          ? [...selectedValues, option.value]
                          : selectedValues.filter((value) => value !== option.value);
                        column.setFilterValue(values.length > 0 ? values : undefined);
                      }
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <tr className="bg-muted/70">
      {headers.map((header) => {
        if (header.isPlaceholder) return null;
        const column = header.column;
        if (!column.getCanFilter()) return <th key={`filter-empty-${column.id}`} className="p-2" />;

        const columnId = column.id;
        const config = filterConfigMap.get(columnId);
        return (
          <th key={`filter-${columnId}`} className="bg-muted/70 p-2">
            {config?.filterType === "dropdown"
              ? renderDropdownFilter(columnId, column, config)
              : renderInputFilter(columnId, column)}
          </th>
        );
      })}
    </tr>
  );
};
