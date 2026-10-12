import { describe, expect, it } from "vitest";
import {
  extractProblemDetailsMessage,
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
  it("reads the RFC 9457 detail from an axios-like error", () => {
    const error = {
      isAxiosError: true,
      message: "Axios failed",
      response: {
        status: 409,
        data: {
          type: "https://restaurant-pos.app/errors/conflict",
          title: "Conflict",
          status: 409,
          detail: "A business with the same tax number already exists",
          instance: "/api/v1/business",
        },
      },
    };

    const mapped = toServiceRequestError(error, defaults);
    expect(mapped).toBeInstanceOf(ServiceRequestError);
    expect(mapped.status).toBe(409);
    expect(mapped.message).toBe(
      "A business with the same tax number already exists",
    );
  });

  it("joins errors[] messages when detail is absent", () => {
    const error = {
      isAxiosError: true,
      message: "Axios failed",
      response: {
        status: 400,
        data: {
          type: "https://restaurant-pos.app/errors/validation",
          title: "Bad Request",
          status: 400,
          errors: [
            { path: "email", message: "Required" },
            { path: "address.city", message: "Invalid" },
          ],
        },
      },
    };

    const mapped = toServiceRequestError(error, defaults);
    expect(mapped.status).toBe(400);
    expect(mapped.message).toBe("Required; Invalid");
  });

  it("uses status mapping when the problem body has no detail", () => {
    const error = {
      isAxiosError: true,
      message: "Axios failed",
      response: { status: 401, data: { title: "Unauthorized" } },
    };

    const mapped = toServiceRequestError(error, defaults);
    expect(mapped.status).toBe(401);
    expect(mapped.message).toBe("Please sign in");
  });

  it("falls back when an axios error has no response (network)", () => {
    const error = {
      isAxiosError: true,
      message: "Network Error",
    };

    const mapped = toServiceRequestError(error, defaults);
    expect(mapped.status).toBeUndefined();
    expect(mapped.message).toBe("Fallback message");
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

describe("extractProblemDetailsMessage", () => {
  it("prefers a non-empty detail", () => {
    expect(
      extractProblemDetailsMessage({
        detail: "Invalid request",
        errors: [{ message: "ignored" }],
      }),
    ).toBe("Invalid request");
  });

  it("ignores non-string details and blank ones", () => {
    expect(extractProblemDetailsMessage({ detail: 42 })).toBeNull();
    expect(extractProblemDetailsMessage({ detail: "   " })).toBeNull();
  });

  it("joins usable errors[] messages", () => {
    expect(
      extractProblemDetailsMessage({
        errors: [
          { path: "a", message: "First" },
          { path: "b" },
          { path: "c", message: "  " },
          { path: "d", message: "Second" },
        ],
      }),
    ).toBe("First; Second");
  });

  it("returns null for non-objects and empty bodies", () => {
    expect(extractProblemDetailsMessage(null)).toBeNull();
    expect(extractProblemDetailsMessage("detail")).toBeNull();
    expect(extractProblemDetailsMessage({})).toBeNull();
  });
});
