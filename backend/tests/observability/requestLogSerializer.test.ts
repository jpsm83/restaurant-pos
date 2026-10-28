import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";

import { requestLogSerializer } from "../../src/observability/requestLogSerializer.ts";

describe("requestLogSerializer", () => {
  it("drops the query string so a URL credential never reaches the log", () => {
    const request = {
      method: "GET",
      url: "/api/v1/notifications/live?ticket=super-secret-ticket&other=1",
      hostname: "api.test",
      ip: "127.0.0.1",
    } as FastifyRequest;

    expect(requestLogSerializer(request)).toEqual({
      method: "GET",
      url: "/api/v1/notifications/live",
      hostname: "api.test",
      remoteAddress: "127.0.0.1",
    });
  });
});
