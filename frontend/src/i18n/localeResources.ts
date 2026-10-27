/** Shared locale-bundle assembly for the production singleton, tests, and parity checks. */

export type LocaleModule = { default: Record<string, unknown> };

export type LocaleResources = Record<
  string,
  Record<string, Record<string, unknown>>
>;

const LOCALE_PATH = /\/locales\/([^/]+)\/([^/]+)\.json$/;

export function buildLocaleResources(
  modules: Record<string, LocaleModule>,
  namespaces?: readonly string[],
): LocaleResources {
  const resources: LocaleResources = {};

  for (const [path, module] of Object.entries(modules)) {
    const match = LOCALE_PATH.exec(path);
    if (!match) continue;
    const [, language, namespace] = match;
    if (namespaces && !namespaces.includes(namespace)) continue;

    (resources[language] ??= {})[namespace] = module.default;
  }

  return resources;
}
