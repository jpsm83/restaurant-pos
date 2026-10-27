import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MODE_STORAGE_KEY, resetThemeStore } from "@/hooks/useTheme";
import { ThemedToaster } from "../ThemedToaster";

const { toasterProps } = vi.hoisted(() => ({
  toasterProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    toasterProps.push(props);
    return null;
  },
}));

function installMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: () => ({
      matches,
      media: "(prefers-color-scheme: dark)",
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

describe("ThemedToaster", () => {
  beforeEach(() => {
    toasterProps.length = 0;
    localStorage.clear();
    installMatchMedia(false);
    resetThemeStore();
  });

  it("passes the resolved mode to Sonner without richColors", () => {
    localStorage.setItem(MODE_STORAGE_KEY, "dark");
    resetThemeStore();

    render(<ThemedToaster />);

    const props = toasterProps.at(-1);
    expect(props?.theme).toBe("dark");
    expect(props).not.toHaveProperty("richColors");
  });

  it("uses semantic toast class hooks", () => {
    render(<ThemedToaster />);

    const toastOptions = toasterProps.at(-1)?.toastOptions as {
      classNames: Record<string, string>;
    };
    expect(toastOptions.classNames).toMatchObject({
      toast: "pos-toast",
      title: "pos-toast-title",
      description: "pos-toast-description",
      error: "pos-toast-error",
      success: "pos-toast-success",
      warning: "pos-toast-warning",
      info: "pos-toast-info",
    });
  });
});
