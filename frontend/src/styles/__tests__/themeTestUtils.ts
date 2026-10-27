/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ThemeId } from "../themes";

export type ThemeModeName = "light" | "dark";

const themesDirectory = resolve(process.cwd(), "src/styles/themes");

export function getThemeCss(themeId: ThemeId): string {
  return readFileSync(resolve(themesDirectory, `${themeId}.css`), "utf8");
}

export function getThemeCssIds(): string[] {
  return readdirSync(themesDirectory)
    .filter((file) => file.endsWith(".css"))
    .map((file) => file.replace(/\.css$/, ""));
}

export function extractRuleBlock(css: string, selector: string): string {
  const selectorIndex = css.indexOf(selector);
  if (selectorIndex === -1) {
    throw new Error(`Missing selector "${selector}"`);
  }

  const blockStart = css.indexOf("{", selectorIndex + selector.length);
  if (blockStart === -1) {
    throw new Error(`Missing block for selector "${selector}"`);
  }

  let depth = 0;
  for (let index = blockStart; index < css.length; index += 1) {
    const character = css[index];
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(blockStart + 1, index);
    }
  }

  throw new Error(`Unterminated block for selector "${selector}"`);
}

export function parseCustomProperties(block: string): Map<string, string> {
  const values = new Map<string, string>();
  const pattern = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  for (const match of block.matchAll(pattern)) {
    const name = match[1];
    const value = match[2]?.trim();
    if (name && value) values.set(name, value);
  }
  return values;
}

export function themeSelector(themeId: ThemeId, mode: ThemeModeName): string {
  if (themeId === "default") return mode === "light" ? ":root" : ".dark";
  return mode === "light"
    ? `[data-theme="${themeId}"]:not(.dark)`
    : `[data-theme="${themeId}"].dark`;
}

export function getThemeTokenValues(
  themeId: ThemeId,
  mode: ThemeModeName,
): Map<string, string> {
  return parseCustomProperties(
    extractRuleBlock(getThemeCss(themeId), themeSelector(themeId, mode)),
  );
}
