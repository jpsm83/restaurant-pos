#!/usr/bin/env node
import {
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { dirname, extname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const LOCALE_PATH = /(?:^|\/)locales\/([^/]+)\/([^/]+)\.json$/;
const PLURAL_SUFFIX = /^(.*)_(zero|one|two|few|many|other)$/;
const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const USER_FACING_ATTRIBUTES = new Set([
  "aria-label",
  "aria-description",
  "title",
  "placeholder",
  "alt",
  "label",
  "tooltip",
]);
const USER_FACING_PROPERTY_NAMES = new Set(["label", "message", "fallback"]);
const USER_FACING_PROP_DEFAULT = new RegExp(
  String.raw`^(?:label|title|description|message|placeholder|alt|tooltip|fallback|text|hint|helper|summary|error|empty|loading|retry|save|saving|reset|close|confirm|cancel|aria|heading|caption|action|submit|search|leave|stay|noData|.+?(?:Label|Title|Description|Message|Placeholder|Tooltip|Text|Hint|Fallback|Heading|Caption|Aria))$`,
);

const MESSAGES = {
  "missing-key": "Locale key is missing in this language.",
  "extra-key": "Locale key exists only in this language.",
  "plural-drift": "Plural-key family differs across languages.",
  "placeholder-drift": "Interpolation placeholders differ across languages.",
  "missing-namespace": "Locale namespace is missing in this language.",
  "missing-used-key": "Literal t() key does not exist in every language.",
  "english-default-value": "English defaultValue literal is not allowed.",
  "jsx-text": "Hardcoded JSX text is not allowed; use t().",
  "string-attribute": "Hardcoded user-facing attribute is not allowed; use t().",
  "toast-literal": "Hardcoded toast copy is not allowed; use t().",
  "literal-property": "Hardcoded user-facing property is not allowed; use t().",
  "prop-default": "Hardcoded user-facing prop default is not allowed; use t().",
  "template-aria-label":
    "Template literal aria label is not allowed; use t() with interpolation.",
};

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function positionAt(content, index) {
  const before = content.slice(0, index);
  const line = before.split("\n").length;
  const lastNewline = before.lastIndexOf("\n");
  return { line, column: index - lastNewline };
}

function createViolation(path, line, column, category, kind, token) {
  return {
    path,
    line,
    column,
    category,
    kind,
    token,
    message: `${MESSAGES[kind]} (${token})`,
  };
}

function flattenKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return flattenKeys(entry, path);
    }
    return [path];
  });
}

function readByPath(value, path) {
  return path.split(".").reduce((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return current[segment];
  }, value);
}

function placeholders(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(PLACEHOLDER_PATTERN)]
    .map((match) => match[1].trim())
    .sort();
}

function pluralFamilies(value) {
  const families = {};
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

function localeEntries(files) {
  return files.flatMap((file) => {
    const path = normalizePath(file.path);
    const match = LOCALE_PATH.exec(path);
    if (!match) return [];
    const [, language, namespace] = match;
    return [
      {
        path,
        content: file.content,
        language,
        namespace,
        resource: JSON.parse(file.content),
      },
    ];
  });
}

function localePosition(content, key) {
  const last = key.split(".").at(-1) ?? key;
  const index = content.indexOf(`"${last}"`);
  return index === -1 ? { line: 1, column: 1 } : positionAt(content, index);
}

function localeFilePath(templatePath, language, namespace) {
  const index = templatePath.indexOf("locales/");
  const prefix = index === -1 ? "locales/" : templatePath.slice(0, index);
  return `${prefix}locales/${language}/${namespace}.json`;
}

export function findLocaleViolations(localeFiles) {
  const entries = localeEntries(localeFiles);
  if (entries.length === 0) return [];

  const { languages, namespaces } = summarizeEntries(entries);
  const referenceLanguage = languages.includes("en") ? "en" : languages[0];

  const byLanguage = Object.fromEntries(languages.map((language) => [language, {}]));
  for (const entry of entries) {
    byLanguage[entry.language][entry.namespace] = entry;
  }

  const referenceEntry = entries.find(
    (entry) => entry.language === referenceLanguage,
  );
  const violations = [];

  for (const namespace of namespaces) {
    for (const language of languages) {
      if (!byLanguage[language][namespace]) {
        violations.push(
          createViolation(
            localeFilePath(referenceEntry.path, language, namespace),
            1,
            1,
            "locale",
            "missing-namespace",
            namespace,
          ),
        );
      }
    }
  }

  for (const namespace of namespaces) {
    const reference = byLanguage[referenceLanguage][namespace];
    if (!reference) continue;
    const referenceKeys = flattenKeys(reference.resource);
    const referenceKeySet = new Set(referenceKeys);
    const referenceFamilies = pluralFamilies(reference.resource);

    for (const language of languages) {
      if (language === referenceLanguage) continue;
      const entry = byLanguage[language][namespace];
      if (!entry) continue;

      const languageKeys = flattenKeys(entry.resource);
      const languageKeySet = new Set(languageKeys);

      for (const key of referenceKeys) {
        if (languageKeySet.has(key)) continue;
        const { line, column } = localePosition(entry.content, key);
        violations.push(
          createViolation(
            entry.path,
            line,
            column,
            "locale",
            "missing-key",
            key,
          ),
        );
      }

      for (const key of languageKeys) {
        if (referenceKeySet.has(key)) continue;
        const { line, column } = localePosition(entry.content, key);
        violations.push(
          createViolation(
            entry.path,
            line,
            column,
            "locale",
            "extra-key",
            key,
          ),
        );
      }

      const languageFamilies = pluralFamilies(entry.resource);
      const familyBases = new Set([
        ...Object.keys(referenceFamilies),
        ...Object.keys(languageFamilies),
      ]);
      for (const base of familyBases) {
        const expected = referenceFamilies[base] ?? [];
        const actual = languageFamilies[base] ?? [];
        if (expected.join(",") === actual.join(",")) continue;
        const { line, column } = localePosition(entry.content, base);
        violations.push(
          createViolation(
            entry.path,
            line,
            column,
            "locale",
            "plural-drift",
            base,
          ),
        );
      }

      for (const key of referenceKeys) {
        if (!languageKeySet.has(key)) continue;
        const expected = placeholders(readByPath(reference.resource, key));
        const actual = placeholders(readByPath(entry.resource, key));
        if (expected.join(",") === actual.join(",")) continue;
        const { line, column } = localePosition(entry.content, key);
        violations.push(
          createViolation(
            entry.path,
            line,
            column,
            "locale",
            "placeholder-drift",
            key,
          ),
        );
      }
    }
  }

  return violations;
}

function isTestPath(path) {
  return (
    path.includes("/__tests__/") ||
    path.startsWith("__tests__/") ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    path.includes("/src/test/") ||
    path.startsWith("src/test/")
  );
}

function isTypeDeclaration(path) {
  return /\.d\.[cm]?ts$/.test(path);
}

function isGeneratedPath(path) {
  return (
    /(^|\/)(generated|__generated__|dist)\//.test(path) ||
    /\.gen\.[cm]?[jt]sx?$/.test(path)
  );
}

function isProductionSource(path) {
  const normalized = normalizePath(path);
  return (
    /\.(ts|tsx)$/.test(normalized) &&
    !LOCALE_PATH.test(normalized) &&
    !isTestPath(normalized) &&
    !isTypeDeclaration(normalized) &&
    !isGeneratedPath(normalized)
  );
}

function walk(node, visitor) {
  visitor(node);
  ts.forEachChild(node, (child) => walk(child, visitor));
}

function hasLetters(text) {
  return /\p{L}/u.test(text);
}

function literalText(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

function summarizeEntries(entries) {
  return {
    languages: [...new Set(entries.map((entry) => entry.language))].sort(),
    namespaces: [...new Set(entries.map((entry) => entry.namespace))].sort(),
  };
}

function buildLocaleIndex(entries) {
  const { languages, namespaces } = summarizeEntries(entries);
  const keys = {};
  const pluralBases = {};

  for (const language of languages) {
    keys[language] = {};
    pluralBases[language] = {};
  }

  for (const entry of entries) {
    const leafKeys = flattenKeys(entry.resource);
    keys[entry.language][entry.namespace] = new Set(leafKeys);
    pluralBases[entry.language][entry.namespace] = new Set(
      leafKeys.flatMap((key) => {
        const match = PLURAL_SUFFIX.exec(key);
        return match ? [match[1]] : [];
      }),
    );
  }

  return { languages, namespaces, keys, pluralBases };
}

function namespaceHasKey(index, language, namespace, key) {
  return (
    index.keys[language]?.[namespace]?.has(key) === true ||
    index.pluralBases[language]?.[namespace]?.has(key) === true
  );
}

function namespacesWithKey(index, namespaces, key) {
  return namespaces.filter((namespace) =>
    index.languages.every((language) =>
      namespaceHasKey(index, language, namespace, key),
    ),
  );
}

function splitNamespacedKey(key) {
  const separator = key.indexOf(":");
  if (separator === -1) return { namespace: null, key };
  return {
    namespace: key.slice(0, separator),
    key: key.slice(separator + 1),
  };
}

function collectTranslationNamespaces(sourceFile) {
  const namespaces = new Set();
  let unresolved = false;

  walk(sourceFile, (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      node.expression.text !== "useTranslation"
    ) {
      return;
    }

    const argument = node.arguments[0];
    if (!argument) {
      namespaces.add("common");
      return;
    }
    if (
      ts.isStringLiteral(argument) ||
      ts.isNoSubstitutionTemplateLiteral(argument)
    ) {
      namespaces.add(argument.text);
      return;
    }
    if (ts.isArrayLiteralExpression(argument)) {
      for (const element of argument.elements) {
        if (
          ts.isStringLiteral(element) ||
          ts.isNoSubstitutionTemplateLiteral(element)
        ) {
          namespaces.add(element.text);
        } else {
          unresolved = true;
        }
      }
      return;
    }
    unresolved = true;
  });

  if (namespaces.size === 0) unresolved = true;
  return { namespaces: [...namespaces], unresolved };
}

function isTCall(node) {
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return node.expression.text === "t";
  if (ts.isPropertyAccessExpression(node.expression)) {
    const owner = node.expression.expression;
    return (
      node.expression.name.text === "t" &&
      ts.isIdentifier(owner) &&
      /i18n/i.test(owner.text)
    );
  }
  return false;
}

function sourcePosition(sourceFile, node) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return { line: line + 1, column: character + 1 };
}

function checkUsedKey(node, path, sourceFile, index, namespaceInfo, violations) {
  const argument = node.arguments[0];
  const keyText = literalText(argument);
  if (keyText === null) return;

  const { namespace, key } = splitNamespacedKey(keyText);
  const { languages, namespaces } = index;
  let candidates;

  if (namespace) {
    candidates = namespacesWithKey(index, [namespace], key);
  } else {
    const resolved = namespacesWithKey(
      index,
      namespaceInfo.namespaces,
      key,
    );
    if (resolved.length > 0) {
      candidates = resolved;
    } else if (namespaceInfo.unresolved) {
      candidates = namespacesWithKey(index, namespaces, key);
    } else {
      candidates = [];
    }
  }

  if (candidates.length > 0) return;
  if (languages.length === 0) return;

  const { line, column } = sourcePosition(sourceFile, argument);
  violations.push(
    createViolation(
      path,
      line,
      column,
      "used-key",
      "missing-used-key",
      keyText,
    ),
  );
}

function checkDefaultValue(node, path, sourceFile, violations) {
  const options = node.arguments[1];
  if (!options || !ts.isObjectLiteralExpression(options)) return;

  for (const property of options.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      propertyName(property.name) !== "defaultValue"
    ) {
      continue;
    }
    const text =
      literalText(property.initializer) ??
      (ts.isTemplateExpression(property.initializer)
        ? templateText(property.initializer, sourceFile)
        : null);
    if (!text || !hasLetters(text)) continue;
    const { line, column } = sourcePosition(sourceFile, property.initializer);
    violations.push(
      createViolation(
        path,
        line,
        column,
        "default-value",
        "english-default-value",
        text,
      ),
    );
  }
}

function isIgnoredCopyToken(trimmed) {
  if (!hasLetters(trimmed)) return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return true;
  if (/^(?:mailto|tel):/i.test(trimmed)) return true;
  if (/^\/[A-Za-z0-9/_.~:-]*$/.test(trimmed)) return true;
  if (/^--[\w-]+$/.test(trimmed)) return true;
  if (/^(?:data|aria)-[\w-]+(?:=.*)?$/i.test(trimmed)) return true;
  if (/^(?:&[a-z]+;|\s)+$/i.test(trimmed)) return true;
  return false;
}

function isIgnoredCopy(text) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (isIgnoredCopyToken(trimmed)) return true;
  const tokens = trimmed.split(/\s+/);
  return tokens.length > 1 && tokens.every(isIgnoredCopyToken);
}

function templateText(node, sourceFile) {
  const text = node.getText(sourceFile);
  return text.startsWith("`") ? text.slice(1, -1) : text;
}

function checkCopyText(
  text,
  path,
  sourceFile,
  node,
  kind,
  violations,
  token = text.trim().replace(/\s+/g, " "),
) {
  if (isIgnoredCopy(text)) return;
  const { line, column } = sourcePosition(sourceFile, node);
  violations.push(createViolation(path, line, column, "hardcoded-copy", kind, token));
}

function checkCopyExpression(
  node,
  path,
  sourceFile,
  kind,
  violations,
) {
  if (!node) return;
  const text = literalText(node);
  if (text !== null) {
    checkCopyText(text, path, sourceFile, node, kind, violations);
    return;
  }
  if (ts.isTemplateExpression(node)) {
    checkCopyText(
      templateText(node, sourceFile),
      path,
      sourceFile,
      node,
      kind,
      violations,
    );
  }
}

function isDiagnosticContext(node) {
  let current = node.parent;
  while (current) {
    if (
      ts.isNewExpression(current) &&
      ts.isIdentifier(current.expression) &&
      /Error$/.test(current.expression.text)
    ) {
      return true;
    }
    if (ts.isCallExpression(current)) {
      const callee = current.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const owner = ts.isIdentifier(callee.expression)
          ? callee.expression.text
          : "";
        if (owner === "console" || owner === "logger") return true;
      }
      if (
        ts.isIdentifier(callee) &&
        /^(?:log|debug|warn|error|info|report)/i.test(callee.text)
      ) {
        return true;
      }
    }
    if (ts.isThrowStatement(current)) return true;
    current = current.parent;
  }
  return false;
}

function isComponentFunction(node) {
  if (
    (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
    node.name
  ) {
    return /^[A-Z]/.test(node.name.text);
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    return (
      ts.isVariableDeclaration(parent) &&
      ts.isIdentifier(parent.name) &&
      /^[A-Z]/.test(parent.name.text)
    );
  }
  return false;
}

function isComponentParameterBinding(node) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return isComponentFunction(current);
    if (ts.isBlock(current)) return false;
    current = current.parent;
  }
  return false;
}

function isInsideTrans(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      return current.openingElement.tagName.getText() === "Trans";
    }
    if (ts.isFunctionLike(current) || ts.isSourceFile(current)) return false;
    current = current.parent;
  }
  return false;
}

function checkHardcodedCopy(node, path, sourceFile, violations) {
  if (ts.isJsxText(node)) {
    if (!isInsideTrans(node)) {
      checkCopyText(
        node.getText(sourceFile),
        path,
        sourceFile,
        node,
        "jsx-text",
        violations,
      );
    }
    return;
  }

  if (
    ts.isJsxExpression(node) &&
    (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
    node.expression &&
    !isInsideTrans(node)
  ) {
    checkCopyExpression(
      node.expression,
      path,
      sourceFile,
      "jsx-text",
      violations,
    );
    return;
  }

  if (ts.isJsxAttribute(node)) {
    const name = node.name.getText(sourceFile);
    if (!USER_FACING_ATTRIBUTES.has(name)) return;
    const initializer = node.initializer;
    if (!initializer) return;

    if (
      ts.isStringLiteral(initializer) ||
      ts.isNoSubstitutionTemplateLiteral(initializer)
    ) {
      checkCopyText(
        initializer.text,
        path,
        sourceFile,
        initializer,
        "string-attribute",
        violations,
      );
      return;
    }

    if (!ts.isJsxExpression(initializer) || !initializer.expression) return;
    const expression = initializer.expression;
    const text = literalText(expression);
    if (text !== null) {
      checkCopyText(
        text,
        path,
        sourceFile,
        expression,
        "string-attribute",
        violations,
      );
      return;
    }
    if (ts.isTemplateExpression(expression) && name === "aria-label") {
      checkCopyText(
        templateText(expression, sourceFile),
        path,
        sourceFile,
        expression,
        "template-aria-label",
        violations,
      );
    }
    return;
  }

  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "toast"
  ) {
    checkCopyExpression(
      node.arguments[0],
      path,
      sourceFile,
      "toast-literal",
      violations,
    );
    return;
  }

  if (
    ts.isPropertyAssignment(node) &&
    USER_FACING_PROPERTY_NAMES.has(propertyName(node.name)) &&
    !isDiagnosticContext(node)
  ) {
    checkCopyExpression(
      node.initializer,
      path,
      sourceFile,
      "literal-property",
      violations,
    );
    return;
  }

  if (
    ts.isBindingElement(node) &&
    node.initializer &&
    isComponentParameterBinding(node)
  ) {
    const name = propertyName(node.name);
    if (name && USER_FACING_PROP_DEFAULT.test(name)) {
      checkCopyExpression(
        node.initializer,
        path,
        sourceFile,
        "prop-default",
        violations,
      );
    }
  }
}

export function findSourceViolations(sourceFiles, localeFiles) {
  const index = buildLocaleIndex(localeEntries(localeFiles));
  const violations = [];

  for (const file of sourceFiles) {
    const path = normalizePath(file.path);
    if (!isProductionSource(path)) continue;

    const sourceFile = ts.createSourceFile(
      path,
      file.content,
      ts.ScriptTarget.Latest,
      true,
      path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const namespaceInfo = collectTranslationNamespaces(sourceFile);

    walk(sourceFile, (node) => {
      if (isTCall(node)) {
        checkUsedKey(node, path, sourceFile, index, namespaceInfo, violations);
        checkDefaultValue(node, path, sourceFile, violations);
      }
      checkHardcodedCopy(node, path, sourceFile, violations);
    });
  }

  return violations;
}

export function findI18nViolations(sourceFiles, localeFiles) {
  return [
    ...findLocaleViolations(localeFiles),
    ...findSourceViolations(sourceFiles, localeFiles),
  ];
}

function collectFiles(root, extensions) {
  const sourceRoot = resolve(root, "src");
  if (!existsSync(sourceRoot)) return [];

  const files = [];
  const walkDirectory = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        walkDirectory(fullPath);
      } else if (extensions.has(extname(entry.name))) {
        files.push({
          path: normalizePath(relative(root, fullPath)),
          content: readFileSync(fullPath, "utf8"),
        });
      }
    }
  };

  walkDirectory(sourceRoot);
  return files;
}

function runCli() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const root = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(scriptDirectory, "..");
  const sourceFiles = collectFiles(root, new Set([".ts", ".tsx"]));
  const localeFiles = collectFiles(root, new Set([".json"])).filter((file) =>
    LOCALE_PATH.test(file.path),
  );
  const violations = findI18nViolations(sourceFiles, localeFiles);

  if (violations.length === 0) return 0;

  for (const item of violations) {
    console.error(`${item.path}:${item.line}:${item.column} ${item.message}`);
  }
  console.error(`\n${violations.length} i18n violation(s) found.`);
  return 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
