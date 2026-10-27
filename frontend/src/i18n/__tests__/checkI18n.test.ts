/// <reference types="node" />
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findLocaleViolations,
  findSourceViolations,
  type I18nFile,
  type I18nViolation,
  type I18nViolationKind,
} from "../../../scripts/check-i18n.mjs";

const LOCALE_ROOT = "src/i18n/locales";

function localeFile(
  language: string,
  namespace: string,
  resource: Record<string, unknown>,
): I18nFile {
  return {
    path: `${LOCALE_ROOT}/${language}/${namespace}.json`,
    content: JSON.stringify(resource, null, 2),
  };
}

function kinds(violations: I18nViolation[]): I18nViolationKind[] {
  return violations.map((violation) => violation.kind);
}

describe("findLocaleViolations", () => {
  it("accepts identical key sets, plural families, and placeholders", () => {
    const violations = findLocaleViolations([
      localeFile("en", "common", {
        greeting: "Hello {{name}}",
        item_one: "{{count}} item",
        item_other: "{{count}} items",
      }),
      localeFile("es", "common", {
        greeting: "Hola {{name}}",
        item_one: "{{count}} elemento",
        item_other: "{{count}} elementos",
      }),
    ]);

    expect(violations).toEqual([]);
  });

  it("reports a key missing from a language", () => {
    const violations = findLocaleViolations([
      localeFile("en", "common", { greeting: "Hello", farewell: "Bye" }),
      localeFile("es", "common", { greeting: "Hola" }),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        path: `${LOCALE_ROOT}/es/common.json`,
        category: "locale",
        kind: "missing-key",
        token: "farewell",
      }),
    ]);
  });

  it("reports an extra key in a language", () => {
    const violations = findLocaleViolations([
      localeFile("en", "common", { greeting: "Hello" }),
      localeFile("es", "common", { greeting: "Hola", farewell: "Adiós" }),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        path: `${LOCALE_ROOT}/es/common.json`,
        category: "locale",
        kind: "extra-key",
        token: "farewell",
      }),
    ]);
  });

  it("reports plural-key family drift", () => {
    const violations = findLocaleViolations([
      localeFile("en", "common", {
        item_one: "{{count}} item",
        item_other: "{{count}} items",
      }),
      localeFile("es", "common", {
        item_one: "{{count}} elemento",
        item_many: "{{count}} elementos",
      }),
    ]);

    expect(kinds(violations)).toContain("plural-drift");
    expect(
      violations.find((violation) => violation.kind === "plural-drift"),
    ).toEqual(
      expect.objectContaining({
        path: `${LOCALE_ROOT}/es/common.json`,
        token: "item",
      }),
    );
  });

  it("reports formatted interpolation placeholder drift", () => {
    const violations = findLocaleViolations([
      localeFile("en", "common", { total: "Total {{amount, number}}" }),
      localeFile("es", "common", { total: "Total {{amount}}" }),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        kind: "placeholder-drift",
        token: "total",
      }),
    ]);
  });

  it("reports interpolation placeholder drift", () => {
    const violations = findLocaleViolations([
      localeFile("en", "common", { greeting: "Hello {{name}}" }),
      localeFile("es", "common", { greeting: "Hola {{nombre}}" }),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        path: `${LOCALE_ROOT}/es/common.json`,
        category: "locale",
        kind: "placeholder-drift",
        token: "greeting",
      }),
    ]);
  });

  it("reports a namespace missing from a language", () => {
    const violations = findLocaleViolations([
      localeFile("en", "common", { greeting: "Hello" }),
      localeFile("es", "common", { greeting: "Hola" }),
      localeFile("en", "business", { title: "Business" }),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        path: `${LOCALE_ROOT}/es/business.json`,
        category: "locale",
        kind: "missing-namespace",
        token: "business",
      }),
    ]);
  });

  it("reports an undocumented extra namespace in a language", () => {
    const violations = findLocaleViolations([
      localeFile("en", "common", { greeting: "Hello" }),
      localeFile("es", "common", { greeting: "Hola" }),
      localeFile("en", "business", { title: "Business" }),
      localeFile("es", "business", { title: "Negocio" }),
      localeFile("es", "extra", { title: "Extra" }),
    ]);

    expect(violations).toEqual([
      expect.objectContaining({
        path: `${LOCALE_ROOT}/en/extra.json`,
        kind: "missing-namespace",
        token: "extra",
      }),
    ]);
  });
});

function sourceFile(path: string, content: string): I18nFile {
  return { path, content };
}

function baseLocales(): I18nFile[] {
  return [
    localeFile("en", "common", {
      greeting: "Hello",
      item_one: "{{count}} item",
      item_other: "{{count}} items",
    }),
    localeFile("es", "common", {
      greeting: "Hola",
      item_one: "{{count}} elemento",
      item_other: "{{count}} elementos",
    }),
    localeFile("en", "business", { title: "Business" }),
    localeFile("es", "business", { title: "Negocio" }),
  ];
}

function findSource(content: string, path = "src/components/Example.tsx") {
  return findSourceViolations([sourceFile(path, content)], baseLocales());
}

describe("findSourceViolations used keys", () => {
  it("accepts a literal t() key in the file's useTranslation namespace", () => {
    const violations = findSource(`
      import { useTranslation } from "react-i18next";
      export function Example() {
        const { t } = useTranslation("business");
        return <h1>{t("title")}</h1>;
      }
    `);

    expect(violations).toEqual([]);
  });

  it("reports a literal t() key missing from the resolved namespace", () => {
    const violations = findSource(`
      import { useTranslation } from "react-i18next";
      export function Example() {
        const { t } = useTranslation("business");
        return <h1>{t("missing.title")}</h1>;
      }
    `);

    expect(violations).toEqual([
      expect.objectContaining({
        category: "used-key",
        kind: "missing-used-key",
        token: "missing.title",
      }),
    ]);
  });

  it("honours a namespace prefix on the key", () => {
    const violations = findSource(`
      import { useTranslation } from "react-i18next";
      export function Example() {
        const { t } = useTranslation("business");
        return <h1>{t("common:greeting")}</h1>;
      }
    `);

    expect(violations).toEqual([]);
  });

  it("checks against any namespace in both languages when the namespace is unresolved", () => {
    const valid = findSource(`
      import i18n from "@/i18n/i18n";
      export function load() {
        return i18n.t("greeting");
      }
    `);
    const invalid = findSource(`
      import i18n from "@/i18n/i18n";
      export function load() {
        return i18n.t("missing.key");
      }
    `);

    expect(valid).toEqual([]);
    expect(invalid).toEqual([
      expect.objectContaining({ kind: "missing-used-key", token: "missing.key" }),
    ]);
  });

  it("ignores methods named t on non-i18n objects", () => {
    const violations = findSource(`
      const service = { t: (key: string) => key };
      export function load() {
        return service.t("missing.key");
      }
    `);

    expect(violations).toEqual([]);
  });

  it("skips dynamic t() keys", () => {
    const violations = findSource(`
      import { useTranslation } from "react-i18next";
      export function Example({ key }: { key: string }) {
        const { t } = useTranslation("common");
        return <h1>{t(key)}</h1>;
      }
    `);

    expect(violations).toEqual([]);
  });

  it("resolves a plural base key", () => {
    const violations = findSource(`
      import { useTranslation } from "react-i18next";
      export function Example({ count }: { count: number }) {
        const { t } = useTranslation("common");
        return <h1>{t("item", { count })}</h1>;
      }
    `);

    expect(violations).toEqual([]);
  });

  it("reports an English template literal defaultValue passed to t()", () => {
    const violations = findSource(`
      import { useTranslation } from "react-i18next";
      export function Example({ name }: { name: string }) {
        const { t } = useTranslation("business");
        return <h1>{t("title", { defaultValue: \`Hello \${name}\` })}</h1>;
      }
    `);

    expect(violations).toEqual([
      expect.objectContaining({
        category: "default-value",
        kind: "english-default-value",
        token: "Hello ${name}",
      }),
    ]);
  });

  it("reports an English defaultValue literal passed to t()", () => {
    const violations = findSource(`
      import { useTranslation } from "react-i18next";
      export function Example() {
        const { t } = useTranslation("business");
        return <h1>{t("title", { defaultValue: "Business" })}</h1>;
      }
    `);

    expect(violations).toEqual([
      expect.objectContaining({
        category: "default-value",
        kind: "english-default-value",
        token: "Business",
      }),
    ]);
  });
});

describe("findSourceViolations hardcoded copy", () => {
  it("reports JSX text containing letters", () => {
    const violations = findSource(`
      export function Example() {
        return <p>Hardcoded copy</p>;
      }
    `);

    expect(violations).toEqual([
      expect.objectContaining({
        category: "hardcoded-copy",
        kind: "jsx-text",
        token: "Hardcoded copy",
      }),
    ]);
  });

  it("ignores JSX text without letters", () => {
    const violations = findSource(`
      export function Example({ value }: { value: string }) {
        return <span> {value} — 42 </span>;
      }
    `);

    expect(violations).toEqual([]);
  });

  it("reports user-facing string attributes", () => {
    const violations = findSource(`
      export function Example() {
        return (
          <div
            aria-label="Close"
            title="Close"
            placeholder="Close"
            alt="Close"
            label="Close"
            tooltip="Close"
          />
        );
      }
    `);

    expect(violations).toHaveLength(6);
    expect(
      violations.every(
        (violation) => violation.kind === "string-attribute",
      ),
    ).toBe(true);
  });

  it("reports literal toast first arguments", () => {
    const violations = findSource(`
      import { toast } from "sonner";
      export function save() {
        toast.success("Saved successfully");
      }
    `);

    expect(violations).toEqual([
      expect.objectContaining({
        category: "hardcoded-copy",
        kind: "toast-literal",
        token: "Saved successfully",
      }),
    ]);
  });

  it("reports literal label, message, and fallback properties", () => {
    const violations = findSource(`
      export const options = [
        { label: "Monday" },
        { message: "Something failed" },
        { fallback: "Fallback copy" },
      ];
    `);

    expect(kinds(violations)).toEqual([
      "literal-property",
      "literal-property",
      "literal-property",
    ]);
    expect(violations.map((violation) => violation.token)).toEqual([
      "Monday",
      "Something failed",
      "Fallback copy",
    ]);
  });

  it("reports literal user-facing component prop defaults", () => {
    const violations = findSource(`
      export function Example({ title = "Default title" }: { title?: string }) {
        return <h1>{title}</h1>;
      }
    `);

    expect(violations).toEqual([
      expect.objectContaining({
        kind: "prop-default",
        token: "Default title",
      }),
    ]);
  });

  it("ignores literal user-facing defaults on non-component helpers", () => {
    const violations = findSource(`
      export function formatMessage({ message = "Something failed" }) {
        return message;
      }
    `);

    expect(violations).toEqual([]);
  });

  it("reports template literals used as aria labels", () => {
    const violations = findSource(`
      export function Example({ columnId }: { columnId: string }) {
        return <button aria-label={\`Filter \${columnId}\`} />;
      }
    `);

    expect(violations).toEqual([
      expect.objectContaining({
        kind: "template-aria-label",
        token: "Filter ${columnId}",
      }),
    ]);
  });

  it("accepts translated JSX text, attributes, toasts, and properties", () => {
    const violations = findSource(`
      import { useTranslation } from "react-i18next";
      import { toast } from "sonner";
      export function Example() {
        const { t } = useTranslation("common");
        const options = [{ label: t("greeting") }];
        toast.success(t("greeting"));
        return (
          <div aria-label={t("greeting")} title={t("greeting")}>
            {t("greeting")}
          </div>
        );
      }
    `);

    expect(violations).toEqual([]);
  });
});

describe("findSourceViolations ignored cases", () => {
  it("ignores developer diagnostics", () => {
    const violations = findSource(`
      export function load() {
        console.error("Failed to load");
        throw new Error("Failed to load");
      }
      export function fail() {
        throw { message: "Failed to load" };
      }
    `);

    expect(violations).toEqual([]);
  });

  it("ignores class names, URLs, data values, and route paths", () => {
    const violations = findSource(`
      import { Link } from "react-router-dom";
      export function Example() {
        return (
          <div className="flex items-center">
            <a href="https://example.com/path" aria-label="https://example.com/path">
              https://example.com/path
            </a>
            <option value="active">Active</option>
            <Link to="/login">Login</Link>
          </div>
        );
      }
    `);

    expect(violations).toEqual([
      expect.objectContaining({ kind: "jsx-text", token: "Active" }),
      expect.objectContaining({ kind: "jsx-text", token: "Login" }),
    ]);
  });

  it("ignores locale resources", () => {
    const violations = findSourceViolations(
      [
        sourceFile(
          "src/i18n/locales/en/common.json",
          '{ "greeting": "Hello" }',
        ),
      ],
      baseLocales(),
    );

    expect(violations).toEqual([]);
  });

  it("ignores tests and test helpers", () => {
    const violations = findSourceViolations(
      [
        sourceFile(
          "src/components/__tests__/Example.test.tsx",
          "export const x = <p>Hardcoded</p>;",
        ),
        sourceFile(
          "src/test/i18nTestUtils.tsx",
          "export const x = <p>Hardcoded</p>;",
        ),
      ],
      baseLocales(),
    );

    expect(violations).toEqual([]);
  });

  it("ignores type declarations", () => {
    const violations = findSourceViolations(
      [
        sourceFile(
          "src/types/example.d.ts",
          'declare const message: "Hardcoded";',
        ),
      ],
      baseLocales(),
    );

    expect(violations).toEqual([]);
  });

  it("ignores generated assets", () => {
    const violations = findSourceViolations(
      [
        sourceFile(
          "src/generated/api.ts",
          'toast.success("Hardcoded generated copy");',
        ),
      ],
      baseLocales(),
    );

    expect(violations).toEqual([]);
  });
});

const tempDirectories: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "i18n-guard-"));
  tempDirectories.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  return root;
}

function writeTempFile(root: string, path: string, content: string) {
  const fullPath = join(root, path);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
}

function runCli(root: string) {
  const scriptPath = resolve(process.cwd(), "scripts/check-i18n.mjs");
  return spawnSync(process.execPath, [scriptPath, root], {
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("i18n guard CLI", () => {
  it("exits non-zero on violations and zero when clean", () => {
    const root = makeTempRoot();
    writeTempFile(
      root,
      "src/i18n/locales/en/common.json",
      JSON.stringify({ greeting: "Hello" }),
    );
    writeTempFile(
      root,
      "src/i18n/locales/es/common.json",
      JSON.stringify({ greeting: "Hola" }),
    );
    writeTempFile(root, "src/Example.tsx", "export const x = <p>Hardcoded</p>;");

    const failing = runCli(root);
    expect(failing.status).toBe(1);
    expect(failing.stderr).toContain("Example.tsx");

    writeTempFile(
      root,
      "src/Example.tsx",
      [
        'import { useTranslation } from "react-i18next";',
        "export function Example() {",
        '  const { t } = useTranslation("common");',
        '  return <p>{t("greeting")}</p>;',
        "}",
      ].join("\n"),
    );

    expect(runCli(root).status).toBe(0);
  });
});

describe("findSourceViolations data-like JSX text", () => {
  it("ignores CSS custom properties, data attributes, and HTML entities", () => {
    const violations = findSource(`
      export function Example() {
        return (
          <code>
            --chart-1
            data-theme=&quot;light&quot;
            &quot;
          </code>
        );
      }
    `);

    expect(violations).toEqual([]);
  });
});
