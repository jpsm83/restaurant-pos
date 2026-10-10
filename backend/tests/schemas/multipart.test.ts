import { describe, it, expect } from "vitest";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { parseMultipart } from "../../src/schemas/multipart.ts";
import { AppError } from "../../src/errors/appError.ts";
import { coercedBooleanSchema, coercedIntSchema, trimmedString } from "../../../packages/schemas/index.ts";

interface FakeField {
  type: "field";
  fieldname: string;
  value: unknown;
}

interface FakeFile {
  type: "file";
  fieldname: string;
  filename: string;
  mimetype: string;
  content: string;
}

type FakePart = FakeField | FakeFile;

function fakeRequest(parts: FakePart[]): FastifyRequest {
  return {
    parts: async function* () {
      for (const part of parts) {
        if (part.type === "file") {
          yield {
            type: "file" as const,
            fieldname: part.fieldname,
            filename: part.filename,
            mimetype: part.mimetype,
            toBuffer: async () => Buffer.from(part.content),
          };
        } else {
          yield {
            type: "field" as const,
            fieldname: part.fieldname,
            value: part.value,
          };
        }
      }
    },
  } as unknown as FastifyRequest;
}

const schema = z.strictObject({
  name: trimmedString("Name is required"),
  age: coercedIntSchema,
  active: coercedBooleanSchema.optional(),
  address: z.object({ city: z.string().min(1) }),
});

describe("parseMultipart", () => {
  it("collects fields, JSON fields and files, then validates", async () => {
    const req = fakeRequest([
      { type: "field", fieldname: "name", value: "  Jane   Doe " },
      { type: "field", fieldname: "age", value: "34" },
      { type: "field", fieldname: "active", value: "false" },
      { type: "field", fieldname: "address", value: '{"city":"Lisbon"}' },
      {
        type: "file",
        fieldname: "avatar",
        filename: "a.png",
        mimetype: "image/png",
        content: "binary",
      },
    ]);

    const result = await parseMultipart(req, schema, {
      jsonFields: ["address"],
    });

    expect(result.fields).toEqual({
      name: "Jane Doe",
      age: 34,
      active: false,
      address: { city: "Lisbon" },
    });
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      fieldname: "avatar",
      filename: "a.png",
      mimetype: "image/png",
    });
    expect(result.files[0].buffer.toString()).toBe("binary");
  });

  it("collects repeated field names into an array", async () => {
    const arraySchema = z.object({ tags: z.array(z.string()) });
    const req = fakeRequest([
      { type: "field", fieldname: "tags", value: "a" },
      { type: "field", fieldname: "tags", value: "b" },
    ]);

    const result = await parseMultipart(req, arraySchema);
    expect(result.fields).toEqual({ tags: ["a", "b"] });
  });

  it("throws a 400 AppError with dotted paths when the DTO rejects fields", async () => {
    const nestedSchema = z.strictObject({
      address: z.strictObject({ city: z.string().min(1, "Required") }),
    });
    const req = fakeRequest([
      { type: "field", fieldname: "address", value: '{"city":""}' },
    ]);

    const promise = parseMultipart(req, nestedSchema, {
      jsonFields: ["address"],
    });

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await promise.catch((error: AppError) => {
      expect(error.statusCode).toBe(400);
      expect(error.errors).toEqual([
        { path: "address.city", message: "Required" },
      ]);
    });
  });

  it("throws a 400 AppError when a designated field is malformed JSON", async () => {
    const req = fakeRequest([
      { type: "field", fieldname: "address", value: "{not json" },
    ]);

    const promise = parseMultipart(req, schema, { jsonFields: ["address"] });
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await promise.catch((error: AppError) => {
      expect(error.statusCode).toBe(400);
      expect(error.errors).toEqual([
        { path: "address", message: "Invalid JSON" },
      ]);
    });
  });
});
