import { describe, expect, it } from "vitest";
import { NAMESPACES, SUPPORTED_LANGUAGES } from "../config";
import { buildLocaleResources } from "../localeResources";

const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../locales/*/*.json",
  { eager: true },
);

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

const locales = buildLocaleResources(localeModules);
const namespaces = [
  ...new Set(
    Object.values(locales).flatMap((bundles) => Object.keys(bundles)),
  ),
].sort();
const languages = [...SUPPORTED_LANGUAGES].sort();
const referenceLanguage = languages[0];

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
      const reference = flattenKeys(locales[referenceLanguage][namespace]).sort();
      for (const language of languages) {
        expect(
          flattenKeys(locales[language][namespace]).sort(),
          `${language}/${namespace}`,
        ).toEqual(reference);
      }
    }
  });

  it("keeps plural-key families identical across languages", () => {
    const families = Object.fromEntries(
      languages.map((language) => [
        language,
        Object.fromEntries(
          namespaces.map((namespace) => [
            namespace,
            pluralFamilies(locales[language][namespace]),
          ]),
        ),
      ]),
    );

    for (const language of languages) {
      expect(families[language], language).toEqual(
        families[referenceLanguage],
      );
    }
    expect(
      families[referenceLanguage].devThemeGallery.tokenSummary,
    ).toEqual(["one", "other"]);
  });

  it("keeps interpolation placeholders identical across languages", () => {
    for (const namespace of namespaces) {
      const reference = locales[referenceLanguage][namespace];

      for (const key of flattenKeys(reference)) {
        for (const language of languages) {
          expect(
            placeholders(readByPath(locales[language][namespace], key)),
            `${language}/${namespace}.${key}`,
          ).toEqual(placeholders(readByPath(reference, key)));
        }
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
