/// <reference types="node" />
// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createServer, preview, resolveConfig } from "vite";

const COOP_HEADER = "Cross-Origin-Opener-Policy";
const COOP_VALUE = "same-origin-allow-popups";
const projectRoot = process.cwd();
const configFile = join(projectRoot, "vite.config.ts");
const committedHeadersFile = join(projectRoot, "public", "_headers");

async function servedCoopHeader(url: string | undefined): Promise<string | null> {
  expect(url).toBeDefined();
  const response = await fetch(url!);
  return response.headers.get(COOP_HEADER);
}

/**
 * Vite's dev and preview servers are not the production host; assert the
 * committed artifact that ships in `dist` still carries the COOP value.
 */
describe("committed production COOP header artifact", () => {
  it("commits the COOP header for production static hosts", () => {
    const contents = readFileSync(committedHeadersFile, "utf8");

    expect(contents).toMatch(
      new RegExp(`^\\s*${COOP_HEADER}:\\s*${COOP_VALUE}\\s*$`, "m"),
    );
  });

  it("keeps the artifact in the public dir that the build copies into dist", async () => {
    const config = await resolveConfig(
      { configFile, root: projectRoot },
      "build",
    );

    expect(config.publicDir).toBe(join(projectRoot, "public"));
    expect(config.build.copyPublicDir).not.toBe(false);
    expect(existsSync(join(config.publicDir, "_headers"))).toBe(true);
  });
});

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

    try {
      mkdirSync(join(root, "dist"));
      writeFileSync(
        join(root, "dist", "index.html"),
        "<html><body>ok</body></html>",
      );

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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
