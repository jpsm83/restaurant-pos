import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs immediately on first fire, then debounces subsequent dependency updates", () => {
    vi.useFakeTimers();
    const run = vi.fn();

    const { rerender } = renderHook(
      ({ dep }) =>
        useDebounce([dep], run, {
          debounceMs: 100,
          leadingDelayMs: 0,
          active: true,
        }),
      { initialProps: { dep: 1 } },
    );

    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(run).toHaveBeenCalledTimes(1);

    rerender({ dep: 2 });
    vi.advanceTimersByTime(99);
    expect(run).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("calls onInactive when active is false", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const onInactive = vi.fn();

    renderHook(() =>
      useDebounce(["stable"], run, {
        debounceMs: 100,
        active: false,
        onInactive,
      }),
    );

    vi.advanceTimersByTime(0);
    expect(onInactive).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });
});
