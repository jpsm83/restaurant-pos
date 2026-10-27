import { describe, expect, it } from "vitest";
import { NAMESPACES, SUPPORTED_LANGUAGES } from "../config";

const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../locales/*/*.json",
  { eager: true },
);

type LocaleBundles = Record<string, Record<string, Record<string, unknown>>>;

function loadLocales(): LocaleBundles {
  const locales: LocaleBundles = {};
  for (const [path, module] of Object.entries(localeModules)) {
    const match = /^\.\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
    if (!match) continue;
    const [, language, namespace] = match;
    if (!locales[language]) locales[language] = {};
    locales[language][namespace] = module.default;
  }
  return locales;
}

function flattenKeys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return flattenKeys(entry as Record<string, unknown>, path);
    }
    return [path];
  });
}

function placeholders(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{\{\s*([\w]+)\s*\}\}/g)]
    .map((match) => match[1])
    .sort();
}

const PLURAL_SUFFIX = /^(.*)_(zero|one|two|few|many|other)$/;

function pluralFamilies(
  value: Record<string, unknown>,
): Record<string, string[]> {
  const families: Record<string, string[]> = {};
  for (const key of flattenKeys(value)) {
    const match = PLURAL_SUFFIX.exec(key);
    if (!match) continue;
    const [, base, category] = match;
    (families[base] ??= []).push(category);
  }
  for (const base of Object.keys(families)) {
    families[base].sort();
  }
  return families;
}

const locales = loadLocales();
const namespaces = [
  ...new Set(
    Object.values(locales).flatMap((bundles) => Object.keys(bundles)),
  ),
].sort();
const languages = [...SUPPORTED_LANGUAGES].sort();

describe("locale parity", () => {
  it("loads every supported language and locale namespace", () => {
    expect(Object.keys(locales).sort()).toEqual(languages);
    for (const namespace of NAMESPACES) {
      expect(namespaces).toContain(namespace);
    }
    for (const language of languages) {
      expect(Object.keys(locales[language]).sort()).toEqual(namespaces);
    }
  });

  it("keeps every namespace's key set identical across languages", () => {
    for (const namespace of namespaces) {
      const en = flattenKeys(locales.en[namespace]).sort();
      const es = flattenKeys(locales.es[namespace]).sort();
      expect(es, `namespace: ${namespace}`).toEqual(en);
    }
  });

  it("keeps plural-key families identical across languages", () => {
    const enFamilies = Object.fromEntries(
      namespaces.map((namespace) => [
        namespace,
        pluralFamilies(locales.en[namespace]),
      ]),
    );
    const esFamilies = Object.fromEntries(
      namespaces.map((namespace) => [
        namespace,
        pluralFamilies(locales.es[namespace]),
      ]),
    );

    expect(esFamilies).toEqual(enFamilies);
    expect(enFamilies.devThemeGallery.tokenSummary).toEqual(["one", "other"]);
  });

  it("keeps interpolation placeholders identical across languages", () => {
    for (const namespace of namespaces) {
      const en = flattenKeys(locales.en[namespace]);
      const es = locales.es[namespace];

      for (const key of en) {
        expect(placeholders(readByPath(es, key)), `${namespace}.${key}`).toEqual(
          placeholders(readByPath(locales.en[namespace], key)),
        );
      }
    }
  });

  it("retains the translated nav theme labels", () => {
    expect(readByPath(locales.en.nav, "account.theme")).toEqual({
      label: "Theme",
      groupLabel: "Theme mode",
      light: "Light",
      dark: "Dark",
      system: "System",
    });
    expect(readByPath(locales.es.nav, "account.theme")).toEqual({
      label: "Tema",
      groupLabel: "Modo de tema",
      light: "Claro",
      dark: "Oscuro",
      system: "Sistema",
    });
  });
});

function readByPath(
  value: Record<string, unknown>,
  path: string,
): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}
