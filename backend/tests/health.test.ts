/**
 * Health check test - verifies test setup is working
 */

import { describe, it, expect } from "vitest";
import { getTestApp } from "./helpers/index.ts";
import { isProblemDetails } from "./helpers/problemDetails.ts";

describe("Health Check", () => {
  it("GET /health returns ok", async () => {
    const app = await getTestApp();
    
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("ignores a stray query and stays without a request DTO", async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/health?paymentId=pay-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("returns problem details for an unmatched route", async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/does-not-exist",
    });

    expect(response.statusCode).toBe(404);
    expect(isProblemDetails(response)).toBe(true);
    const body = response.json();
    expect(body.type).toBe("https://restaurant-pos.app/errors/not-found");
    expect(body.status).toBe(404);
  });
});
