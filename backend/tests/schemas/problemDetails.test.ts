import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "@fastify/type-provider-zod";
import { z } from "zod";

import { registerProblemDetailsHandler } from "../../src/errors/problemDetails.ts";
import { badRequest } from "../../src/errors/appError.ts";

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
        body: z.strictObject({
          name: z.string().min(1),
          address: z.strictObject({ city: z.string().min(1) }),
        }),
      },
    },
    async () => ({ ok: true }),
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
      payload: { name: "", address: { city: "" } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");

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
        { path: "address.city", message: expect.any(String) },
      ]),
    );
  });

  it("rejects unknown keys because DTOs are strict", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/thing",
      payload: { name: "ok", address: { city: "ok" }, extra: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().type).toBe(
      "https://restaurant-pos.app/errors/validation",
    );
  });

  it("formats a thrown AppError", async () => {
    const response = await app.inject({ method: "GET", url: "/app-error" });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toEqual({
      type: "https://restaurant-pos.app/errors/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Something is off",
      instance: "/app-error",
    });
  });

  it("formats an unexpected error as an internal problem document", async () => {
    const response = await app.inject({ method: "GET", url: "/boom" });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({
      type: "https://restaurant-pos.app/errors/internal",
      title: "Internal Server Error",
      status: 500,
      detail: "Internal Server Error",
      instance: "/boom",
    });
  });
});
