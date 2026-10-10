/**
 * Shared multipart helper.
 *
 * Multipart routes previously read `req.parts()` field by field and cast raw
 * strings ad hoc. This helper buffers every part once, collects files, parses
 * designated JSON-encoded fields, and validates the resulting field object
 * against a DTO — so a multipart route validates exactly like a JSON route.
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
      errors: [{ path: fieldname, message: "Invalid JSON" }],
    });
  }
};

const toFieldValue = (value: unknown): unknown => {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return value;
};

/**
 * Buffer `req.parts()`, JSON-parse the designated fields, collect files, and
 * validate the fields against `schema`. Throws an `AppError` (400) when a
 * designated field is malformed JSON or the DTO rejects the fields.
 */
export async function parseMultipart<T>(
  req: FastifyRequest,
  schema: z.ZodType<T>,
  options: ParseMultipartOptions = {},
): Promise<MultipartResult<T>> {
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

  const result = schema.safeParse(raw);
  if (!result.success) {
    const errors: ProblemFieldError[] = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError("Request body is invalid", {
      statusCode: 400,
      errors,
    });
  }

  return { fields: result.data, files };
}
