import { describe, expect, it } from "vitest";
import {
  deriveServiceErrorOutcome,
  extractProblemDetails,
  makeServiceErrorCode,
  ServiceRequestError,
  toServiceRequestError,
  toServiceRequestErrorFromResponse,
  toServiceTransportError,
  type ServiceOperation,
} from "../serviceErrors";

function axiosProblem(input: {
  status?: number;
  body?: unknown;
  message?: string;
}) {
  return {
    isAxiosError: true,
    message: input.message ?? "Request failed",
    response:
      input.status === undefined
        ? undefined
        : { status: input.status, data: input.body },
  };
}

describe("toServiceRequestError", () => {
  it("maps a validation problem to a machine code, field diagnostics, and status", () => {
    const mapped = toServiceRequestError(
      axiosProblem({
        status: 400,
        body: {
          type: "https://restaurant-pos.app/errors/validation",
          title: "Bad Request",
          status: 400,
          detail: "Request validation failed",
          errors: [
            { path: "email", message: "Required" },
            { field: "address.city", message: "Invalid" },
          ],
        },
      }),
      "businessUpdate",
    );

    expect(mapped).toBeInstanceOf(ServiceRequestError);
    expect(mapped).toMatchObject({
      code: "businessUpdate.validation",
      status: 400,
      serverMessage: "Request validation failed",
      fieldErrors: [
        { field: "email", message: "Required" },
        { field: "address.city", message: "Invalid" },
      ],
    });
  });

  it("uses problem type over status when both are present", () => {
    const mapped = toServiceRequestErrorFromResponse(
      "businessUpdate",
      400,
      {
        type: "https://restaurant-pos.app/errors/conflict",
        detail: "Duplicate tax number",
      },
    );

    expect(mapped.code).toBe("businessUpdate.conflict");
    expect(mapped.serverMessage).toBe("Duplicate tax number");
  });

  it.each([
    [400, "businessFetch.badRequest"],
    [401, "businessFetch.unauthorized"],
    [403, "businessFetch.forbidden"],
    [404, "businessFetch.notFound"],
    [409, "businessFetch.conflict"],
    [500, "businessFetch.internal"],
    [503, "businessFetch.internal"],
  ])("maps status %i to %s when no problem type is present", (status, code) => {
    const mapped = toServiceRequestErrorFromResponse("businessFetch", status, {
      title: "Error",
    });

    expect(mapped.code).toBe(code);
  });

  it("treats a 400 with field errors as validation", () => {
    const mapped = toServiceRequestErrorFromResponse("signUp", 400, {
      title: "Bad Request",
      errors: [{ path: "email", message: "Invalid email" }],
    });

    expect(mapped.code).toBe("signUp.validation");
    expect(mapped.fieldErrors).toEqual([
      { field: "email", message: "Invalid email" },
    ]);
    expect(mapped.serverMessage).toBe("Invalid email");
  });

  it("keeps operation context when the status is shared", () => {
    const signIn = toServiceRequestErrorFromResponse("signIn", 401, {
      message: "Invalid credentials",
    });
    const modeLoad = toServiceRequestErrorFromResponse("modeLoad", 401, {
      message: "Invalid credentials",
    });

    expect(signIn.code).toBe("signIn.unauthorized");
    expect(modeLoad.code).toBe("modeLoad.unauthorized");
    expect(signIn.code).not.toBe(modeLoad.code);
  });

  it("reads a legacy { message } body without treating it as primary copy", () => {
    const mapped = toServiceRequestErrorFromResponse("signIn", 401, {
      message: "Invalid email or password",
    });

    expect(mapped.code).toBe("signIn.unauthorized");
    expect(mapped.status).toBe(401);
    expect(mapped.serverMessage).toBe("Invalid email or password");
    expect(mapped.fieldErrors).toEqual([]);
  });

  it("maps a network failure to a transport code and keeps diagnostics", () => {
    const mapped = toServiceRequestError(
      axiosProblem({ message: "Network Error" }),
      "scheduleLoad",
    );

    expect(mapped.code).toBe("scheduleLoad.transport");
    expect(mapped.status).toBeUndefined();
    expect(mapped.serverMessage).toBe("Network Error");
  });

  it("maps native errors to transport failures and preserves the message", () => {
    const mapped = toServiceRequestError(new Error("Boom"), "tableConfigSave");

    expect(mapped.code).toBe("tableConfigSave.transport");
    expect(mapped.serverMessage).toBe("Boom");
    expect(mapped.status).toBeUndefined();
  });

  it("does not re-wrap an existing machine failure", () => {
    const original = toServiceRequestErrorFromResponse("modeSave", 403, {
      detail: "Not allowed",
    });

    expect(toServiceRequestError(original, "businessFetch")).toBe(original);
  });

  it("falls back for unknown error shapes", () => {
    const mapped = toServiceRequestError("unexpected", "modeLoad");

    expect(mapped.code).toBe("modeLoad.transport");
    expect(mapped.status).toBeUndefined();
    expect(mapped.serverMessage).toBeUndefined();
  });
});

describe("deriveServiceErrorOutcome", () => {
  it("maps documented problem type segments", () => {
    const types = [
      ["validation", "validation"],
      ["bad-request", "badRequest"],
      ["unauthorized", "unauthorized"],
      ["forbidden", "forbidden"],
      ["not-found", "notFound"],
      ["conflict", "conflict"],
      ["internal", "internal"],
    ] as const;

    for (const [segment, outcome] of types) {
      expect(
        deriveServiceErrorOutcome({
          type: `https://restaurant-pos.app/errors/${segment}`,
          status: 400,
        }),
      ).toBe(outcome);
    }
  });

  it("maps 422 to validation and unknown 4xx to bad request", () => {
    expect(deriveServiceErrorOutcome({ status: 422 })).toBe("validation");
    expect(deriveServiceErrorOutcome({ status: 429 })).toBe("badRequest");
    expect(deriveServiceErrorOutcome({ status: 418 })).toBe("badRequest");
  });

  it("maps missing status to transport", () => {
    expect(deriveServiceErrorOutcome({})).toBe("transport");
  });
});

describe("makeServiceErrorCode", () => {
  it("joins operation and outcome into a stable code", () => {
    const operation: ServiceOperation = "confirmEmail";
    expect(makeServiceErrorCode(operation, "notFound")).toBe(
      "confirmEmail.notFound",
    );
  });
});

describe("extractProblemDetails", () => {
  it("prefers a non-empty detail and keeps field diagnostics", () => {
    expect(
      extractProblemDetails({
        detail: "Invalid request",
        errors: [{ path: "email", message: "Required" }],
      }),
    ).toEqual({
      type: undefined,
      serverMessage: "Invalid request",
      fieldErrors: [{ field: "email", message: "Required" }],
    });
  });

  it("reads legacy message bodies as diagnostic server messages", () => {
    expect(extractProblemDetails({ message: "Too many requests" })).toEqual({
      type: undefined,
      serverMessage: "Too many requests",
      fieldErrors: [],
    });
  });

  it("ignores non-string details and blank ones", () => {
    expect(extractProblemDetails({ detail: 42 }).serverMessage).toBeUndefined();
    expect(extractProblemDetails({ detail: "   " }).serverMessage).toBeUndefined();
  });

  it("returns empty diagnostics for non-objects and empty bodies", () => {
    expect(extractProblemDetails(null)).toEqual({
      type: undefined,
      serverMessage: undefined,
      fieldErrors: [],
    });
    expect(extractProblemDetails("detail")).toEqual({
      type: undefined,
      serverMessage: undefined,
      fieldErrors: [],
    });
    expect(extractProblemDetails({})).toEqual({
      type: undefined,
      serverMessage: undefined,
      fieldErrors: [],
    });
  });
});

describe("extractProblemDetails field diagnostics", () => {
  it("joins usable errors[] messages when detail is absent", () => {
    expect(
      extractProblemDetails({
        errors: [
          { path: "a", message: "First" },
          { path: "b" },
          { path: "c", message: "  " },
          { path: "d", message: "Second" },
        ],
      }),
    ).toEqual({
      type: undefined,
      serverMessage: "First; Second",
      fieldErrors: [
        { field: "a", message: "First" },
        { field: "d", message: "Second" },
      ],
    });
  });
});

describe("toServiceTransportError", () => {
  it("returns a transport failure with optional diagnostics", () => {
    const mapped = toServiceTransportError("session", new TypeError("Offline"));

    expect(mapped.code).toBe("session.transport");
    expect(mapped.serverMessage).toBe("Offline");
    expect(mapped.status).toBeUndefined();
  });
});
