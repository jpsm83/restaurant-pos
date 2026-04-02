import type { BusinessProfileUpdatedEventPayload } from "../types.ts";

/**
 * Templates for BUSINESS_PROFILE_UPDATED (email plain text + in-app message).
 *
 * Flow:
 * 1) Partition `changedFields` into display-safe labels vs sensitive paths (password/token/etc.).
 * 2) Build copy that never echoes secret *values* (payload must not carry them) and avoids
 *    leaking risky *keys* by collapsing sensitive paths into a single generic notice.
 */

/** Matches path segments or whole keys that must not appear verbatim in user-facing copy. */
const SENSITIVE_FIELD_PATH_PATTERN =
  /password|passwd|passcode|token|secret|apikey|api[_-]?key|credential|authorization|bearer|refresh/i;

const isSensitiveFieldPath = (fieldPath: string): boolean =>
  SENSITIVE_FIELD_PATH_PATTERN.test(fieldPath.trim());

export type BusinessProfileChangedFieldsPartition = {
  safeLabels: string[];
  sensitiveFieldCount: number;
};

/**
 * Splits changed field paths for display. Sensitive paths are counted but not returned as labels,
 * so notification text cannot accidentally mirror raw credential-related keys from the update DTO.
 */
export const partitionBusinessProfileChangedFields = (
  changedFields: string[]
): BusinessProfileChangedFieldsPartition => {
  const safeLabels: string[] = [];
  let sensitiveFieldCount = 0;

  for (const raw of changedFields) {
    const path = raw.trim();
    if (!path) continue;
    if (isSensitiveFieldPath(path)) {
      sensitiveFieldCount += 1;
      continue;
    }
    safeLabels.push(path);
  }

  return { safeLabels, sensitiveFieldCount };
};

const formatActorSummary = (
  actor: BusinessProfileUpdatedEventPayload["actor"]
): string => {
  if (actor.source === "system") return "System";
  const parts: string[] = [];
  if (actor.role?.trim()) parts.push(actor.role.trim());
  if (actor.email?.trim()) parts.push(actor.email.trim());
  return parts.length > 0 ? parts.join(" · ") : "A team member";
};

const sensitiveSummaryLine = (count: number): string | null => {
  if (count <= 0) return null;
  return count === 1
    ? "Protected account fields were also updated (details omitted for security)."
    : `Protected account fields were also updated (${count} areas; details omitted for security).`;
};

const MAX_FIELDS_IN_APP = 5;

const formatFieldListForInApp = (labels: string[], sensitiveCount: number): string => {
  const suffix = sensitiveSummaryLine(sensitiveCount);
  if (labels.length === 0) {
    return suffix ? suffix.replace(" also ", " ") : "Profile details were updated.";
  }

  const shown =
    labels.length <= MAX_FIELDS_IN_APP
      ? labels.join(", ")
      : `${labels.slice(0, MAX_FIELDS_IN_APP).join(", ")} and ${labels.length - MAX_FIELDS_IN_APP} more`;

  return suffix ? `${shown}. ${suffix}` : shown;
};

/**
 * Short single-paragraph message for persisted in-app notifications / live previews.
 */
export const buildBusinessProfileUpdatedInAppMessage = (
  payload: BusinessProfileUpdatedEventPayload
): string => {
  const { safeLabels, sensitiveFieldCount } = partitionBusinessProfileChangedFields(
    payload.changedFields
  );
  const actor = formatActorSummary(payload.actor);
  const fields = formatFieldListForInApp(safeLabels, sensitiveFieldCount);
  return `Business profile updated by ${actor}: ${fields}`;
};

/**
 * Multi-section plain text suitable for email channel (`text` body).
 */
export const buildBusinessProfileUpdatedEmailBody = (
  payload: BusinessProfileUpdatedEventPayload
): string => {
  const { safeLabels, sensitiveFieldCount } = partitionBusinessProfileChangedFields(
    payload.changedFields
  );
  const actor = formatActorSummary(payload.actor);
  const when = payload.occurredAt.toISOString();
  const businessLine = `Business ID: ${payload.businessId.toString()}`;
  const lines: string[] = [
    "The business profile was updated.",
    "",
    businessLine,
    `Updated by: ${actor}`,
    `Time (UTC): ${when}`,
  ];

  const ctx = payload.context;
  if (ctx?.correlationId?.trim()) {
    lines.push(`Reference: ${ctx.correlationId.trim()}`);
  }

  lines.push("", "What changed:");

  if (safeLabels.length === 0 && sensitiveFieldCount === 0) {
    lines.push("- (no field list supplied)");
  } else {
    for (const label of safeLabels) {
      lines.push(`- ${label}`);
    }
    const sensitiveLine = sensitiveSummaryLine(sensitiveFieldCount);
    if (sensitiveLine) lines.push(`- ${sensitiveLine}`);
  }

  lines.push(
    "",
    "This is an automated message. For security, do not send sign-in secrets by email."
  );

  return lines.join("\n");
};
