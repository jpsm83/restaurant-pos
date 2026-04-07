import { describe, expect, it } from "vitest";
import {
  ServiceRequestError,
  toServiceRequestError,
  type ServiceErrorDefaults,
} from "../serviceErrors";

const defaults: ServiceErrorDefaults = {
  fallback: "Fallback message",
  byStatus: {
    401: "Please sign in",
  },
};

describe("toServiceRequestError", () => {
  it("maps axios-like errors and prefers body message", () => {
    const error = {
      isAxiosError: true,
      message: "Axios failed",
      response: {
        status: 401,
        data: { message: "Server says no" },
      },
    };

    const mapped = toServiceRequestError(error, defaults);
    expect(mapped).toBeInstanceOf(ServiceRequestError);
    expect(mapped.status).toBe(401);
    expect(mapped.message).toBe("Server says no");
  });

  it("uses status mapping when body message is absent", () => {
    const error = {
      isAxiosError: true,
      message: "Axios failed",
      response: { status: 401, data: {} },
    };

    const mapped = toServiceRequestError(error, defaults);
    expect(mapped.status).toBe(401);
    expect(mapped.message).toBe("Please sign in");
  });

  it("maps native Error instances", () => {
    const mapped = toServiceRequestError(new Error("Boom"), defaults);
    expect(mapped.status).toBeUndefined();
    expect(mapped.message).toBe("Boom");
  });

  it("falls back for unknown error shapes", () => {
    const mapped = toServiceRequestError("unexpected", defaults);
    expect(mapped.status).toBeUndefined();
    expect(mapped.message).toBe("Fallback message");
  });
});
