import {
  getEmailVerificationTtlMs,
  getPasswordResetTtlMs,
} from "./emailToken.ts";

export type AuthEmailTemplateContent = {
  subject: string;
  html: string;
  text: string;
};

function authEmailBrandName(): string {
  return process.env.AUTH_EMAIL_BRAND_NAME?.trim() || "Restaurant POS";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Wording for the email body; derived from the same TTL ms used when setting `*ExpiresAt` in the DB.
 */
export function formatAuthEmailTtlPhrase(ttlMs: number): string {
  const safe = Math.max(0, ttlMs);
  const totalMinutes = Math.round(safe / 60_000);
  if (totalMinutes <= 0) return "a short time";
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }
  const hrsExact = safe / 3_600_000;
  if (Number.isInteger(hrsExact) && hrsExact >= 1) {
    return `${hrsExact} hour${hrsExact === 1 ? "" : "s"}`;
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) {
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${h} hour${h === 1 ? "" : "s"} and ${m} minute${m === 1 ? "" : "s"}`;
}

function greetingLineHtml(greetingName?: string): string {
  if (greetingName?.trim()) {
    return `${escapeHtml(greetingName.trim())},`;
  }
  return "Hello,";
}

function greetingLineText(greetingName?: string): string {
  if (greetingName?.trim()) {
    return `${greetingName.trim()},`;
  }
  return "Hello,";
}

/**
 * Confirm sign-in email address (HTML + plain text). Includes CTA link, raw fallback URL, and expiry copy.
 */
export function buildEmailConfirmationContent(options: {
  confirmUrl: string;
  /** Shown after "Hello"; optional (e.g. username). Escaped in HTML. */
  greetingName?: string;
}): AuthEmailTemplateContent {
  const brand = authEmailBrandName();
  const ttlPhrase = formatAuthEmailTtlPhrase(getEmailVerificationTtlMs());
  const { confirmUrl } = options;
  const helloHtml = greetingLineHtml(options.greetingName);
  const helloText = greetingLineText(options.greetingName);

  const subject = `Confirm your email — ${brand}`;

  const html = `
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">${helloHtml}</p>
  <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">
    Please confirm your email address for your <strong>${escapeHtml(brand)}</strong> account by using the button below.
  </p>
  <p style="margin: 24px 0;">
    <a href="${confirmUrl}" style="display: inline-block; background: #171717; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px;">Confirm email</a>
  </p>
  <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: #4b5563;">
    This link expires in <strong>${escapeHtml(ttlPhrase)}</strong> for security. If you did not create an account, you can ignore this message.
  </p>
  <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b7280;">
    If the button does not work, copy and paste this link into your browser:<br />
    <span style="word-break: break-all;">${escapeHtml(confirmUrl)}</span>
  </p>
</div>`.trim();

  const text = [
    `${subject}`,
    "",
    helloText,
    "",
    `Please confirm your email for your ${brand} account by opening this link (expires in ${ttlPhrase}):`,
    confirmUrl,
    "",
    "If you did not create an account, ignore this email.",
  ].join("\n");

  return { subject, html, text };
}

/**
 * Password reset (HTML + plain text). Includes CTA link, raw fallback URL, and expiry copy.
 */
export function buildPasswordResetEmailContent(options: {
  resetUrl: string;
  greetingName?: string;
}): AuthEmailTemplateContent {
  const brand = authEmailBrandName();
  const ttlPhrase = formatAuthEmailTtlPhrase(getPasswordResetTtlMs());
  const { resetUrl } = options;
  const helloHtml = greetingLineHtml(options.greetingName);
  const helloText = greetingLineText(options.greetingName);

  const subject = `Reset your password — ${brand}`;

  const html = `
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
  <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">${helloHtml}</p>
  <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">
    We received a request to reset the password for your <strong>${escapeHtml(brand)}</strong> account. Use the button below to choose a new password.
  </p>
  <p style="margin: 24px 0;">
    <a href="${resetUrl}" style="display: inline-block; background: #171717; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px;">Reset password</a>
  </p>
  <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: #4b5563;">
    This link expires in <strong>${escapeHtml(ttlPhrase)}</strong>. If you did not request a reset, you can ignore this email—your password will stay the same.
  </p>
  <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b7280;">
    If the button does not work, copy and paste this link into your browser:<br />
    <span style="word-break: break-all;">${escapeHtml(resetUrl)}</span>
  </p>
</div>`.trim();

  const text = [
    `${subject}`,
    "",
    helloText,
    "",
    `Reset your ${brand} password using this link (expires in ${ttlPhrase}):`,
    resetUrl,
    "",
    "If you did not request this, ignore this email.",
  ].join("\n");

  return { subject, html, text };
}
