import { afterEach, beforeEach, describe, expect, it } from "vitest";

const FIXTURE_CSS = `
:root { --background: oklch(1 0 0); }
.dark { --background: oklch(0.145 0 0); }
[data-theme="test-ocean"]:not(.dark) { --background: oklch(0.9 0.02 220); }
[data-theme="test-ocean"].dark { --background: oklch(0.2 0.02 220); }
`;

let styleElement: HTMLStyleElement;

function backgroundToken(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim();
}

describe("two-axis theme resolution", () => {
  beforeEach(() => {
    styleElement = document.createElement("style");
    styleElement.textContent = FIXTURE_CSS;
    document.head.appendChild(styleElement);
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    styleElement.remove();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  });

  it("resolves default light and dark from :root and .dark", () => {
    expect(backgroundToken()).toBe("oklch(1 0 0)");
    document.documentElement.classList.add("dark");
    expect(backgroundToken()).toBe("oklch(0.145 0 0)");
  });

  it("resolves a test-only theme independently from mode", () => {
    document.documentElement.dataset.theme = "test-ocean";
    expect(backgroundToken()).toBe("oklch(0.9 0.02 220)");

    document.documentElement.classList.add("dark");
    expect(backgroundToken()).toBe("oklch(0.2 0.02 220)");

    document.documentElement.dataset.theme = "default";
    expect(backgroundToken()).toBe("oklch(0.145 0 0)");
  });

  it("keeps the light theme block from overriding default dark tokens", () => {
    document.documentElement.dataset.theme = "test-ocean";
    document.documentElement.classList.add("dark");
    expect(backgroundToken()).toBe("oklch(0.2 0.02 220)");
  });
});
