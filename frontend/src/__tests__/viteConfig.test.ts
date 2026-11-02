/// <reference types="node" />
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, preview } from "vite";

const COOP_HEADER = "Cross-Origin-Opener-Policy";
const COOP_VALUE = "same-origin-allow-popups";
const projectRoot = process.cwd();
const configFile = join(projectRoot, "vite.config.ts");

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

async function servedCoopHeader(url: string | undefined): Promise<string | null> {
  expect(url).toBeDefined();
  const response = await fetch(url!);
  return response.headers.get(COOP_HEADER);
}

/**
 * Google Identity Services keeps its popup tied to the opener through
 * postMessage, and relies on the explicit COOP value. A dropped header block
 * breaks Google sign-in locally, so assert the header on real server responses.
 */
describe("vite config COOP headers", () => {
  it("serves the Google popup COOP header from the dev server", async () => {
    const server = await createServer({
      configFile,
      root: projectRoot,
      server: { port: 0, strictPort: false, hmr: false },
      logLevel: "silent",
    });

    try {
      await server.listen();
      expect(await servedCoopHeader(server.resolvedUrls?.local[0])).toBe(
        COOP_VALUE,
      );
    } finally {
      await server.close();
    }
  });

  it("serves the Google popup COOP header from the preview server", async () => {
    const root = mkdtempSync(join(tmpdir(), "coop-preview-"));
    temporaryRoots.push(root);
    mkdirSync(join(root, "dist"));
    writeFileSync(join(root, "dist", "index.html"), "<html><body>ok</body></html>");

    const server = await preview({
      configFile,
      root,
      preview: { port: 0, strictPort: false },
      logLevel: "silent",
    });

    try {
      expect(await servedCoopHeader(server.resolvedUrls?.local[0])).toBe(
        COOP_VALUE,
      );
    } finally {
      await new Promise<void>((resolve) => {
        if (!server.httpServer) return resolve();
        server.httpServer.close(() => resolve());
      });
    }
  });
});
