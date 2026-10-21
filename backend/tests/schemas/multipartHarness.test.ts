import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import {
  serializerCompiler,
  validatorCompiler,
} from "@fastify/type-provider-zod";
import { z } from "zod";
import {
  coercedBooleanSchema,
  coercedNumberSchema,
  emailSchema,
  jsonField,
  sanitizedString,
} from "restaurant-pos-packages/schemas";

import { registerProblemDetailsHandler } from "../../src/errors/problemDetails.ts";
import { parseMultipart } from "../../src/schemas/multipart.ts";

/**
 * Harness DTO matching the production multipart pattern: shared primitives in a
 * strict object, JSON-encoded nested fields via `jsonField` (not a helper-side
 * `jsonFields` list). Domain routes call `parseMultipart(req, dto)` the same way.
 */
const harnessBodySchema = z.strictObject({
  name: sanitizedString("Name is required"),
  email: emailSchema,
  quantity: coercedNumberSchema,
  active: coercedBooleanSchema,
  address: jsonField(
    z.strictObject({
      city: sanitizedString("City is required"),
    }),
  ),
});

const multipartPayload = (fields: Record<string, string>): FormData => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }
  return form;
};

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(multipart);
  registerProblemDetailsHandler(app);

  app.post("/upload", async (request) => {
    const { fields, files } = await parseMultipart(request, harnessBodySchema);
    return { fields, fileCount: files.length };
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("multipart helper ↔ problem-details contract", () => {
  it("formats DTO validation failures as 400 application/problem+json with dotted paths", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/upload",
      payload: multipartPayload({
        name: "",
        email: "not-an-email",
        quantity: "x",
        active: "maybe",
        address: JSON.stringify({ city: "" }),
      }),
      headers: { "content-type": "multipart/form-data" },
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
      instance: "/upload",
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

  it("formats malformed JSON in a jsonField-wrapped field as 400 with a clear field path", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/upload",
      payload: multipartPayload({
        name: "Cafe",
        email: "ok@example.com",
        quantity: "1",
        active: "true",
        address: "{not json",
      }),
      headers: { "content-type": "multipart/form-data" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );

    const body = response.json();
    expect(body.type).toBe("https://restaurant-pos.app/errors/validation");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        { path: "address", message: "Invalid JSON" },
      ]),
    );
  });

  it("returns the same sanitized and coerced values a JSON DTO would", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/upload",
      payload: multipartPayload({
        name: "  <b>Cafe</b>\u0000  ",
        email: "  Foo.Bar@Example.COM ",
        quantity: "3.5",
        active: "yes",
        address: JSON.stringify({ city: "  Lisbon\u0007  " }),
      }),
      headers: { "content-type": "multipart/form-data" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      fields: {
        name: "Cafe",
        email: "foo.bar@example.com",
        quantity: 3.5,
        active: true,
        address: { city: "Lisbon" },
      },
      fileCount: 0,
    });
  });
});
