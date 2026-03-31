import { useCallback, useMemo, useState } from "react";
import type { Table } from "@tanstack/react-table";
import type { FilterConfig, FilterOption } from "@/features/advancedTable/types/tableContracts";

export interface DropdownFilterState {
  selectedValues: string[];
  isOpen: boolean;
}

export function getInitialDropdownState(
  filterConfigs: FilterConfig[]
): Record<string, DropdownFilterState> {
  const state: Record<string, DropdownFilterState> = {};
  filterConfigs.forEach((config) => {
    if (config.filterType === "dropdown" && config.options) {
      state[config.columnId] = {
        selectedValues: config.options.map((opt) => opt.value),
        isOpen: false,
      };
    }
  });
  return state;
}

export function getNextSelectedValues(
  previous: string[],
  value: string,
  checked: boolean
): string[] {
  if (checked) {
    return previous.includes(value) ? previous : [...previous, value];
  }
  return previous.filter((item) => item !== value);
}

export function reconcileFilterInputsWithVisibleColumns(
  inputs: Record<string, string>,
  hiddenColumnIds: string[]
): Record<string, string> {
  if (hiddenColumnIds.length === 0) return inputs;
  const hiddenSet = new Set(hiddenColumnIds);
  return Object.fromEntries(
    Object.entries(inputs).filter(([columnId]) => !hiddenSet.has(columnId))
  );
}

export function reconcileDropdownStateWithVisibleColumns(
  dropdownState: Record<string, DropdownFilterState>,
  hiddenColumnIds: string[]
): Record<string, DropdownFilterState> {
  if (hiddenColumnIds.length === 0) return dropdownState;
  const hiddenSet = new Set(hiddenColumnIds);
  return Object.fromEntries(
    Object.entries(dropdownState).filter(([columnId]) => !hiddenSet.has(columnId))
  );
}

function toOptionsMap(filterConfigs: FilterConfig[]): Map<string, FilterOption[]> {
  return new Map(
    filterConfigs
      .filter((config) => config.filterType === "dropdown" && config.options)
      .map((config) => [config.columnId, config.options as FilterOption[]])
  );
}

export function useTableFilters<TData = Record<string, unknown>>(
  table: Table<TData>,
  filterConfigs: FilterConfig[] = []
) {
  const [filterInputs, setFilterInputs] = useState<Record<string, string>>({});
  const [dropdownState, setDropdownState] = useState<Record<string, DropdownFilterState>>(
    () => getInitialDropdownState(filterConfigs)
  );

  const optionsMap = useMemo(() => toOptionsMap(filterConfigs), [filterConfigs]);
  const realtimeMap = useMemo(
    () =>
      new Map(
        filterConfigs
          .filter((config) => config.filterType === "input")
          .map((config) => [config.columnId, Boolean(config.realtime)])
      ),
    [filterConfigs]
  );

  const getFilterValue = useCallback(
    (columnId: string) => filterInputs[columnId] ?? "",
    [filterInputs]
  );

  const isRealtimeFilterColumn = useCallback(
    (columnId: string) => realtimeMap.get(columnId) ?? false,
    [realtimeMap]
  );

  const onDropdownOpenChange = useCallback((columnId: string, open: boolean) => {
    setDropdownState((prev) => ({
      ...prev,
      [columnId]: {
        ...(prev[columnId] ?? { selectedValues: [], isOpen: false }),
        isOpen: open,
      },
    }));
  }, []);

  const onDropdownToggleOption = useCallback(
    (columnId: string, value: string, checked: boolean) => {
      setDropdownState((prev) => {
        const current = prev[columnId] ?? { selectedValues: [], isOpen: false };
        const options = optionsMap.get(columnId) ?? [];
        const allValues = options.map((opt) => opt.value);
        const nextSelectedValues = getNextSelectedValues(current.selectedValues, value, checked);
        const selectedValues =
          nextSelectedValues.length === 0 && allValues.length > 0 ? allValues : nextSelectedValues;
        const column = table.getColumn(columnId);
        column?.setFilterValue(selectedValues.length > 0 ? selectedValues : undefined);

        return {
          ...prev,
          [columnId]: {
            ...current,
            selectedValues,
          },
        };
      });
    },
    [optionsMap, table]
  );

  const onDropdownSelectAllToggle = useCallback(
    (columnId: string) => {
      const options = optionsMap.get(columnId) ?? [];
      const allValues = options.map((opt) => opt.value);
      setDropdownState((prev) => {
        const current = prev[columnId] ?? { selectedValues: [], isOpen: false };
        const shouldSelectAll = current.selectedValues.length !== allValues.length;
        const selectedValues = shouldSelectAll ? allValues : [];
        const column = table.getColumn(columnId);
        column?.setFilterValue(selectedValues.length > 0 ? selectedValues : undefined);
        return {
          ...prev,
          [columnId]: {
            ...current,
            selectedValues,
          },
        };
      });
    },
    [optionsMap, table]
  );

  const clearAllFilters = useCallback(() => {
    setFilterInputs({});
    table.resetColumnFilters();
    setDropdownState(getInitialDropdownState(filterConfigs));
  }, [filterConfigs, table]);

  const clearHiddenColumnFilters = useCallback(() => {
    const hiddenColumns = table
      .getAllColumns()
      .filter((column) => !column.getIsVisible())
      .map((column) => column.id);

    if (hiddenColumns.length === 0) return;

    setFilterInputs((prev) =>
      reconcileFilterInputsWithVisibleColumns(prev, hiddenColumns)
    );
    setDropdownState((prev) =>
      reconcileDropdownStateWithVisibleColumns(prev, hiddenColumns)
    );

    hiddenColumns.forEach((columnId) => {
      const column = table.getColumn(columnId);
      column?.setFilterValue(undefined);
    });
  }, [table]);

  const closeAllDropdowns = useCallback(() => {
    setDropdownState((prev) => {
      const hasOpen = Object.values(prev).some((entry) => entry.isOpen);
      if (!hasOpen) return prev;
      return Object.fromEntries(
        Object.entries(prev).map(([columnId, entry]) => [columnId, { ...entry, isOpen: false }])
      );
    });
  }, []);

  return {
    filterInputs,
    setFilterInputs,
    getFilterValue,
    isRealtimeFilterColumn,
    dropdownState,
    onDropdownOpenChange,
    onDropdownToggleOption,
    onDropdownSelectAllToggle,
    closeAllDropdowns,
    clearAllFilters,
    clearHiddenColumnFilters,
  };
}
