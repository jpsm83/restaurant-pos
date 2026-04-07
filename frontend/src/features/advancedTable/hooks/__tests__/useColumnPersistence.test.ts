import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildColumnPersistenceKeys,
  persistColumnState,
  readPersistedColumnState,
  useColumnPersistence,
} from "../useColumnPersistence";

describe("useColumnPersistence", () => {
  it("builds keys and reads/writes persisted state", () => {
    const keys = buildColumnPersistenceKeys("orders");
    expect(keys).toEqual({
      orderKey: "orders:column-order",
      visibilityKey: "orders:column-visibility",
    });

    const saved = new Map<string, unknown>();
    const adapter = {
      save: (key: string, value: unknown) => saved.set(key, value),
      load: (key: string, fallback: unknown) => (saved.has(key) ? saved.get(key) : fallback),
      remove: (_key: string) => undefined,
    };

    persistColumnState(adapter, keys, ["a"], { a: true });
    const restored = readPersistedColumnState(adapter, keys, [], {});
    expect(restored).toEqual({ order: ["a"], visibility: { a: true } });
  });

  it("returns reconciled initial state and triggers callbacks", () => {
    const onOrderChange = vi.fn();
    const onVisibilityChange = vi.fn();

    const { result } = renderHook(() =>
      useColumnPersistence({
        enabled: false,
        availableColumnIds: ["a", "b"],
        initialColumnOrder: ["b", "a"],
        initialColumnVisibility: { a: true, b: false },
        onColumnOrderChange: onOrderChange,
        onColumnVisibilityChange: onVisibilityChange,
      }),
    );

    expect(result.current.initialColumnOrder).toEqual(["b", "a"]);
    expect(result.current.initialColumnVisibility).toEqual({ a: true, b: false });

    result.current.handleColumnOrderChange(["a", "b"]);
    result.current.handleColumnVisibilityChange({ a: false, b: true });

    expect(onOrderChange).toHaveBeenCalledWith(["a", "b"]);
    expect(onVisibilityChange).toHaveBeenCalledWith({ a: false, b: true });
  });
});
