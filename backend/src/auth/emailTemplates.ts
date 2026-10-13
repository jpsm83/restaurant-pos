export type AuthEmailTemplateContent = {
  subject: string;
  html: string;
  text: string;
};

const confirmationTranslations = {
  en: {
    subject: "Confirm Your Email - POS",
    greeting: "Hello",
    message:
      "Welcome to POS! Please confirm your email address by clicking the button below to complete your account setup.",
    confirmButton: "Confirm Email",
    ignoreMessage:
      "If you didn't create an account with POS, please ignore this email.",
    expiryMessage:
      "This confirmation link will expire in 24 hours for security reasons.",
    fallbackMessage:
      "If the button above doesn't work, copy and paste this link into your browser:",
    copyright: "© 2026 POS. All rights reserved.",
  },
};

const passwordResetTranslations = {
  en: {
    subject: "Password Reset Request - POS",
    greeting: "Hello",
    message:
      "You recently requested to reset your password for your POS account. Click the button below to reset it.",
    resetButton: "Reset Password",
    ignoreMessage:
      "If you didn't request a password reset, please ignore this email or contact support if you have concerns.",
    expiryMessage:
      "This password reset link will expire in 1 hour for security reasons.",
    fallbackMessage:
      "If the button above doesn't work, copy and paste this link into your browser:",
    copyright: "© 2026 POS. All rights reserved.",
  },
};

const emailChangeTranslations = {
  en: {
    subject: "Confirm Your New Sign-in Email - POS",
    greeting: "Hello",
    message:
      "You asked to change the sign-in email for your POS account. Click the button below to confirm this new address and finish the change.",
    confirmButton: "Confirm New Email",
    ignoreMessage:
      "If you didn't request this change, ignore this email — your sign-in email stays the same.",
    expiryMessage:
      "This confirmation link will expire in 24 hours for security reasons.",
    fallbackMessage:
      "If the button above doesn't work, copy and paste this link into your browser:",
    copyright: "© 2026 POS. All rights reserved.",
  },
};

const emailChangeNoticeTranslations = {
  en: {
    subject: "Your POS Sign-In Email Was Changed",
    greeting: "Hello",
    message:
      "The sign-in email for your POS account was changed. You will now sign in with the new address shown below.",
    newAddressLabel: "New sign-in email",
    warningMessage:
      "If you didn't make this change, contact support immediately — someone may have taken over your account.",
    copyright: "© 2026 POS. All rights reserved.",
  },
};

function fallbackName(name?: string): string {
  return name?.trim() || "there";
}

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

export function buildEmailConfirmationContent(options: {
  confirmUrl: string;
  greetingName?: string;
}): AuthEmailTemplateContent {
  const t = confirmationTranslations.en;
  const username = fallbackName(options.greetingName);

  return {
    subject: t.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(to right, #0ea5e9, #3b82f6); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px; color: white;">
            POS
          </h1>
        </div>
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #374151; margin-bottom: 20px;">${t.greeting} ${username}!</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.message}
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${options.confirmUrl}"
               style="background: linear-gradient(to right, #0ea5e9, #3b82f6); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              ${t.confirmButton}
            </a>
          </div>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.ignoreMessage}
          </p>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.expiryMessage}
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            ${t.fallbackMessage}<br>
            <a href="${options.confirmUrl}" style="color: #3b82f6;">${options.confirmUrl}</a>
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>${t.copyright}</p>
        </div>
      </div>
    `,
    text: `
      ${t.subject}

      ${t.greeting} ${username}!

      ${t.message}

      ${options.confirmUrl}

      ${t.ignoreMessage}

      ${t.expiryMessage}

      ${t.copyright}
    `,
  };
}

export function buildPasswordResetEmailContent(options: {
  resetUrl: string;
  greetingName?: string;
}): AuthEmailTemplateContent {
  const t = passwordResetTranslations.en;
  const username = fallbackName(options.greetingName);

  return {
    subject: t.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(to right, #0ea5e9, #3b82f6); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px; color: white;">
            POS
          </h1>
        </div>
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #374151; margin-bottom: 20px;">${t.greeting} ${username}!</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.message}
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${options.resetUrl}"
               style="background: linear-gradient(to right, #0ea5e9, #3b82f6); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              ${t.resetButton}
            </a>
          </div>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.ignoreMessage}
          </p>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.expiryMessage}
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            ${t.fallbackMessage}<br>
            <a href="${options.resetUrl}" style="color: #3b82f6;">${options.resetUrl}</a>
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>${t.copyright}</p>
        </div>
      </div>
    `,
    text: `
      ${t.subject}

      ${t.greeting} ${username}!

      ${t.message}

      ${options.resetUrl}

      ${t.ignoreMessage}

      ${t.expiryMessage}

      ${t.copyright}
    `,
  };
}

/**
 * Security notice sent to the *previous* sign-in address after a confirmed
 * email change. It carries no link: it only warns the former owner.
 */
export function buildEmailChangeNoticeContent(options: {
  newEmail: string;
  greetingName?: string;
}): AuthEmailTemplateContent {
  const t = emailChangeNoticeTranslations.en;
  const username = fallbackName(options.greetingName);

  return {
    subject: t.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(to right, #0ea5e9, #3b82f6); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px; color: white;">
            POS
          </h1>
        </div>
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #374151; margin-bottom: 20px;">${t.greeting} ${username}!</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.message}
          </p>
          <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
            <strong>${t.newAddressLabel}:</strong> ${options.newEmail}
          </p>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.warningMessage}
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        </div>
        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>${t.copyright}</p>
        </div>
      </div>
    `,
    text: `
      ${t.subject}

      ${t.greeting} ${username}!

      ${t.message}

      ${t.newAddressLabel}: ${options.newEmail}

      ${t.warningMessage}

      ${t.copyright}
    `,
  };
}

export function buildEmailChangeConfirmationContent(options: {
  confirmUrl: string;
  greetingName?: string;
}): AuthEmailTemplateContent {
  const t = emailChangeTranslations.en;
  const username = fallbackName(options.greetingName);

  return {
    subject: t.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(to right, #0ea5e9, #3b82f6); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px; color: white;">
            POS
          </h1>
        </div>
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #374151; margin-bottom: 20px;">${t.greeting} ${username}!</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.message}
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${options.confirmUrl}"
               style="background: linear-gradient(to right, #0ea5e9, #3b82f6); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              ${t.confirmButton}
            </a>
          </div>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.ignoreMessage}
          </p>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.expiryMessage}
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            ${t.fallbackMessage}<br>
            <a href="${options.confirmUrl}" style="color: #3b82f6;">${options.confirmUrl}</a>
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>${t.copyright}</p>
        </div>
      </div>
    `,
    text: `
      ${t.subject}

      ${t.greeting} ${username}!

      ${t.message}

      ${options.confirmUrl}

      ${t.ignoreMessage}

      ${t.expiryMessage}

      ${t.copyright}
    `,
  };
}
