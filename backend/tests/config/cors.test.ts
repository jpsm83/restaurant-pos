import { describe, expect, it } from "vitest";
import type { FastifyCorsOptions, OriginFunction } from "@fastify/cors";
import { buildCorsOptions } from "../../src/config/cors.ts";

function evaluateOrigin(
  options: FastifyCorsOptions,
  origin: string | undefined,
): Promise<boolean> {
  const resolver = options.origin as OriginFunction;
  return new Promise((resolve, reject) => {
    resolver(origin, (err, value) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Boolean(value));
    });
  });
}

describe("buildCorsOptions", () => {
  it("allows explicit origins when CORS_ORIGINS is set", async () => {
    const options = buildCorsOptions({
      CORS_ORIGINS: "https://app.example.com,https://admin.example.com",
      NODE_ENV: "production",
    });

    await expect(
      evaluateOrigin(options, "https://app.example.com"),
    ).resolves.toBe(true);
    await expect(
      evaluateOrigin(options, "https://evil.example.com"),
    ).resolves.toBe(false);
  });

  it("allows localhost origins in non-production when list is empty", async () => {
    const options = buildCorsOptions({
      NODE_ENV: "development",
    });

    await expect(
      evaluateOrigin(options, "http://localhost:5173"),
    ).resolves.toBe(true);
    await expect(
      evaluateOrigin(options, "https://127.0.0.1:4173"),
    ).resolves.toBe(true);
    await expect(
      evaluateOrigin(options, "https://example.com"),
    ).resolves.toBe(false);
  });

  it("denies cross-origin in production when list is empty", async () => {
    const options = buildCorsOptions({
      NODE_ENV: "production",
    });

    await expect(
      evaluateOrigin(options, "http://localhost:5173"),
    ).resolves.toBe(false);
  });

  it("allows requests without origin header", async () => {
    const options = buildCorsOptions({
      NODE_ENV: "production",
    });

    await expect(evaluateOrigin(options, undefined)).resolves.toBe(true);
  });
});
