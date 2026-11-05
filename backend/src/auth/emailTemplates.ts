import {
  pickAccountEmailTranslation,
  resolveAccountEmailLanguage,
  type AccountEmailLanguage,
} from "./recipientLanguage.ts";

export type AuthEmailTemplateContent = {
  subject: string;
  html: string;
  text: string;
};

type AccountEmailTranslation = {
  subject: string;
  greeting: string;
  greetingNoName: string;
  message: string;
  ignoreMessage: string;
  expiryMessage: string;
  fallbackMessage: string;
  copyright: string;
};

type ConfirmationTranslation = AccountEmailTranslation & {
  confirmButton: string;
};

type PasswordResetTranslation = AccountEmailTranslation & {
  resetButton: string;
};

const confirmationTranslations: Record<
  AccountEmailLanguage,
  ConfirmationTranslation
> = {
  en: {
    subject: "Confirm Your Email - POS",
    greeting: "Hello {{name}}",
    greetingNoName: "Hello there",
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
  es: {
    subject: "Confirma tu correo electrónico - POS",
    greeting: "Hola {{name}}",
    greetingNoName: "Hola",
    message:
      "¡Bienvenido a POS! Confirma tu dirección de correo electrónico haciendo clic en el botón de abajo para completar la configuración de tu cuenta.",
    confirmButton: "Confirmar correo electrónico",
    ignoreMessage:
      "Si no creaste una cuenta en POS, ignora este correo.",
    expiryMessage:
      "Este enlace de confirmación caducará en 24 horas por motivos de seguridad.",
    fallbackMessage:
      "Si el botón de arriba no funciona, copia y pega este enlace en tu navegador:",
    copyright: "© 2026 POS. Todos los derechos reservados.",
  },
};

type BusinessContactVerificationTranslation = Pick<
  AccountEmailTranslation,
  | "subject"
  | "greeting"
  | "message"
  | "ignoreMessage"
  | "expiryMessage"
  | "fallbackMessage"
  | "copyright"
> & {
  venueLabel: string;
  venueFallback: string;
  confirmButton: string;
};

const businessContactVerificationTranslations: Record<
  AccountEmailLanguage,
  BusinessContactVerificationTranslation
> = {
  en: {
    subject: "Confirm Your Business Contact Email - POS",
    greeting: "Hello",
    message:
      "Please confirm the contact email for the venue below by clicking the button.",
    venueLabel: "Venue",
    venueFallback: "your venue",
    confirmButton: "Confirm Email",
    ignoreMessage:
      "If you didn't request this verification, you can ignore this email.",
    expiryMessage:
      "This confirmation link will expire in 24 hours for security reasons.",
    fallbackMessage:
      "If the button above doesn't work, copy and paste this link into your browser:",
    copyright: "© 2026 POS. All rights reserved.",
  },
  es: {
    subject: "Confirma el correo de contacto de tu negocio - POS",
    greeting: "Hola",
    message:
      "Confirma el correo de contacto del local indicado a continuación haciendo clic en el botón.",
    venueLabel: "Local",
    venueFallback: "tu local",
    confirmButton: "Confirmar correo electrónico",
    ignoreMessage:
      "Si no solicitaste esta verificación, puedes ignorar este correo.",
    expiryMessage:
      "Este enlace de confirmación caducará en 24 horas por motivos de seguridad.",
    fallbackMessage:
      "Si el botón de arriba no funciona, copia y pega este enlace en tu navegador:",
    copyright: "© 2026 POS. Todos los derechos reservados.",
  },
};

const passwordResetTranslations: Record<
  AccountEmailLanguage,
  PasswordResetTranslation
> = {
  en: {
    subject: "Password Reset Request - POS",
    greeting: "Hello {{name}}",
    greetingNoName: "Hello there",
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
  es: {
    subject: "Solicitud de restablecimiento de contraseña - POS",
    greeting: "Hola {{name}}",
    greetingNoName: "Hola",
    message:
      "Recientemente solicitaste restablecer la contraseña de tu cuenta de POS. Haz clic en el botón de abajo para restablecerla.",
    resetButton: "Restablecer contraseña",
    ignoreMessage:
      "Si no solicitaste un restablecimiento de contraseña, ignora este correo o contacta con soporte si tienes dudas.",
    expiryMessage:
      "Este enlace de restablecimiento de contraseña caducará en 1 hora por motivos de seguridad.",
    fallbackMessage:
      "Si el botón de arriba no funciona, copia y pega este enlace en tu navegador:",
    copyright: "© 2026 POS. Todos los derechos reservados.",
  },
};

function fallbackName(name?: string): string {
  return name?.trim() || "there";
}

function interpolate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => values[key] ?? `{{${key}}}`,
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  language?: string | null;
}): AuthEmailTemplateContent {
  const t = pickAccountEmailTranslation(
    accountEmailTranslations.confirmation,
    resolveAccountEmailLanguage(options.language),
  );
  const greeting = options.greetingName?.trim()
    ? interpolate(t.greeting, { name: options.greetingName.trim() })
    : t.greetingNoName;

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
          <h2 style="color: #374151; margin-bottom: 20px;">${greeting}!</h2>
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

      ${greeting}!

      ${t.message}

      ${options.confirmUrl}

      ${t.ignoreMessage}

      ${t.expiryMessage}

      ${t.copyright}
    `,
  };
}

/**
 * Contact-email verification for a venue. The venue name is authored data:
 * interpolated as-is in plain text and escaped in the rich part.
 */
export function buildBusinessContactVerificationContent(options: {
  confirmUrl: string;
  venueName: string;
  language?: string | null;
}): AuthEmailTemplateContent {
  const t = pickAccountEmailTranslation(
    accountEmailTranslations.businessContactVerification,
    resolveAccountEmailLanguage(options.language),
  );
  const venueName = options.venueName.trim() || t.venueFallback;
  const htmlVenueName = escapeHtml(venueName);

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
          <h2 style="color: #374151; margin-bottom: 20px;">${t.greeting}!</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.message}
          </p>
          <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
            <strong>${t.venueLabel}:</strong> ${htmlVenueName}
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

      ${t.greeting}!

      ${t.message}

      ${t.venueLabel}: ${venueName}

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
  language?: string | null;
}): AuthEmailTemplateContent {
  const t = pickAccountEmailTranslation(
    accountEmailTranslations.passwordReset,
    resolveAccountEmailLanguage(options.language),
  );
  const greeting = options.greetingName?.trim()
    ? interpolate(t.greeting, { name: options.greetingName.trim() })
    : t.greetingNoName;

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
          <h2 style="color: #374151; margin-bottom: 20px;">${greeting}!</h2>
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

      ${greeting}!

      ${t.message}

      ${options.resetUrl}

      ${t.ignoreMessage}

      ${t.expiryMessage}

      ${t.copyright}
    `,
  };
}

type EmailChangeTranslation = {
  subject: string;
  greeting: string;
  greetingNoName: string;
  message: string;
  confirmButton: string;
  ignoreMessage: string;
  expiryMessage: string;
  fallbackMessage: string;
  copyright: string;
};

const emailChangeTranslations: Record<
  AccountEmailLanguage,
  EmailChangeTranslation
> = {
  en: {
    subject: "Confirm Your New Sign-in Email - POS",
    greeting: "Hello {{name}}",
    greetingNoName: "Hello there",
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
  es: {
    subject: "Confirma tu nuevo correo de acceso - POS",
    greeting: "Hola {{name}}",
    greetingNoName: "Hola",
    message:
      "Solicitaste cambiar el correo de acceso de tu cuenta de POS. Haz clic en el botón de abajo para confirmar esta nueva dirección y finalizar el cambio.",
    confirmButton: "Confirmar nuevo correo",
    ignoreMessage:
      "Si no solicitaste este cambio, ignora este correo; tu correo de acceso no cambiará.",
    expiryMessage:
      "Este enlace de confirmación caducará en 24 horas por motivos de seguridad.",
    fallbackMessage:
      "Si el botón de arriba no funciona, copia y pega este enlace en tu navegador:",
    copyright: "© 2026 POS. Todos los derechos reservados.",
  },
};

type EmailChangeNoticeTranslation = {
  subject: string;
  greeting: string;
  greetingNoName: string;
  message: string;
  newAddressLabel: string;
  warningMessage: string;
  copyright: string;
};

const emailChangeNoticeTranslations: Record<
  AccountEmailLanguage,
  EmailChangeNoticeTranslation
> = {
  en: {
    subject: "Your POS Sign-In Email Was Changed",
    greeting: "Hello {{name}}",
    greetingNoName: "Hello there",
    message:
      "The sign-in email for your POS account was changed. You will now sign in with the new address shown below.",
    newAddressLabel: "New sign-in email",
    warningMessage:
      "If you didn't make this change, contact support immediately — someone may have taken over your account.",
    copyright: "© 2026 POS. All rights reserved.",
  },
  es: {
    subject: "Se cambió tu correo de acceso de POS",
    greeting: "Hola {{name}}",
    greetingNoName: "Hola",
    message:
      "Se cambió el correo de acceso de tu cuenta de POS. Ahora iniciarás sesión con la nueva dirección que se muestra a continuación.",
    newAddressLabel: "Nuevo correo de acceso",
    warningMessage:
      "Si no realizaste este cambio, contacta con soporte de inmediato; alguien podría haber tomado el control de tu cuenta.",
    copyright: "© 2026 POS. Todos los derechos reservados.",
  },
};

type SignInConfirmationTranslation = {
  subject: string;
  greeting: string;
  greetingNoName: string;
  message: string;
  securityMessage: string;
  copyright: string;
};

const signInConfirmationTranslations: Record<
  AccountEmailLanguage,
  SignInConfirmationTranslation
> = {
  en: {
    subject: "New Sign-In to Your POS Account",
    greeting: "Hello {{name}}",
    greetingNoName: "Hello there",
    message: "A sign-in to your POS account just happened.",
    securityMessage:
      "If this wasn't you, reset your password from the sign-in page and review your account.",
    copyright: "© 2026 POS. All rights reserved.",
  },
  es: {
    subject: "Nuevo inicio de sesión en tu cuenta de POS",
    greeting: "Hola {{name}}",
    greetingNoName: "Hola",
    message: "Acaba de producirse un inicio de sesión en tu cuenta de POS.",
    securityMessage:
      "Si no fuiste tú, restablece tu contraseña desde la página de inicio de sesión y revisa tu cuenta.",
    copyright: "© 2026 POS. Todos los derechos reservados.",
  },
};

export const accountEmailTranslations = {
  confirmation: confirmationTranslations,
  passwordReset: passwordResetTranslations,
  businessContactVerification: businessContactVerificationTranslations,
  emailChange: emailChangeTranslations,
  emailChangeNotice: emailChangeNoticeTranslations,
  signInConfirmation: signInConfirmationTranslations,
};

const accountExistsTranslations = {
  en: {
    subject: "You Already Have a POS Account",
    greeting: "Hello",
    message:
      "Someone tried to create a new POS account with this email address. You already have an account, so nothing has changed.",
    signInButton: "Sign in",
    resetButton: "Reset password",
    ignoreMessage:
      "If this wasn't you, you can ignore this email. Your account is unchanged.",
    copyright: "© 2026 POS. All rights reserved.",
  },
};

/**
 * Anti-enumeration sign-up notice: sent to an address that already has an
 * account instead of revealing the duplicate inline. It carries no one-time
 * token, only the ordinary sign-in and reset pages.
 */
export function buildAccountExistsEmailContent(options: {
  signInUrl: string;
  resetUrl: string;
  greetingName?: string;
}): AuthEmailTemplateContent {
  const t = accountExistsTranslations.en;
  const username = fallbackName(options.greetingName);

  const buttonStyle =
    "color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;";
  const signInStyle = `${buttonStyle} background: linear-gradient(to right, #0ea5e9, #3b82f6);`;
  const resetStyle = `${buttonStyle} background: #374151;`;

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
            <a href="${options.signInUrl}" style="${signInStyle}">
              ${t.signInButton}
            </a>
            <a href="${options.resetUrl}" style="${resetStyle} margin-left: 8px;">
              ${t.resetButton}
            </a>
          </div>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.ignoreMessage}
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            <a href="${options.signInUrl}" style="color: #3b82f6;">${options.signInUrl}</a><br>
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

      ${t.signInButton}: ${options.signInUrl}
      ${t.resetButton}: ${options.resetUrl}

      ${t.ignoreMessage}

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
  language?: string | null;
}): AuthEmailTemplateContent {
  const t = pickAccountEmailTranslation(
    accountEmailTranslations.emailChangeNotice,
    resolveAccountEmailLanguage(options.language),
  );
  const greeting = options.greetingName?.trim()
    ? interpolate(t.greeting, { name: options.greetingName.trim() })
    : t.greetingNoName;

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
          <h2 style="color: #374151; margin-bottom: 20px;">${greeting}!</h2>
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

      ${greeting}!

      ${t.message}

      ${t.newAddressLabel}: ${options.newEmail}

      ${t.warningMessage}

      ${t.copyright}
    `,
  };
}

/**
 * Security notice sent to the sign-in email after a successful sign-in. It
 * carries no link or token: its only action is the recipient's own decision to
 * reset a password they do not recognise.
 */
export function buildSignInConfirmationContent(options: {
  greetingName?: string;
  language?: string | null;
}): AuthEmailTemplateContent {
  const t = pickAccountEmailTranslation(
    accountEmailTranslations.signInConfirmation,
    resolveAccountEmailLanguage(options.language),
  );
  const greeting = options.greetingName?.trim()
    ? interpolate(t.greeting, { name: options.greetingName.trim() })
    : t.greetingNoName;

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
          <h2 style="color: #374151; margin-bottom: 20px;">${greeting}!</h2>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.message}
          </p>
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.securityMessage}
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

      ${greeting}!

      ${t.message}

      ${t.securityMessage}

      ${t.copyright}
    `,
  };
}

/**
 * Confirmation sent to the *pending* new sign-in address. The change completes
 * only when this link is consumed; the current address keeps signing in until
 * then.
 */
export function buildEmailChangeConfirmationContent(options: {
  confirmUrl: string;
  greetingName?: string;
  language?: string | null;
}): AuthEmailTemplateContent {
  const t = pickAccountEmailTranslation(
    accountEmailTranslations.emailChange,
    resolveAccountEmailLanguage(options.language),
  );
  const greeting = options.greetingName?.trim()
    ? interpolate(t.greeting, { name: options.greetingName.trim() })
    : t.greetingNoName;

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
          <h2 style="color: #374151; margin-bottom: 20px;">${greeting}!</h2>
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

      ${greeting}!

      ${t.message}

      ${options.confirmUrl}

      ${t.ignoreMessage}

      ${t.expiryMessage}

      ${t.copyright}
    `,
  };
}
