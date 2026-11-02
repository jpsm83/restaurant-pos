/// <reference types="node" />
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfigFromFile } from "vite";

const COOP_HEADER = "Cross-Origin-Opener-Policy";
const COOP_VALUE = "same-origin-allow-popups";

async function resolveViteConfig() {
  const root = process.cwd();
  const result = await loadConfigFromFile(
    { command: "serve", mode: "test" },
    resolve(root, "vite.config.ts"),
    root,
    "silent",
  );

  if (!result) throw new Error("Vite config could not be loaded");

  return result.config;
}

/**
 * Google Identity Services keeps its popup tied to the opener through
 * postMessage, and relies on the explicit COOP value. A dropped header block
 * breaks Google sign-in locally, so lock both servers down here.
 */
describe("vite config COOP headers", () => {
  it("serves the Google popup COOP header from the dev server", async () => {
    const config = await resolveViteConfig();

    expect(config.server?.headers).toMatchObject({
      [COOP_HEADER]: COOP_VALUE,
    });
  });

  it("serves the Google popup COOP header from the preview server", async () => {
    const config = await resolveViteConfig();

    expect(config.preview?.headers).toMatchObject({
      [COOP_HEADER]: COOP_VALUE,
    });
  });
});
