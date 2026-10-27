/// <reference types="node" />
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findStyleViolations,
  type StyleAllowlist,
  type StyleFile,
} from "../../scripts/check-styles.mjs";

const PALETTE_TOKEN = ["text", "gray", "500"].join("-");
const HEX_COLOR = ["#", "f1f4f8"].join("");
const OKLCH_COLOR = ["oklch", "(0.5 0.1 20)"].join("");
const RGB_COLOR = ["rgb", "(255, 255, 255)"].join("");
const HSL_COLOR = ["hsl", "(0 0% 100%)"].join("");
const ARBITRARY_VALUE = ["w", "[123px]"].join("-");
const NEGATIVE_ARBITRARY_VALUE = ["-mt", "[2px]"].join("-");
const ARBITRARY_COLOUR_CLASS = ["bg", `[${HEX_COLOR}]`].join("-");

const EMPTY_ALLOWLIST: StyleAllowlist = { colors: [], arbitraryValues: [] };

function styleFile(path: string, content: string): StyleFile {
  return { path, content };
}

function collectFiles(root: string): StyleFile[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    if (![".ts", ".tsx", ".css"].includes(extname(entry.name))) return [];
    return [
      {
        path: relative(process.cwd(), fullPath).split(sep).join("/"),
        content: readFileSync(fullPath, "utf8"),
      },
    ];
  });
}

const tempDirectories: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "style-guard-"));
  tempDirectories.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "style-allowlist.json"),
    JSON.stringify(EMPTY_ALLOWLIST),
  );
  return root;
}

function runCli(root: string) {
  const scriptPath = resolve(process.cwd(), "scripts/check-styles.mjs");
  return spawnSync(process.execPath, [scriptPath, root], {
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("findStyleViolations", () => {
  it("reports raw palette utilities in production files", () => {
    const violations = findStyleViolations(
      [
        styleFile(
          "src/components/Example.tsx",
          `const className = "${PALETTE_TOKEN}";`,
        ),
      ],
      EMPTY_ALLOWLIST,
    );

    expect(violations).toEqual([
      expect.objectContaining({
        path: "src/components/Example.tsx",
        kind: "raw-palette",
        category: "colors",
        line: 1,
        token: PALETTE_TOKEN,
      }),
    ]);
  });

  it("reports raw colour literals in source files", () => {
    const violations = findStyleViolations(
      [
        styleFile(
          "src/components/Example.tsx",
          [
            `const hex = "${HEX_COLOR}";`,
            `const oklch = "${OKLCH_COLOR}";`,
            `const rgb = "${RGB_COLOR}";`,
            `const hsl = "${HSL_COLOR}";`,
          ].join("\n"),
        ),
      ],
      EMPTY_ALLOWLIST,
    );

    expect(violations.map((violation) => violation.kind)).toEqual([
      "raw-colour",
      "raw-colour",
      "raw-colour",
      "raw-colour",
    ]);
    expect(violations.every((violation) => violation.category === "colors")).toBe(
      true,
    );
  });

  it("reports arbitrary values in production files", () => {
    const violations = findStyleViolations(
      [
        styleFile(
          "src/components/Example.tsx",
          `const className = "${ARBITRARY_VALUE} ${NEGATIVE_ARBITRARY_VALUE}";`,
        ),
      ],
      EMPTY_ALLOWLIST,
    );

    expect(violations).toEqual([
      expect.objectContaining({
        path: "src/components/Example.tsx",
        kind: "arbitrary-value",
        category: "arbitraryValues",
        token: ARBITRARY_VALUE,
      }),
      expect.objectContaining({
        kind: "arbitrary-value",
        category: "arbitraryValues",
        token: NEGATIVE_ARBITRARY_VALUE,
      }),
    ]);
  });

  it("reports arbitrary colour classes once as raw colours", () => {
    const violations = findStyleViolations(
      [
        styleFile(
          "src/components/Example.tsx",
          `const className = "${ARBITRARY_COLOUR_CLASS}";`,
        ),
      ],
      EMPTY_ALLOWLIST,
    );

    expect(violations).toEqual([
      expect.objectContaining({
        kind: "raw-colour",
        category: "colors",
        token: HEX_COLOR,
      }),
    ]);
  });

  it("reports CSS colour literals and arbitrary values outside src/styles", () => {
    const violations = findStyleViolations(
      [
        styleFile(
          "src/theme/legacy.css",
          `.bad { color: ${HEX_COLOR}; }\n.legacy { @apply ${ARBITRARY_VALUE}; }`,
        ),
      ],
      EMPTY_ALLOWLIST,
    );

    expect(violations.map((violation) => violation.kind)).toEqual([
      "raw-colour",
      "arbitrary-value",
    ]);
  });

  it("ignores class-like text in source comments", () => {
    const violations = findStyleViolations(
      [
        styleFile(
          "src/components/Example.tsx",
          `// ${PALETTE_TOKEN}\nconst className = "bg-background";`,
        ),
      ],
      EMPTY_ALLOWLIST,
    );

    expect(violations).toEqual([]);
  });

  it("scans test files as well as production files", () => {
    const violations = findStyleViolations(
      [
        styleFile(
          "src/components/__tests__/Example.test.tsx",
          `const className = "${PALETTE_TOKEN}";`,
        ),
      ],
      EMPTY_ALLOWLIST,
    );

    expect(violations).toHaveLength(1);
  });

  it("allows raw values under src/styles", () => {
    const violations = findStyleViolations(
      [
        styleFile(
          "src/styles/tokens.css",
          `:root { --palette: ${HEX_COLOR}; } .size { width: ${ARBITRARY_VALUE}; }`,
        ),
        styleFile(
          "src/styles/__tests__/guardFixture.tsx",
          `const className = "${PALETTE_TOKEN} ${ARBITRARY_VALUE}";`,
        ),
      ],
      EMPTY_ALLOWLIST,
    );

    expect(violations).toEqual([]);
  });

  it("allows arbitrary sizes under src/components/ui but still reports colours", () => {
    const violations = findStyleViolations(
      [
        styleFile(
          "src/components/ui/example.tsx",
          `const className = "${ARBITRARY_VALUE}";`,
        ),
        styleFile(
          "src/components/ui/colour-example.tsx",
          `const colour = "${HEX_COLOR}";`,
        ),
      ],
      EMPTY_ALLOWLIST,
    );

    expect(violations).toEqual([
      expect.objectContaining({
        path: "src/components/ui/colour-example.tsx",
        kind: "raw-colour",
        category: "colors",
      }),
    ]);
  });

  it("suppresses violations through both allowlist arrays", () => {
    const files = [
      styleFile(
        "src/components/Example.tsx",
        `const className = "${PALETTE_TOKEN} ${ARBITRARY_VALUE}";`,
      ),
    ];

    expect(
      findStyleViolations(files, {
        colors: ["src/components/**"],
        arbitraryValues: ["src/components/**"],
      }),
    ).toEqual([]);
  });

  it("does not suppress violations with an empty allowlist", () => {
    const files = [
      styleFile(
        "src/components/Example.tsx",
        `const className = "${PALETTE_TOKEN} ${ARBITRARY_VALUE}";`,
      ),
    ];

    expect(findStyleViolations(files, EMPTY_ALLOWLIST)).toHaveLength(2);
  });

  it("suppresses only the matched allowlist category", () => {
    const files = [
      styleFile(
        "src/components/Example.tsx",
        `const className = "${PALETTE_TOKEN} ${ARBITRARY_VALUE}";`,
      ),
    ];

    const violations = findStyleViolations(files, {
      colors: ["src/components/**"],
      arbitraryValues: [],
    });

    expect(violations).toEqual([
      expect.objectContaining({ category: "arbitraryValues" }),
    ]);
  });
});

describe("style guard over frontend/src", () => {
  it("reports no violations after allowlist suppression", () => {
    const files = collectFiles(resolve(process.cwd(), "src"));
    const allowlist = JSON.parse(
      readFileSync(resolve(process.cwd(), "style-allowlist.json"), "utf8"),
    ) as StyleAllowlist;

    expect(findStyleViolations(files, allowlist)).toEqual([]);
  });
});

describe("style guard CLI", () => {
  it("exits non-zero on violations and zero when clean", () => {
    const root = makeTempRoot();
    const filePath = join(root, "src", "Example.tsx");
    writeFileSync(filePath, `const className = "${PALETTE_TOKEN}";`);

    const failing = runCli(root);
    expect(failing.status).toBe(1);
    expect(failing.stderr).toContain("Example.tsx");

    writeFileSync(filePath, 'const className = "bg-background";');

    expect(runCli(root).status).toBe(0);
  });
});
