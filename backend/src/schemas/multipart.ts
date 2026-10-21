/**
 * Shared multipart helper (backend-only — not exported from the packages
 * schemas workspace).
 *
 * Buffers `req.parts()` once, collects files, optionally JSON-parses fields
 * named in `options.jsonFields`, and validates the resulting field object
 * against a strict DTO via `validateFields`. Failures raise a 400 `AppError`
 * with slug `validation` and dotted `errors[].path`, so the global
 * problem-details handler emits the same envelope as JSON body validation.
 *
 * Production routes pass a packages DTO that wraps nested objects with
 * `jsonField` (e.g. `address: jsonField(addressSchema)`) and call
 * `parseMultipart(req, dto)` with no `jsonFields` option — files are collected
 * here; field parsing and coercion stay in the shared schema.
 */
import type { FastifyRequest } from "fastify";
import type { z } from "zod";

import { AppError, type ProblemFieldError } from "../errors/appError.ts";

export interface MultipartFile {
  fieldname: string;
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

export interface MultipartResult<T> {
  /** The field object after validation (coercion/transform applied). */
  fields: T;
  /** Every uploaded file, in the order received. */
  files: MultipartFile[];
}

export interface ParseMultipartOptions {
  /** Field names whose string value must be JSON-parsed before validation. */
  jsonFields?: readonly string[];
}

const appendField = (
  target: Record<string, unknown>,
  fieldname: string,
  value: unknown,
): void => {
  if (!(fieldname in target)) {
    target[fieldname] = value;
    return;
  }
  const existing = target[fieldname];
  if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    target[fieldname] = [existing, value];
  }
};

const parseJsonField = (fieldname: string, value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value.trim());
  } catch {
    throw new AppError(`Invalid JSON in "${fieldname}"`, {
      statusCode: 400,
      slug: "validation",
      errors: [{ path: fieldname, message: "Invalid JSON" }],
    });
  }
};

const toFieldValue = (value: unknown): unknown => {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return value;
};

/**
 * Validate a plain field object against a DTO, raising a `400` `AppError` with
 * dotted field paths when it fails. Multipart fields and — for the routes that
 * accept both transports — a parsed JSON body go through the same check, so
 * both produce the same problem-details document.
 */
export function validateFields<T>(raw: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const errors: ProblemFieldError[] = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError("Request body is invalid", {
      statusCode: 400,
      slug: "validation",
      errors,
    });
  }
  return result.data;
}

/**
 * Buffer `req.parts()`, JSON-parse the designated fields, collect files, and
 * validate the fields against `schema`. Throws an `AppError` (400) when the
 * request is not multipart, a designated field is malformed JSON, or the DTO
 * rejects the fields.
 */
export async function parseMultipart<T>(
  req: FastifyRequest,
  schema: z.ZodType<T>,
  options: ParseMultipartOptions = {},
): Promise<MultipartResult<T>> {
  if (typeof req.parts !== "function") {
    throw new AppError("Expected multipart/form-data", { statusCode: 400 });
  }

  const jsonFields = new Set(options.jsonFields ?? []);
  const raw: Record<string, unknown> = {};
  const files: MultipartFile[] = [];

  for await (const part of req.parts()) {
    if (part.type === "file") {
      files.push({
        fieldname: part.fieldname,
        filename: part.filename,
        mimetype: part.mimetype,
        buffer: await part.toBuffer(),
      });
      continue;
    }

    const value = toFieldValue(part.value);
    appendField(
      raw,
      part.fieldname,
      jsonFields.has(part.fieldname)
        ? parseJsonField(part.fieldname, value)
        : value,
    );
  }

  return { fields: validateFields(raw, schema), files };
}
