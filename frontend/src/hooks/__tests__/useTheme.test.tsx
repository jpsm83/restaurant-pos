import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MODE_STORAGE_KEY,
  resetThemeStore,
  THEME_STORAGE_KEY,
  useTheme,
  type ThemeMode,
} from "../useTheme";
import type { ThemeId } from "@/styles/themes";

type MediaListener = (event: MediaQueryListEvent) => void;

function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<MediaListener>();
  const mediaQuery = {
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((type: string, listener: MediaListener) => {
      if (type === "change") listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: MediaListener) => {
      if (type === "change") listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  const matchMedia = vi.fn(() => mediaQuery);

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: matchMedia,
  });

  return {
    matchMedia,
    mediaQuery,
    setMatches(matches: boolean) {
      (mediaQuery as { matches: boolean }).matches = matches;
      for (const listener of [...listeners]) {
        listener({ matches } as MediaQueryListEvent);
      }
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    installMatchMedia(false);
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    resetThemeStore();
  });

  it("defaults to the default theme and system mode", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("default");
    expect(result.current.mode).toBe("system");
    expect(result.current.resolvedMode).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("default");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("loads valid stored preferences", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "default");
    localStorage.setItem(MODE_STORAGE_KEY, "dark");
    resetThemeStore();

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("default");
    expect(result.current.mode).toBe("dark");
    expect(result.current.resolvedMode).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("falls back from unknown stored theme and mode values", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "missing-theme");
    localStorage.setItem(MODE_STORAGE_KEY, "neon");
    resetThemeStore();

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("default");
    expect(result.current.mode).toBe("system");
    expect(result.current.resolvedMode).toBe("light");
  });

  it("persists and applies setTheme and setMode", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setMode("dark"));
    expect(result.current.mode).toBe("dark");
    expect(result.current.resolvedMode).toBe("dark");
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");

    act(() => result.current.setMode("light"));
    expect(result.current.resolvedMode).toBe("light");
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");

    act(() => result.current.setTheme("default"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("default");
    expect(document.documentElement.dataset.theme).toBe("default");
  });

  it("validates programmatic theme and mode values", () => {
    const { result } = renderHook(() => useTheme());

    act(() =>
      result.current.setTheme("unknown" as unknown as ThemeId),
    );
    expect(result.current.theme).toBe("default");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("default");

    act(() => result.current.setMode("unknown" as unknown as ThemeMode));
    expect(result.current.mode).toBe("system");
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe("system");
  });

  it("follows the OS media query live and cleans up its listener", () => {
    const media = installMatchMedia(false);
    localStorage.setItem(MODE_STORAGE_KEY, "system");
    resetThemeStore();

    const { result, unmount } = renderHook(() => useTheme());

    expect(media.matchMedia).toHaveBeenCalledWith(
      "(prefers-color-scheme: dark)",
    );
    expect(media.mediaQuery.addEventListener).toHaveBeenCalledTimes(1);
    expect(result.current.resolvedMode).toBe("light");

    act(() => media.setMatches(true));
    expect(result.current.resolvedMode).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");

    unmount();
    expect(media.mediaQuery.removeEventListener).toHaveBeenCalledTimes(1);
    expect(media.listenerCount()).toBe(0);
  });

  it("does not listen to the OS outside system mode", () => {
    const media = installMatchMedia(true);
    localStorage.setItem(MODE_STORAGE_KEY, "light");
    resetThemeStore();

    const { result } = renderHook(() => useTheme());

    expect(result.current.resolvedMode).toBe("light");
    expect(media.mediaQuery.addEventListener).not.toHaveBeenCalled();
  });

  it("tolerates a missing matchMedia", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: undefined,
    });
    localStorage.setItem(MODE_STORAGE_KEY, "system");
    resetThemeStore();

    const { result } = renderHook(() => useTheme());

    expect(result.current.mode).toBe("system");
    expect(result.current.resolvedMode).toBe("light");
  });
});
