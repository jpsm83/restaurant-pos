import { beforeEach, describe, expect, it } from "vitest";
import indexHtml from "../../../index.html?raw";

function bootScript(): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(indexHtml);
  if (!match?.[1]) throw new Error("Boot script not found in index.html");
  return match[1];
}

function runBootScript(): void {
  new Function(bootScript())();
}

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

describe("theme boot script", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    installMatchMedia(false);
  });

  it("runs before the app bundle", () => {
    const bootIndex = indexHtml.indexOf("<script>");
    const moduleIndex = indexHtml.indexOf(
      '<script type="module" src="/src/main.tsx">',
    );
    expect(bootIndex).toBeGreaterThanOrEqual(0);
    expect(moduleIndex).toBeGreaterThan(bootIndex);
  });

  it("applies a saved dark mode and theme before first paint", () => {
    localStorage.setItem("pos.theme", "default");
    localStorage.setItem("pos.mode", "dark");

    runBootScript();

    expect(document.documentElement.dataset.theme).toBe("default");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("follows the OS while the saved mode is system", () => {
    installMatchMedia(true);
    localStorage.setItem("pos.mode", "system");

    runBootScript();

    expect(document.documentElement.dataset.theme).toBe("default");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("falls back to system for an unknown saved mode", () => {
    installMatchMedia(false);
    localStorage.setItem("pos.mode", "neon");

    runBootScript();

    expect(document.documentElement.dataset.theme).toBe("default");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("tolerates a missing matchMedia implementation", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: undefined,
    });
    localStorage.setItem("pos.mode", "system");

    expect(() => runBootScript()).not.toThrow();
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
