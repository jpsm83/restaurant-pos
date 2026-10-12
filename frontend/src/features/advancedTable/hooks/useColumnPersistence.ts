import { useCallback, useMemo } from "react";
import type { ColumnVisibilityState } from "@tanstack/react-table";
import type { PersistenceAdapter } from "@/features/advancedTable/services/persistenceService";
import { reconcileColumnState } from "@/features/advancedTable/utils/columnStateReconciliation";

export interface ColumnPersistenceKeys {
  orderKey: string;
  visibilityKey: string;
}

export interface ColumnPersistenceConfig {
  enabled?: boolean;
  adapter?: PersistenceAdapter;
  keyPrefix?: string;
  availableColumnIds?: string[];
  initialColumnOrder?: string[];
  initialColumnVisibility?: ColumnVisibilityState;
  onColumnOrderChange?: (order: string[]) => void;
  onColumnVisibilityChange?: (visibility: ColumnVisibilityState) => void;
}

export function buildColumnPersistenceKeys(
  keyPrefix = "standalone-table"
): ColumnPersistenceKeys {
  return {
    orderKey: `${keyPrefix}:column-order`,
    visibilityKey: `${keyPrefix}:column-visibility`,
  };
}

export function readPersistedColumnState(
  adapter: PersistenceAdapter | undefined,
  keys: ColumnPersistenceKeys,
  fallbackOrder: string[],
  fallbackVisibility: ColumnVisibilityState
): { order: string[]; visibility: ColumnVisibilityState } {
  if (!adapter) {
    return { order: fallbackOrder, visibility: fallbackVisibility };
  }

  return {
    order: adapter.load<string[]>(keys.orderKey, fallbackOrder),
    visibility: adapter.load<ColumnVisibilityState>(keys.visibilityKey, fallbackVisibility),
  };
}

export function persistColumnState(
  adapter: PersistenceAdapter | undefined,
  keys: ColumnPersistenceKeys,
  order: string[],
  visibility: ColumnVisibilityState
): void {
  if (!adapter) return;
  adapter.save(keys.orderKey, order);
  adapter.save(keys.visibilityKey, visibility);
}

export function useColumnPersistence({
  enabled = false,
  adapter,
  keyPrefix = "standalone-table",
  availableColumnIds = [],
  initialColumnOrder = [],
  initialColumnVisibility = {},
  onColumnOrderChange,
  onColumnVisibilityChange,
}: ColumnPersistenceConfig) {
  const keys = useMemo(() => buildColumnPersistenceKeys(keyPrefix), [keyPrefix]);

  const persisted = useMemo(() => {
    if (!enabled) {
      return {
        order: initialColumnOrder,
        visibility: initialColumnVisibility,
      };
    }
    const restored = readPersistedColumnState(
      adapter,
      keys,
      initialColumnOrder,
      initialColumnVisibility
    );
    return reconcileColumnState({
      availableColumnIds,
      order: restored.order,
      visibility: restored.visibility,
    });
  }, [adapter, availableColumnIds, enabled, initialColumnOrder, initialColumnVisibility, keys]);

  const handleColumnOrderChange = useCallback(
    (order: string[]) => {
      if (enabled) {
        persistColumnState(adapter, keys, order, persisted.visibility);
      }
      onColumnOrderChange?.(order);
    },
    [adapter, enabled, keys, onColumnOrderChange, persisted.visibility]
  );

  const handleColumnVisibilityChange = useCallback(
    (visibility: ColumnVisibilityState) => {
      if (enabled) {
        persistColumnState(adapter, keys, persisted.order, visibility);
      }
      onColumnVisibilityChange?.(visibility);
    },
    [adapter, enabled, keys, onColumnVisibilityChange, persisted.order]
  );

  return {
    initialColumnOrder: persisted.order,
    initialColumnVisibility: persisted.visibility,
    handleColumnOrderChange,
    handleColumnVisibilityChange,
  };
}
