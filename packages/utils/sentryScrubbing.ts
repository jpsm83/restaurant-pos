/**
 * Pure, dependency-free scrubbing for telemetry payloads.
 *
 * This is the shared seam both Sentry SDKs are designed to apply to their final
 * event before send. It never mutates its input and never touches the network.
 */

/** The single marker used for every value hidden by a sensitive key. */
export const REDACTION_MARKER = "[REDACTED]";

/** Marker used when a circular reference is encountered. */
export const CIRCULAR_REFERENCE_MARKER = "[Circular]";

/** Marker used when a payload is nested deeper than the traversal limit. */
export const DEPTH_LIMIT_MARKER = "[Truncated]";

/** Deep enough for Sentry contexts while keeping traversal bounded. */
export const MAX_SCRUB_DEPTH = 20;

const SENSITIVE_SEGMENTS = new Set([
  "password",
  "passwd",
  "pwd",
  "passphrase",
  "secret",
  "token",
  "authorization",
  "cookie",
  "refresh",
  "credentials",
  "card",
  "cvv",
  "cvc",
  "ccv",
  "cvv2",
  "cvc2",
  "iban",
  "bic",
  "swift",
  "pan",
  "pin",
]);

const SENSITIVE_JOINED_KEYS = new Set([
  "auth",
  "apikey",
  "accesskey",
  "privatekey",
  "secretkey",
  "cardnumber",
  "cardno",
  "creditcard",
  "debitcard",
  "paymentcard",
  "securitycode",
  "accountnumber",
  "routingnumber",
  "sortcode",
  "bankaccount",
  "expirydate",
  "expirationdate",
]);

const SENSITIVE_KEY_PHRASES = [
  ["api", "key"],
  ["access", "key"],
  ["private", "key"],
  ["secret", "key"],
  ["signing", "key"],
  ["encryption", "key"],
  ["card", "number"],
  ["card", "no"],
  ["card", "cvv"],
  ["card", "cvc"],
  ["card", "expiry"],
  ["card", "expiration"],
  ["card", "exp"],
  ["card", "security", "code"],
  ["credit", "card"],
  ["debit", "card"],
  ["payment", "card"],
  ["payment", "method"],
  ["payment", "details"],
  ["payment", "account"],
  ["account", "number"],
  ["bank", "account"],
  ["routing", "number"],
  ["sort", "code"],
  ["security", "code"],
];

const PLURAL_SEGMENT_ALIASES = new Map([
  ["authorizations", "authorization"],
  ["cards", "card"],
  ["cookies", "cookie"],
  ["ibans", "iban"],
  ["keys", "key"],
  ["passwords", "password"],
  ["pins", "pin"],
  ["secrets", "secret"],
  ["tokens", "token"],
]);

const NON_SECRET_METADATA_SEGMENTS = new Set([
  "count",
  "length",
  "strength",
  "type",
  "status",
  "policy",
  "enabled",
  "expiry",
  "expires",
  "expiresat",
  "expiresin",
  "createdat",
  "updatedat",
  "lastusedat",
  "name",
  "label",
]);

function keySegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => {
      const lower = segment.toLowerCase();
      return PLURAL_SEGMENT_ALIASES.get(lower) ?? lower;
    });
}

function containsSequence(segments: string[], sequence: string[]): boolean {
  for (let start = 0; start <= segments.length - sequence.length; start += 1) {
    if (sequence.every((part, offset) => segments[start + offset] === part)) {
      return true;
    }
  }
  return false;
}

/**
 * A key is sensitive when it is a known secret name, ends in a sensitive word
 * (accessToken, clientSecret), or contains a payment/auth phrase
 * (cardNumber, x-api-key). Metadata about a secret (tokenCount,
 * passwordStrength) is not itself secret.
 */
export function isSensitiveTelemetryKey(key: string): boolean {
  const segments = keySegments(key);
  if (segments.length === 0) return false;

  if (SENSITIVE_JOINED_KEYS.has(segments.join(""))) return true;
  if (
    SENSITIVE_KEY_PHRASES.some((phrase) =>
      containsSequence(segments, phrase),
    )
  ) {
    return true;
  }

  if (!segments.some((segment) => SENSITIVE_SEGMENTS.has(segment))) {
    return false;
  }

  const hasMetadata = segments.some((segment) =>
    NON_SECRET_METADATA_SEGMENTS.has(segment),
  );
  const hasOtherMeaning = segments.some(
    (segment) =>
      !SENSITIVE_SEGMENTS.has(segment) &&
      !NON_SECRET_METADATA_SEGMENTS.has(segment),
  );

  return hasOtherMeaning || !hasMetadata;
}

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const AUTHORITY_URL = /^[a-z][a-z0-9+.-]*:\/\//i;
const PROTOCOL_RELATIVE_URL = /^\/\//;
const RELATIVE_URL = /^\//;

function looksLikeUrl(value: string): boolean {
  return (
    URL_SCHEME.test(value) ||
    PROTOCOL_RELATIVE_URL.test(value) ||
    RELATIVE_URL.test(value)
  );
}

/** Removes URL userinfo and query values while keeping the useful remainder. */
export function scrubTelemetryUrl(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed !== value ||
    /\s/.test(trimmed) ||
    !looksLikeUrl(trimmed)
  ) {
    return value;
  }

  const hashIndex = trimmed.indexOf("#");
  const beforeHash = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : trimmed.slice(hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  const withoutQuery =
    queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);

  let withoutUserinfo = withoutQuery;
  if (AUTHORITY_URL.test(withoutQuery)) {
    withoutUserinfo = withoutQuery.replace(
      /^([a-z][a-z0-9+.-]*:\/\/)[^/?#]*@/i,
      "$1",
    );
  } else if (PROTOCOL_RELATIVE_URL.test(withoutQuery)) {
    withoutUserinfo = withoutQuery.replace(/^\/\/[^/?#]*@/, "//");
  }

  return `${withoutUserinfo}${hash}`;
}

function scrubValue(
  value: unknown,
  depth: number,
  ancestors: WeakSet<object>,
): unknown {
  if (typeof value === "string") return scrubTelemetryUrl(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_SCRUB_DEPTH) return DEPTH_LIMIT_MARKER;
  if (ancestors.has(value)) return CIRCULAR_REFERENCE_MARKER;

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => scrubValue(entry, depth + 1, ancestors));
    }

    if (value instanceof Date) return new Date(value.getTime());

    const scrubbed: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      scrubbed[key] = isSensitiveTelemetryKey(key)
        ? REDACTION_MARKER
        : scrubValue(entry, depth + 1, ancestors);
    }
    return scrubbed;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Returns a scrubbed copy of any telemetry value. Sensitive values become
 * `REDACTION_MARKER`; URLs lose userinfo and query strings; cycles and overly
 * deep branches become fixed markers. The input is left untouched.
 */
export function scrubTelemetry<T>(value: T): T {
  return scrubValue(value, 0, new WeakSet<object>()) as T;
}
