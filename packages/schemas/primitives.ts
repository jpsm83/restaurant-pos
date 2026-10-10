/**
 * Shared zod primitives for request validation and sanitization.
 *
 * This module is intentionally free of Node and Mongoose imports so the
 * frontend can reuse it for form validation. Sanitization happens here, at the
 * boundary: whitespace is collapsed, control characters and HTML markup are
 * stripped, emails are lowercased, and string form fields (multipart) are
 * coerced to their real types.
 */
import { z } from "zod";

/** Mongo ObjectId serialized as a 24-character hex string. */
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/** Every control character, including tab/newline/carriage-return. */
const ALL_CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/** Control characters except tab (\t), newline (\n) and carriage return (\r). */
const CONTROL_CHARS_KEEPING_NEWLINES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const HTML_TAGS = /<[^>]*>/g;

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ");

const stripAllControlChars = (value: string): string =>
  value.replace(ALL_CONTROL_CHARS, "");

const stripControlCharsKeepingNewlines = (value: string): string =>
  value.replace(CONTROL_CHARS_KEEPING_NEWLINES, "");

const stripHtmlMarkup = (value: string): string => value.replace(HTML_TAGS, "");

/**
 * A Mongo ObjectId. Replaces the ad-hoc `isObjectIdValid` guard at the
 * boundary; the value stays a string so the schema has no Mongoose dependency.
 */
export const objectIdSchema = z
  .string()
  .trim()
  .regex(OBJECT_ID_PATTERN, "Invalid id");

/** A normalized email: trimmed and lowercased before the format check. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Invalid email address"));

/**
 * A trimmed string with internal whitespace collapsed to single spaces.
 * Optionally enforces a non-empty message.
 */
export function trimmedString(message?: string): z.ZodString {
  const schema = z.string().trim().overwrite(collapseWhitespace);
  return message ? schema.min(1, message) : schema;
}

/**
 * A sanitized string: control characters and HTML markup are stripped,
 * then whitespace is trimmed and collapsed. Use for structured fields such as
 * names, cities and titles.
 */
export function sanitizedString(message?: string): z.ZodString {
  const schema = z
    .string()
    .overwrite(stripAllControlChars)
    .overwrite(stripHtmlMarkup)
    .trim()
    .overwrite(collapseWhitespace);
  return message ? schema.min(1, message) : schema;
}

/**
 * Free text (descriptions, comments, messages): sanitized like
 * `sanitizedString` but line breaks are preserved. Runs of spaces/tabs collapse
 * to one, and three or more newlines collapse to a blank line.
 */
export function freeTextString(message?: string): z.ZodString {
  const schema = z
    .string()
    .overwrite(stripControlCharsKeepingNewlines)
    .overwrite(stripHtmlMarkup)
    .trim()
    .overwrite((value) =>
      value.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n"),
    );
  return message ? schema.min(1, message) : schema;
}

/** A number from a string or number input (multipart-friendly). */
export const coercedNumberSchema = z.coerce.number();

/** An integer from a string or number input (multipart-friendly). */
export const coercedIntSchema = z.coerce.number().int();

const BOOLEAN_TRUE = new Set(["true", "1", "yes", "on"]);
const BOOLEAN_FALSE = new Set(["false", "0", "no", "off"]);

/**
 * A boolean from a real boolean or a string form value ("true"/"false",
 * "1"/"0", "yes"/"no", "on"/"off"). `z.coerce.boolean()` is not used because
 * `Boolean("false")` is `true`.
 */
export const coercedBooleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (BOOLEAN_TRUE.has(normalized)) return true;
    if (BOOLEAN_FALSE.has(normalized)) return false;
  }
  return value;
}, z.boolean("Expected a boolean"));

/**
 * A JSON-encoded field (typically a multipart form field): the string is
 * parsed and the result validated against `schema`. Malformed JSON reports
 * "Invalid JSON".
 */
export function jsonField<T extends z.ZodType>(schema: T) {
  return z.preprocess((value, ctx) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value.trim());
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid JSON" });
      return z.NEVER;
    }
  }, schema);
}
