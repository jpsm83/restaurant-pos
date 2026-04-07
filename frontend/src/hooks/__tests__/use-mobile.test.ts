import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "../use-mobile";

type MediaQueryListener = () => void;

describe("useIsMobile", () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
    vi.restoreAllMocks();
  });

  it("returns true for viewport widths below 768", () => {
    let changeListener: MediaQueryListener | null = null;
    const addEventListener = vi.fn((_event: string, listener: MediaQueryListener) => {
      changeListener = listener;
    });
    const removeEventListener = vi.fn();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 600,
    });

    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 900,
    });

    act(() => {
      changeListener?.();
    });

    expect(result.current).toBe(false);
  });

  it("removes media query listener on unmount", () => {
    const listenerRefs: MediaQueryListener[] = [];
    const addEventListener = vi.fn((_event: string, listener: MediaQueryListener) => {
      listenerRefs.push(listener);
    });
    const removeEventListener = vi.fn();

    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList);

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    expect(removeEventListener).toHaveBeenCalledWith("change", listenerRefs[0]);
  });
});
