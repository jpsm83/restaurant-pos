/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { converter, wcagContrast } from "culori";
import { describe, expect, it } from "vitest";

const indexCss = readFileSync(
  resolve(process.cwd(), "src/index.css"),
  "utf8",
);
const tokensCss = readFileSync(
  resolve(process.cwd(), "src/styles/tokens.css"),
  "utf8",
);
import { THEME_TOKEN_CONTRACT } from "../theme-contract";
import { THEMES } from "../themes";
import {
  extractRuleBlock,
  getThemeCss,
  getThemeCssIds,
  getThemeTokenValues,
  themeSelector,
  type ThemeModeName,
} from "./themeTestUtils";

const MODES: ThemeModeName[] = ["light", "dark"];

const TEXT_CONTRAST_PAIRS: Array<[string, string]> = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["surface-foreground", "surface"],
  ["elevated-foreground", "elevated"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["muted-foreground", "muted"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
];

const UI_SURFACES = ["background", "card", "surface", "elevated"];
const toRgb = converter("rgb");

function compositeOver(
  foreground: string,
  background: string,
  alpha: number,
) {
  const fg = toRgb(foreground);
  const bg = toRgb(background);
  if (!fg || !bg) throw new Error("Could not parse colour for compositing");
  return {
    mode: "rgb" as const,
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  };
}

function valueFor(tokens: Map<string, string>, token: string): string {
  const value = tokens.get(token);
  if (!value) throw new Error(`Missing --${token}`);
  return value;
}

describe("theme token contract", () => {
  it.each(THEMES.map((theme) => theme.id))(
    "defines every contract token for %s in light and dark",
    (themeId) => {
      for (const mode of MODES) {
        const tokens = getThemeTokenValues(themeId, mode);
        for (const token of THEME_TOKEN_CONTRACT) {
          expect(
            tokens.get(token),
            `${themeId}/${mode} is missing --${token}`,
          ).toBeTruthy();
        }
      }
    },
  );

  it("defines the previously missing destructive foreground and new token groups", () => {
    const tokens = getThemeTokenValues("default", "light");
    expect(tokens.get("destructive-foreground")).toBeTruthy();
    for (const token of [
      "success",
      "success-foreground",
      "warning",
      "warning-foreground",
      "info",
      "info-foreground",
      "surface",
      "surface-foreground",
      "elevated",
      "elevated-foreground",
      "overlay",
      "elevation-panel",
      "elevation-overlay",
      "page-width",
      "motion-fast",
      "motion-base",
      "motion-slow",
      "motion-ease-standard",
      "motion-ease-emphasized",
      "z-dropdown",
      "z-sticky",
      "z-overlay",
      "z-modal",
      "z-toast",
      "z-tooltip",
    ]) {
      expect(tokens.get(token), `missing --${token}`).toBeTruthy();
    }
  });

  it("sets color-scheme in both default theme blocks", () => {
    const css = getThemeCss("default");
    expect(
      extractRuleBlock(css, themeSelector("default", "light")),
    ).toContain("color-scheme: light;");
    expect(
      extractRuleBlock(css, themeSelector("default", "dark")),
    ).toContain("color-scheme: dark;");
  });

  it("scopes the default light set for preview subtrees", () => {
    const css = getThemeCss("default");
    const scopedLight = extractRuleBlock(
      css,
      '[data-theme="default"]:not(.dark)',
    );
    expect(scopedLight).toContain("color-scheme: light;");
    expect(scopedLight).toContain("--background:");
  });

  it.each(THEMES.map((theme) => theme.id))(
    "passes the documented contrast pairs for %s",
    (themeId) => {
      for (const mode of MODES) {
        const tokens = getThemeTokenValues(themeId, mode);

        for (const [foreground, background] of TEXT_CONTRAST_PAIRS) {
          const ratio = wcagContrast(
            valueFor(tokens, foreground),
            valueFor(tokens, background),
          );
          expect(
            ratio,
            `${themeId}/${mode}: --${foreground} on --${background} is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(4.5);
        }

        for (const borderToken of ["border", "input", "ring"]) {
          for (const surface of UI_SURFACES) {
            const ratio = wcagContrast(
              valueFor(tokens, borderToken),
              valueFor(tokens, surface),
            );
            expect(
              ratio,
              `${themeId}/${mode}: --${borderToken} on --${surface} is ${ratio.toFixed(2)}:1`,
            ).toBeGreaterThanOrEqual(3);
          }
        }

        for (const surface of UI_SURFACES) {
          const surfaceColor = valueFor(tokens, surface);
          const ratio = wcagContrast(
            compositeOver(valueFor(tokens, "ring"), surfaceColor, 0.5),
            surfaceColor,
          );
          expect(
            ratio,
            `${themeId}/${mode}: --ring at 50% on --${surface} is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(3);
        }

        for (const chart of [
          "chart-1",
          "chart-2",
          "chart-3",
          "chart-4",
          "chart-5",
        ]) {
          const ratio = wcagContrast(
            valueFor(tokens, chart),
            valueFor(tokens, "background"),
          );
          expect(
            ratio,
            `${themeId}/${mode}: --${chart} on --background is ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(3);
        }

        const foregroundRatio = wcagContrast(
          valueFor(tokens, "foreground"),
          valueFor(tokens, "background"),
        );
        expect(
          foregroundRatio,
          `${themeId}/${mode}: --foreground on --background is ${foregroundRatio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );
});

describe("theme registry and stylesheet consistency", () => {
  it("registers every theme CSS file and no extras", () => {
    const cssThemeIds = getThemeCssIds().sort();
    const registryIds: string[] = THEMES.map((theme) => theme.id).sort();
    expect(cssThemeIds).toEqual(registryIds);
  });

  it("imports every registered theme stylesheet", () => {
    const importedIds = [
      ...indexCss.matchAll(
        /@import\s+"\.\/styles\/themes\/([^"]+)\.css";/g,
      ),
    ]
      .map((match) => match[1])
      .filter((id): id is string => Boolean(id))
      .sort();
    const registryIds: string[] = THEMES.map((theme) => theme.id).sort();
    expect(importedIds).toEqual(registryIds);
  });

  it("uses the root-matching dark custom variant", () => {
    expect(tokensCss).toContain(
      "@custom-variant dark (&:where(.dark, .dark *));",
    );
  });

  it("imports the stylesheet layers in the documented order and holds no raw values", () => {
    const imports = [
      '@import "tailwindcss";',
      '@import "tw-animate-css";',
      '@import "./styles/tokens.css";',
      '@import "./styles/themes/default.css";',
      '@import "./styles/base.css";',
      '@import "./styles/marketing.css";',
      '@import "./styles/third-party.css";',
    ];

    const positions = imports.map((entry) => indexCss.indexOf(entry));
    expect(positions).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(indexCss).not.toMatch(/oklch\(|#[0-9a-f]{3,8}\b|:\s*root/i);
  });
});
