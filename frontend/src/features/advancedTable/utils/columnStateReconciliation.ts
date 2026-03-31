export interface ReconcileColumnStateInput {
  availableColumnIds: string[];
  order?: string[];
  visibility?: Record<string, boolean>;
}

export interface ReconcileColumnStateResult {
  order: string[];
  visibility: Record<string, boolean>;
}

/**
 * Reconciles persisted order/visibility with currently available columns.
 */
export function reconcileColumnState({
  availableColumnIds,
  order = [],
  visibility = {},
}: ReconcileColumnStateInput): ReconcileColumnStateResult {
  const availableSet = new Set(availableColumnIds);

  const normalizedOrder = [
    ...order.filter((columnId) => availableSet.has(columnId)),
    ...availableColumnIds.filter((columnId) => !order.includes(columnId)),
  ];

  const normalizedVisibility: Record<string, boolean> = {};
  for (const columnId of availableColumnIds) {
    normalizedVisibility[columnId] =
      visibility[columnId] === undefined ? true : Boolean(visibility[columnId]);
  }

  return {
    order: normalizedOrder,
    visibility: normalizedVisibility,
  };
}
