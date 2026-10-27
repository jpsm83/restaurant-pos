import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18N_STORAGE_KEY } from "../config";

const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

afterEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("i18n initialization", () => {
  it("keeps the static HTML language and brand title as fallbacks", () => {
    expect(indexHtml).toContain('<html lang="en">');
    expect(indexHtml).toContain("<title>Project Imperium</title>");
    expect(indexHtml).not.toContain("<title>frontend</title>");
  });

  it("applies a supported stored language on init", async () => {
    localStorage.setItem(I18N_STORAGE_KEY, "es");

    await import("../i18n");

    expect(document.documentElement.lang).toBe("es");
  });

  it("falls back from an unsupported stored value before touching the document", async () => {
    localStorage.setItem(I18N_STORAGE_KEY, "pt-BR");
    document.documentElement.lang = "en";

    await import("../i18n");

    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.lang).not.toBe("pt-BR");
  });
});
