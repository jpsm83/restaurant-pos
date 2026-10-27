import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
} from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "@fastify/type-provider-zod";
import { z } from "zod";

import { registerProblemDetailsHandler } from "../../src/errors/problemDetails.ts";
import {
  buildFailureReportContext,
  type FailureReporter,
  type FailureReportContext,
} from "../../src/errors/failureReporting.ts";
import {
  badRequest,
  internal,
  notFound,
} from "../../src/errors/appError.ts";

interface CapturedReport {
  error: unknown;
  context: FailureReportContext;
}

const unexpectedError = new Error("kaboom");
const internalError = internal("database unavailable");
const validationBodySchema = z.strictObject({
  name: z.string().min(1),
});
const validationQuerySchema = z.strictObject({
  limit: z.coerce.number().int().positive(),
});
const validationParamsSchema = z.strictObject({
  thingId: z.string().uuid(),
});

let app: FastifyInstance;
let reports: CapturedReport[];
let reporterFailure: Error | null;

const reporter: FailureReporter = {
  report(error, context) {
    if (reporterFailure) {
      throw reporterFailure;
    }
    reports.push({ error, context });
  },
};

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerProblemDetailsHandler(app, { failureReporter: reporter });

  app.post("/orders/:orderId/boom", async () => {
    throw unexpectedError;
  });

  app.get("/session/boom", async (request) => {
    request.authSession = {
      id: "user-1",
      email: "guest@example.com",
      type: "user",
      employeeId: "employee-1",
      businessId: "business-1",
      role: "Manager",
    };
    throw unexpectedError;
  });

  app.get("/internal-error", async () => {
    throw internalError;
  });

  app.get("/bad-request", async () => {
    throw badRequest("Nope");
  });

  app.get("/missing", async () => {
    throw notFound("Missing");
  });

  app.post(
    "/validated-body",
    { schema: { body: validationBodySchema } },
    async (request) => request.body,
  );

  app.get(
    "/validated-query",
    { schema: { querystring: validationQuerySchema } },
    async (request) => request.query,
  );

  app.get(
    "/validated-params/:thingId",
    { schema: { params: validationParamsSchema } },
    async (request) => request.params,
  );

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  reports = [];
  reporterFailure = null;
});

describe("problem-details failure reporting", () => {
  it("reports an unexpected error once with a safe context and keeps the opaque 500 response", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/orders/order-1/boom?token=query-secret&email=guest@example.com",
      headers: {
        authorization: "Bearer header-secret",
        cookie: "refresh= cookie-secret",
        "x-forwarded-for": "203.0.113.7",
      },
      payload: {
        email: "guest@example.com",
        password: "body-secret",
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toEqual({
      type: "https://restaurant-pos.app/errors/internal",
      title: "Internal Server Error",
      status: 500,
      detail: "Internal Server Error",
      instance:
        "/orders/order-1/boom?token=query-secret&email=guest@example.com",
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].error).toBe(unexpectedError);
    expect(reports[0].context).toEqual({
      method: "POST",
      route: "/orders/:orderId/boom",
      status: 500,
    });

    const serializedContext = JSON.stringify(reports[0].context);
    for (const secret of [
      "query-secret",
      "header-secret",
      "cookie-secret",
      "body-secret",
      "guest@example.com",
      "203.0.113.7",
      "authorization",
      "cookie",
      "password",
      "email",
      "token",
    ]) {
      expect(serializedContext).not.toContain(secret);
    }
  });

  it("reports only safe authenticated session identifiers", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/session/boom",
    });

    expect(response.statusCode).toBe(500);
    expect(reports).toHaveLength(1);
    expect(reports[0].context).toEqual({
      method: "GET",
      route: "/session/boom",
      status: 500,
      session: {
        type: "user",
        id: "user-1",
        employeeId: "employee-1",
        businessId: "business-1",
      },
    });
    expect(JSON.stringify(reports[0].context)).not.toContain(
      "guest@example.com",
    );
  });

  it("reports a thrown internal AppError", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/internal-error",
    });

    expect(response.statusCode).toBe(500);
    expect(reports).toHaveLength(1);
    expect(reports[0].error).toBe(internalError);
    expect(reports[0].context.status).toBe(500);
  });

  it("does not report validation failures, 4xx AppErrors, or not-found responses", async () => {
    const responses = await Promise.all([
      app.inject({
        method: "POST",
        url: "/validated-body",
        payload: { name: "" },
      }),
      app.inject({ method: "GET", url: "/validated-query?limit=nope" }),
      app.inject({ method: "GET", url: "/validated-params/not-a-uuid" }),
      app.inject({ method: "GET", url: "/bad-request" }),
      app.inject({ method: "GET", url: "/missing" }),
      app.inject({ method: "GET", url: "/no-such-route" }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBeLessThan(500);
    }
    expect(reports).toHaveLength(0);
  });

  it("falls back to a route path without its query string", () => {
    const context = buildFailureReportContext(
      {
        method: "GET",
        url: "/api/raw?token=query-secret",
        routeOptions: {},
      } as unknown as FastifyRequest,
      500,
    );

    expect(context).toEqual({
      method: "GET",
      route: "/api/raw",
      status: 500,
    });
  });

  it("leaves the response unchanged when the reporter throws", async () => {
    reporterFailure = new Error("reporter exploded");

    const response = await app.inject({
      method: "POST",
      url: "/orders/order-1/boom",
      payload: { email: "guest@example.com" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toEqual({
      type: "https://restaurant-pos.app/errors/internal",
      title: "Internal Server Error",
      status: 500,
      detail: "Internal Server Error",
      instance: "/orders/order-1/boom",
    });
  });
});
