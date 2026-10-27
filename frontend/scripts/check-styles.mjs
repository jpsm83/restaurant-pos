#!/usr/bin/env node
import {
  existsSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import {
  dirname,
  extname,
  matchesGlob,
  resolve,
  relative,
} from "node:path";
import { fileURLToPath } from "node:url";

const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const EMPTY_ALLOWLIST = { colors: [], arbitraryValues: [] };

const PALETTE_COLOURS =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black";
const PALETTE_PREFIXES =
  "bg|text|border|from|to|via|ring|divide|outline|fill|stroke|shadow|placeholder|accent|caret|decoration";
const PALETTE_SIDES = "x|y|s|e|t|r|b|l|offset";

const RAW_PALETTE_PATTERN = new RegExp(
  String.raw`(?<![\w-])(?:${PALETTE_PREFIXES})(?:-(?:${PALETTE_SIDES}))?-(?:${PALETTE_COLOURS})(?:-[0-9]{2,3})?(?:\/[0-9]{1,3})?(?![\w-])`,
  "g",
);

const RAW_COLOUR_SOURCE =
  String.raw`(?<![\w-])#[0-9a-fA-F]{3,8}(?![\w-])|(?:oklch|oklab|rgba?|hsla?|hwb|lab|lch)\([^)]*\)`;
const RAW_COLOUR_PATTERN = new RegExp(RAW_COLOUR_SOURCE, "g");
const RAW_COLOUR_TEST = new RegExp(RAW_COLOUR_SOURCE);

const ARBITRARY_VALUE_PATTERN =
  /(?<![\w-])-?(?!data-|aria-|group-|peer-|has-|not-|supports-|in-|@)[a-z][a-z0-9-]*-\[[^\]\s]+\]/g;

const STRING_LITERAL_PATTERN =
  /(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;

const MESSAGES = {
  "raw-palette":
    "Raw palette utility is not allowed; use a semantic token.",
  "raw-colour":
    "Raw colour literal is not allowed outside src/styles.",
  "arbitrary-value":
    "Arbitrary value is not allowed outside src/styles and src/components/ui.",
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

function isAllowed(filePath, globs) {
  if (!Array.isArray(globs)) return false;
  return globs.some((glob) =>
    matchesGlob(filePath, normalizePath(String(glob))),
  );
}

function findMatches(pattern, content) {
  return [...content.matchAll(pattern)].flatMap((match) =>
    match.index === undefined ? [] : [{ index: match.index, token: match[0] }],
  );
}

function findMatchesInStrings(content, pattern) {
  return [...content.matchAll(STRING_LITERAL_PATTERN)].flatMap((literal) => {
    const body = literal[1];
    if (!body || literal.index === undefined) return [];
    const bodyStart = literal.index + 1;
    return findMatches(pattern, body).map((match) => ({
      index: bodyStart + match.index,
      token: match.token,
    }));
  });
}

function stripCssComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    " ".repeat(comment.length),
  );
}

function violation(filePath, content, match, category, kind) {
  const { line, column } = positionAt(content, match.index);
  return {
    path: filePath,
    line,
    column,
    category,
    kind,
    token: match.token,
    message: `${MESSAGES[kind]} (${match.token})`,
  };
}

function isComponentsUi(filePath) {
  return (
    filePath === "src/components/ui" ||
    filePath.startsWith("src/components/ui/")
  );
}

export function findStyleViolations(files, allowlist = EMPTY_ALLOWLIST) {
  const colorsAllowlist = allowlist?.colors ?? [];
  const arbitraryAllowlist = allowlist?.arbitraryValues ?? [];
  const violations = [];

  for (const file of files) {
    const filePath = normalizePath(file.path);
    const { content } = file;
    if (filePath === "src/styles" || filePath.startsWith("src/styles/")) {
      continue;
    }

    const isCss = filePath.endsWith(".css");
    const scanTarget = isCss ? stripCssComments(content) : content;
    const findColourMatches = (pattern) =>
      isCss
        ? findMatches(pattern, scanTarget)
        : findMatchesInStrings(scanTarget, pattern);
    const reported = [];

    if (!isAllowed(filePath, colorsAllowlist)) {
      if (!isCss) {
        for (const match of findColourMatches(RAW_PALETTE_PATTERN)) {
          reported.push(
            violation(filePath, content, match, "colors", "raw-palette"),
          );
        }
      }
      for (const match of findColourMatches(RAW_COLOUR_PATTERN)) {
        reported.push(
          violation(filePath, content, match, "colors", "raw-colour"),
        );
      }
    }

    if (!isComponentsUi(filePath) && !isAllowed(filePath, arbitraryAllowlist)) {
      const arbitraryMatches = isCss
        ? findMatches(ARBITRARY_VALUE_PATTERN, scanTarget)
        : findMatchesInStrings(scanTarget, ARBITRARY_VALUE_PATTERN);
      for (const match of arbitraryMatches) {
        if (RAW_COLOUR_TEST.test(match.token)) continue;
        reported.push(
          violation(filePath, content, match, "arbitraryValues", "arbitrary-value"),
        );
      }
    }

    reported.sort(
      (left, right) => left.line - right.line || left.column - right.column,
    );
    violations.push(...reported);
  }

  return violations;
}

function collectSourceFiles(root) {
  const sourceRoot = resolve(root, "src");
  if (!existsSync(sourceRoot)) return [];

  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (SCANNED_EXTENSIONS.has(extname(entry.name))) {
        files.push({
          path: normalizePath(relative(root, fullPath)),
          content: readFileSync(fullPath, "utf8"),
        });
      }
    }
  };

  walk(sourceRoot);
  return files;
}

function loadAllowlist(root) {
  const allowlistPath = resolve(root, "style-allowlist.json");
  if (!existsSync(allowlistPath)) return EMPTY_ALLOWLIST;

  const parsed = JSON.parse(readFileSync(allowlistPath, "utf8"));
  return {
    colors: Array.isArray(parsed.colors) ? parsed.colors : [],
    arbitraryValues: Array.isArray(parsed.arbitraryValues)
      ? parsed.arbitraryValues
      : [],
  };
}

function runCli() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const root = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(scriptDirectory, "..");
  const violations = findStyleViolations(
    collectSourceFiles(root),
    loadAllowlist(root),
  );

  if (violations.length === 0) return 0;

  for (const item of violations) {
    console.error(
      `${item.path}:${item.line}:${item.column} ${item.message}`,
    );
  }
  console.error(`\n${violations.length} style violation(s) found.`);
  return 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
