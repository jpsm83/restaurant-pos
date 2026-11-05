import { describe, it, expect } from "vitest";
import {
  accountEmailTranslations,
  buildBusinessContactVerificationContent,
  buildEmailChangeConfirmationContent,
  buildEmailChangeNoticeContent,
  buildEmailConfirmationContent,
  buildPasswordResetEmailContent,
  buildSignInConfirmationContent,
  formatAuthEmailTtlPhrase,
} from "../../src/auth/emailTemplates.ts";

function templatePlaceholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)]
    .map((match) => match[1])
    .sort();
}

describe("formatAuthEmailTtlPhrase", () => {
  it("formats minutes under one hour", () => {
    expect(formatAuthEmailTtlPhrase(60_000)).toBe("1 minute");
    expect(formatAuthEmailTtlPhrase(120_000)).toBe("2 minutes");
  });

  it("formats whole hours when exact", () => {
    expect(formatAuthEmailTtlPhrase(3_600_000)).toBe("1 hour");
    expect(formatAuthEmailTtlPhrase(86_400_000)).toBe("24 hours");
  });

  it("formats hour and minute remainder", () => {
    expect(formatAuthEmailTtlPhrase(5_400_000)).toBe("1 hour and 30 minutes");
  });

  it("returns a short time phrase for non-positive TTL", () => {
    expect(formatAuthEmailTtlPhrase(0)).toBe("a short time");
    expect(formatAuthEmailTtlPhrase(-1)).toBe("a short time");
  });
});

describe("emailTemplates", () => {
  it("buildEmailConfirmationContent includes link, fixed copy, and greeting", () => {
    const url = "https://app.test/confirm-email?token=abc";
    const { subject, html, text } = buildEmailConfirmationContent({
      confirmUrl: url,
      greetingName: "Pat",
    });

    expect(subject).toBe("Confirm Your Email - POS");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("24 hours");
    expect(html).toContain("Hello Pat!");
    expect(html).not.toContain("<script>");
    expect(text).toContain(url);
    expect(text).toContain("24 hours");
    expect(text).toContain("Hello Pat!");
  });

  it("uses a neutral greeting when name is missing", () => {
    const { html, text } = buildEmailConfirmationContent({
      confirmUrl: "https://x.test/c",
    });
    expect(html).toContain("Hello there!");
    expect(text).toContain("Hello there!");
  });

  it("builds the confirmation email in the recipient's Spanish preference", () => {
    const url = "https://app.test/confirm-email?token=abc";
    const { subject, html, text } = buildEmailConfirmationContent({
      confirmUrl: url,
      greetingName: "Pat",
      language: "es",
    });

    expect(subject).toBe("Confirma tu correo electrónico - POS");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("24 horas");
    expect(html).toContain("Hola Pat!");
    expect(text).toContain(url);
    expect(text).toContain("24 horas");
    expect(text).toContain("Hola Pat!");
  });

  it("falls back to English for an unsupported confirmation preference", () => {
    const { subject, html } = buildEmailConfirmationContent({
      confirmUrl: "https://x.test/c",
      language: "fr",
    });

    expect(subject).toBe("Confirm Your Email - POS");
    expect(html).toContain("Hello there!");
  });

  it("keeps the no-name greeting in the recipient's language", () => {
    const { html, text } = buildEmailConfirmationContent({
      confirmUrl: "https://x.test/c",
      language: "es",
    });

    expect(html).toContain("Hola!");
    expect(html).not.toContain("there");
    expect(text).toContain("Hola!");
    expect(text).not.toContain("there");
  });

  it("buildBusinessContactVerificationContent names the venue with a link and expiry", () => {
    const url = "https://app.test/confirm-email?token=biz";
    const { subject, html, text } = buildBusinessContactVerificationContent({
      confirmUrl: url,
      venueName: "The Blue Door",
    });

    expect(subject).toBe("Confirm Your Business Contact Email - POS");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("The Blue Door");
    expect(html).toContain("24 hours");
    expect(text).toContain(url);
    expect(text).toContain("The Blue Door");
    expect(text).toContain("24 hours");
  });

  it("builds the business contact verification email in Spanish", () => {
    const url = "https://app.test/confirm-email?token=biz";
    const { subject, html, text } = buildBusinessContactVerificationContent({
      confirmUrl: url,
      venueName: "The Blue Door",
      language: "es",
    });

    expect(subject).toBe("Confirma el correo de contacto de tu negocio - POS");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("The Blue Door");
    expect(html).toContain("24 horas");
    expect(text).toContain(url);
    expect(text).toContain("The Blue Door");
    expect(text).toContain("24 horas");
  });

  it("falls back to English for an unsupported business preference", () => {
    const { subject } = buildBusinessContactVerificationContent({
      confirmUrl: "https://app.test/confirm-email?token=biz",
      venueName: "The Blue Door",
      language: "fr",
    });

    expect(subject).toBe("Confirm Your Business Contact Email - POS");
  });

  it("escapes the venue name in the rich part only", () => {
    const venueName = '<script>alert("x")</script>';
    const { html, text } = buildBusinessContactVerificationContent({
      confirmUrl: "https://app.test/confirm-email?token=biz",
      venueName,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(text).toContain(venueName);
  });

  it("localizes the venue fallback when the name is blank", () => {
    const english = buildBusinessContactVerificationContent({
      confirmUrl: "https://app.test/confirm-email?token=biz",
      venueName: "  ",
    });
    expect(english.text).toContain("your venue");

    const spanish = buildBusinessContactVerificationContent({
      confirmUrl: "https://app.test/confirm-email?token=biz",
      venueName: "",
      language: "es",
    });
    expect(spanish.text).toContain("tu local");
    expect(spanish.html).toContain("tu local");
  });

  it("keeps the venue name untranslated and escapes it in Spanish HTML only", () => {
    const venueName = '<script>alert("x")</script>';
    const { html, text } = buildBusinessContactVerificationContent({
      confirmUrl: "https://app.test/confirm-email?token=biz",
      venueName,
      language: "es",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(text).toContain(venueName);
  });

  it("buildEmailChangeConfirmationContent includes the new-address link and expiry", () => {
    const url = "https://app.test/confirm-email-change?token=abc";
    const { subject, html, text } = buildEmailChangeConfirmationContent({
      confirmUrl: url,
      greetingName: "Pat",
    });

    expect(subject).toBe("Confirm Your New Sign-in Email - POS");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("24 hours");
    expect(html).toContain("Hello Pat!");
    expect(text).toContain(url);
    expect(text).toContain("24 hours");
  });

  it("builds the confirmation email in Spanish with the link, expiry, and fallback", () => {
    const url = "https://app.test/confirm-email-change?token=abc";
    const { subject, html, text } = buildEmailChangeConfirmationContent({
      confirmUrl: url,
      greetingName: "Pat",
      language: "es",
    });

    expect(subject).toBe("Confirma tu nuevo correo de acceso - POS");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("24 horas");
    expect(html).toContain("Hola Pat!");
    expect(html).toContain("Si no solicitaste este cambio");
    expect(text).toContain(url);
    expect(text).toContain("24 horas");
  });

  it("keeps the no-name email-change greeting in Spanish", () => {
    const { html, text } = buildEmailChangeConfirmationContent({
      confirmUrl: "https://x.test/c",
      language: "es",
    });

    expect(html).toContain("Hola!");
    expect(html).not.toContain("there");
    expect(text).toContain("Hola!");
    expect(text).not.toContain("there");
  });

  it("falls back to English for an unsupported confirmation preference", () => {
    const { subject, html } = buildEmailChangeConfirmationContent({
      confirmUrl: "https://x.test/c",
      language: "fr",
    });

    expect(subject).toBe("Confirm Your New Sign-in Email - POS");
    expect(html).toContain("Hello there!");
  });

  it("falls back to English for a null confirmation preference", () => {
    const { subject } = buildEmailChangeConfirmationContent({
      confirmUrl: "https://x.test/c",
      language: null,
    });

    expect(subject).toBe("Confirm Your New Sign-in Email - POS");
  });

  it("buildEmailChangeNoticeContent warns the old address without a link", () => {
    const { subject, html, text } = buildEmailChangeNoticeContent({
      newEmail: "new@example.com",
      greetingName: "Pat",
    });

    expect(subject).toBe("Your POS Sign-In Email Was Changed");
    expect(html).toContain("Hello Pat!");
    expect(html).toContain("new@example.com");
    expect(html).not.toContain("href=");
    expect(text).toContain("new@example.com");
    expect(text).not.toContain("http");
  });

  it("builds the notice in Spanish without a link and keeps the warning", () => {
    const { subject, html, text } = buildEmailChangeNoticeContent({
      newEmail: "nuevo@example.com",
      greetingName: "Pat",
      language: "es",
    });

    expect(subject).toBe("Se cambió tu correo de acceso de POS");
    expect(html).toContain("Hola Pat!");
    expect(html).toContain("nuevo@example.com");
    expect(html).toContain("Nuevo correo de acceso");
    expect(html).toContain("soporte");
    expect(html).not.toContain("href=");
    expect(text).toContain("nuevo@example.com");
    expect(text).not.toContain("http");
  });

  it("keeps the no-name notice greeting in Spanish", () => {
    const { html, text } = buildEmailChangeNoticeContent({
      newEmail: "nuevo@example.com",
      language: "es",
    });

    expect(html).toContain("Hola!");
    expect(html).not.toContain("there");
    expect(text).toContain("Hola!");
    expect(text).not.toContain("there");
  });

  it("falls back to English for an unsupported notice preference", () => {
    const { subject, html } = buildEmailChangeNoticeContent({
      newEmail: "new@example.com",
      language: "de",
    });

    expect(subject).toBe("Your POS Sign-In Email Was Changed");
    expect(html).toContain("New sign-in email");
  });

  it("buildSignInConfirmationContent confirms the sign-in with no link or token", () => {
    const { subject, html, text } = buildSignInConfirmationContent({
      greetingName: "Pat",
    });

    expect(subject).toBe("New Sign-In to Your POS Account");
    expect(html).toContain("Hello Pat!");
    expect(html).toContain("A sign-in to your POS account just happened.");
    expect(html).toContain("reset your password");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("http");
    expect(text).toContain("Hello Pat!");
    expect(text).toContain("A sign-in to your POS account just happened.");
    expect(text).not.toContain("http");
    expect(text).not.toContain("unsubscribe");
  });

  it("builds the sign-in confirmation in Spanish without a link", () => {
    const { subject, html, text } = buildSignInConfirmationContent({
      greetingName: "Pat",
      language: "es",
    });

    expect(subject).toBe("Nuevo inicio de sesión en tu cuenta de POS");
    expect(html).toContain("Hola Pat!");
    expect(html).toContain(
      "Acaba de producirse un inicio de sesión en tu cuenta de POS.",
    );
    expect(html).toContain("Si no fuiste tú");
    expect(html).not.toContain("href=");
    expect(text).toContain("Hola Pat!");
    expect(text).not.toContain("http");
  });

  it("uses a neutral sign-in confirmation greeting when no name is stored", () => {
    const english = buildSignInConfirmationContent({});
    expect(english.html).toContain("Hello there!");
    expect(english.text).toContain("Hello there!");

    const spanish = buildSignInConfirmationContent({ language: "es" });
    expect(spanish.html).toContain("Hola!");
    expect(spanish.html).not.toContain("there");
    expect(spanish.text).toContain("Hola!");
    expect(spanish.text).not.toContain("there");
  });

  it("falls back to English for an unsupported sign-in confirmation preference", () => {
    const { subject, html } = buildSignInConfirmationContent({
      greetingName: "Pat",
      language: "fr",
    });

    expect(subject).toBe("New Sign-In to Your POS Account");
    expect(html).toContain("Hello Pat!");
  });

  it("buildPasswordResetEmailContent includes link and fixed expiry copy", () => {
    const url = "https://app.test/reset-password?token=xyz";
    const { subject, html, text } = buildPasswordResetEmailContent({
      resetUrl: url,
    });

    expect(subject).toBe("Password Reset Request - POS");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("1 hour");
    expect(text).toContain(url);
    expect(text).toContain("1 hour");
  });

  it("keeps the no-name password reset greeting in the recipient's language", () => {
    const { html, text } = buildPasswordResetEmailContent({
      resetUrl: "https://x.test/r",
      language: "es",
    });

    expect(html).toContain("Hola!");
    expect(html).not.toContain("there");
    expect(text).toContain("Hola!");
    expect(text).not.toContain("there");
  });

  it("builds the password reset email in the recipient's Spanish preference", () => {
    const url = "https://app.test/reset-password?token=xyz";
    const { subject, html, text } = buildPasswordResetEmailContent({
      resetUrl: url,
      greetingName: "Pat",
      language: "es",
    });

    expect(subject).toBe("Solicitud de restablecimiento de contraseña - POS");
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("1 hora");
    expect(html).toContain("Hola Pat!");
    expect(text).toContain(url);
    expect(text).toContain("1 hora");
  });
});

describe("account email template dictionaries", () => {
  it.each(Object.entries(accountEmailTranslations))(
    "%s keeps identical keys and interpolation placeholders in English and Spanish",
    (_name, dictionary) => {
      const english = dictionary.en;
      const spanish = dictionary.es;

      expect(Object.keys(spanish).sort()).toEqual(
        Object.keys(english).sort(),
      );

      for (const key of Object.keys(english) as (keyof typeof english)[]) {
        expect(templatePlaceholders(spanish[key])).toEqual(
          templatePlaceholders(english[key]),
        );
      }
    },
  );
});
