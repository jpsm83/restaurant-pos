import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "@fastify/type-provider-zod";
import { z } from "zod";
import {
  coercedBooleanSchema,
  coercedIntSchema,
  coercedNumberSchema,
  emailSchema,
  objectIdSchema,
  sanitizedString,
} from "restaurant-pos-packages/schemas";

import { registerProblemDetailsHandler } from "../../src/errors/problemDetails.ts";
import { badRequest } from "../../src/errors/appError.ts";

/**
 * Harness DTOs built from shared primitives — the acceptance seam for the
 * zod + problem-details rail (issues #117 / #119 / ADR-0001).
 */
const harnessBodySchema = z.strictObject({
  name: sanitizedString("Name is required"),
  email: emailSchema,
  quantity: coercedNumberSchema,
  active: coercedBooleanSchema,
  address: z.strictObject({
    city: sanitizedString("City is required"),
  }),
});

const harnessParamsSchema = z.strictObject({
  thingId: objectIdSchema,
});

const harnessQuerySchema = z.strictObject({
  q: sanitizedString("Query is required"),
  limit: coercedIntSchema.positive(),
});

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerProblemDetailsHandler(app);

  app.post(
    "/thing",
    {
      schema: {
        body: harnessBodySchema,
      },
    },
    async (request) => request.body,
  );

  app.get(
    "/thing/:thingId",
    {
      schema: {
        params: harnessParamsSchema,
      },
    },
    async (request) => request.params,
  );

  app.get(
    "/search",
    {
      schema: {
        querystring: harnessQuerySchema,
      },
    },
    async (request) => request.query,
  );

  app.get("/app-error", async () => {
    throw badRequest("Something is off");
  });

  app.get("/boom", async () => {
    throw new Error("kaboom");
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("problem-details error envelope", () => {
  it("formats provider validation failures as 400 application/problem+json", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/thing",
      payload: {
        name: "",
        email: "not-an-email",
        quantity: "x",
        active: "maybe",
        address: { city: "" },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const body = response.json();
    expect(body).toMatchObject({
      type: "https://restaurant-pos.app/errors/validation",
      title: "Bad Request",
      status: 400,
      detail: "Request body is invalid",
      instance: "/thing",
    });
    expect(body.errors).toEqual(
      expect.arrayContaining([
        { path: "name", message: expect.any(String) },
        { path: "email", message: expect.any(String) },
        { path: "quantity", message: expect.any(String) },
        { path: "active", message: expect.any(String) },
        { path: "address.city", message: expect.any(String) },
      ]),
    );
  });

  it("rejects unknown keys because DTOs are strict", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/thing",
      payload: {
        name: "ok",
        email: "ok@example.com",
        quantity: 1,
        active: true,
        address: { city: "ok" },
        extra: true,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().type).toBe(
      "https://restaurant-pos.app/errors/validation",
    );
  });

  it("formats invalid params as 400 application/problem+json like body validation", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/thing/not-an-object-id",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const body = response.json();
    expect(body).toMatchObject({
      type: "https://restaurant-pos.app/errors/validation",
      title: "Bad Request",
      status: 400,
      detail: "Request path parameters is invalid",
      instance: "/thing/not-an-object-id",
    });
    expect(body.errors).toEqual(
      expect.arrayContaining([
        { path: "thingId", message: expect.any(String) },
      ]),
    );
  });

  it("formats invalid querystring as 400 application/problem+json like body validation", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/search?q=&limit=nope",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const body = response.json();
    expect(body).toMatchObject({
      type: "https://restaurant-pos.app/errors/validation",
      title: "Bad Request",
      status: 400,
      detail: "Request query is invalid",
      instance: "/search?q=&limit=nope",
    });
    expect(body.errors).toEqual(
      expect.arrayContaining([
        { path: "q", message: expect.any(String) },
        { path: "limit", message: expect.any(String) },
      ]),
    );
  });

  it("formats a thrown AppError", async () => {
    const response = await app.inject({ method: "GET", url: "/app-error" });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toEqual({
      type: "https://restaurant-pos.app/errors/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Something is off",
      instance: "/app-error",
    });
  });

  it("formats an unexpected error as an opaque 500 with no stack leak", async () => {
    const response = await app.inject({ method: "GET", url: "/boom" });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const body = response.json();
    expect(body).toEqual({
      type: "https://restaurant-pos.app/errors/internal",
      title: "Internal Server Error",
      status: 500,
      detail: "Internal Server Error",
      instance: "/boom",
    });
    expect(body).not.toHaveProperty("stack");
    expect(JSON.stringify(body)).not.toContain("kaboom");
  });

  it("accepts a payload after shared-primitive sanitization and coercion", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/thing",
      payload: {
        name: "  <b>Cafe</b>\u0000  ",
        email: "  Foo.Bar@Example.COM ",
        quantity: "3.5",
        active: "yes",
        address: { city: "  Lisbon\u0007  " },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      name: "Cafe",
      email: "foo.bar@example.com",
      quantity: 3.5,
      active: true,
      address: { city: "Lisbon" },
    });
  });
});
