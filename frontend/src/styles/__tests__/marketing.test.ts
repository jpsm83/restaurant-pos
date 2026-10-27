/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesDirectory = resolve(process.cwd(), "src/styles");
const baseCss = readFileSync(resolve(stylesDirectory, "base.css"), "utf8");
const marketingCss = readFileSync(
  resolve(stylesDirectory, "marketing.css"),
  "utf8",
);
const thirdPartyCss = readFileSync(
  resolve(stylesDirectory, "third-party.css"),
  "utf8",
);

describe("marketing typography", () => {
  it("scopes marketing heading typography to .marketing", () => {
    expect(marketingCss).toContain(".marketing h1");
    expect(marketingCss).toContain(".marketing h2");
    expect(marketingCss).toContain("font-size: 56px;");
  });

  it("does not set fixed global heading sizes or unused code styles in base", () => {
    expect(baseCss).not.toMatch(/(^|\n)\s*h1\b/);
    expect(baseCss).not.toMatch(/(^|\n)\s*h2\b/);
    expect(baseCss).not.toContain(".counter");
    expect(baseCss).not.toContain("--code-bg");
  });

  it("themes Leaflet controls through contract variables", () => {
    expect(thirdPartyCss).toContain(".leaflet-container");
    expect(thirdPartyCss).toContain("var(--background)");
    expect(thirdPartyCss).toContain("var(--foreground)");
    expect(thirdPartyCss).toContain("var(--border)");
    expect(thirdPartyCss).toContain("var(--popover)");
  });

  it("themes Sonner state colours through contract variables", () => {
    expect(thirdPartyCss).toContain(".pos-toast-error");
    expect(thirdPartyCss).toContain("var(--destructive-foreground)");
    expect(thirdPartyCss).toContain(".pos-toast-success");
    expect(thirdPartyCss).toContain("var(--success-foreground)");
    expect(thirdPartyCss).toContain(".pos-toast-warning");
    expect(thirdPartyCss).toContain("var(--warning-foreground)");
    expect(thirdPartyCss).toContain(".pos-toast-info");
    expect(thirdPartyCss).toContain("var(--info-foreground)");
  });
});
