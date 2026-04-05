import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/app/api/utils/handleApiError";
import User from "@/app/api/models/user";
import * as nodemailer from "nodemailer";
import { requestEmailConfirmationService } from "@/lib/services/auth";
import { generateEmailLink } from "@/lib/utils/emailLinkGenerator";
import { getBaseUrlFromRequest } from "@/lib/utils/getBaseUrl";

// Shared email utilities
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

const validateEmailConfig = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error(
      "Email configuration is missing. Please set EMAIL_USER and EMAIL_PASSWORD environment variables."
    );
  }
};

const sendEmailWithTransporter = async (mailOptions: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) => {
  const transporter = createTransporter();
  const info = await transporter.sendMail(mailOptions);
  return { success: true, data: { messageId: info.messageId } };
};

// Email content translations
const emailTranslations = {
  en: {
    subject: "Confirm Your Email - Women's Spot",
    greeting: "Hello",
    message: "Welcome to Women's Spot! Please confirm your email address by clicking the button below to complete your account setup.",
    confirmButton: "Confirm Email",
    ignoreMessage: "If you didn't create an account with Women's Spot, please ignore this email.",
    expiryMessage: "This confirmation link will expire in 24 hours for security reasons.",
    fallbackMessage: "If the button above doesn't work, copy and paste this link into your browser:",
    copyright: "© 2025 Women's Spot. All rights reserved.",
  },
  pt: {
    subject: "Confirme seu Email - Women's Spot",
    greeting: "Olá",
    message: "Bem-vindo ao Women's Spot! Confirme seu endereço de email clicando no botão abaixo para completar a configuração da sua conta.",
    confirmButton: "Confirmar Email",
    ignoreMessage: "Se você não criou uma conta no Women's Spot, ignore este email.",
    expiryMessage: "Este link de confirmação expirará em 24 horas por motivos de segurança.",
    fallbackMessage: "Se o botão acima não funcionar, copie e cole este link no seu navegador:",
    copyright: "© 2025 Women's Spot. Todos os direitos reservados.",
  },
  es: {
    subject: "Confirma tu Email - Women's Spot",
    greeting: "Hola",
    message: "¡Bienvenido a Women's Spot! Confirma tu dirección de email haciendo clic en el botón de abajo para completar la configuración de tu cuenta.",
    confirmButton: "Confirmar Email",
    ignoreMessage: "Si no creaste una cuenta en Women's Spot, ignora este email.",
    expiryMessage: "Este enlace de confirmación expirará en 24 horas por razones de seguridad.",
    fallbackMessage: "Si el botón de arriba no funciona, copia y pega este enlace en tu navegador:",
    copyright: "© 2025 Women's Spot. Todos los derechos reservados.",
  },
  fr: {
    subject: "Confirmez votre Email - Women's Spot",
    greeting: "Bonjour",
    message: "Bienvenue sur Women's Spot ! Veuillez confirmer votre adresse e-mail en cliquant sur le bouton ci-dessous pour finaliser la configuration de votre compte.",
    confirmButton: "Confirmer l'Email",
    ignoreMessage: "Si vous n'avez pas créé de compte sur Women's Spot, veuillez ignorer cet e-mail.",
    expiryMessage: "Ce lien de confirmation expirera dans 24 heures pour des raisons de sécurité.",
    fallbackMessage: "Si le bouton ci-dessus ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    copyright: "© 2025 Women's Spot. Tous droits réservés.",
  },
  de: {
    subject: "Bestätigen Sie Ihre E-Mail - Women's Spot",
    greeting: "Hallo",
    message: "Willkommen bei Women's Spot! Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf die Schaltfläche unten klicken, um die Einrichtung Ihres Kontos abzuschließen.",
    confirmButton: "E-Mail bestätigen",
    ignoreMessage: "Wenn Sie kein Konto bei Women's Spot erstellt haben, ignorieren Sie bitte diese E-Mail.",
    expiryMessage: "Dieser Bestätigungslink läuft aus Sicherheitsgründen in 24 Stunden ab.",
    fallbackMessage: "Wenn die Schaltfläche oben nicht funktioniert, kopieren Sie diesen Link und fügen Sie ihn in Ihren Browser ein:",
    copyright: "© 2025 Women's Spot. Alle Rechte vorbehalten.",
  },
  it: {
    subject: "Conferma il tuo Email - Women's Spot",
    greeting: "Ciao",
    message: "Benvenuto su Women's Spot! Conferma il tuo indirizzo email cliccando sul pulsante qui sotto per completare la configurazione del tuo account.",
    confirmButton: "Conferma Email",
    ignoreMessage: "Se non hai creato un account su Women's Spot, ignora questa email.",
    expiryMessage: "Questo link di conferma scadrà tra 24 ore per motivi di sicurezza.",
    fallbackMessage: "Se il pulsante sopra non funziona, copia e incolla questo link nel tuo browser:",
    copyright: "© 2025 Women's Spot. Tutti i diritti riservati.",
  }
};

// Email confirmation template
const emailConfirmationTemplate = (confirmLink: string, username: string, locale: string = 'en') => {
  const t = emailTranslations[locale as keyof typeof emailTranslations] || emailTranslations.en;
  
  return {
    subject: t.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(to right, #b040b2, #f53b80); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px; color: white;">
            <span style="margin-right: 0.5em;">🤍</span>Women's Spot
          </h1>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <h2 style="color: #374151; margin-bottom: 20px;">${t.greeting} ${username}!</h2>
          
          <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
            ${t.message}
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmLink}" 
               style="background: linear-gradient(to right, #b040b2, #f53b80); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
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
            <a href="${confirmLink}" style="color: #f43f5e;">${confirmLink}</a>
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
      
      ${confirmLink}
      
      ${t.ignoreMessage}
      
      ${t.expiryMessage}
      
      ${t.copyright}
    `
  };
};

// @desc    Request new email confirmation
// @route   POST /api/v1/auth/request-email-confirmation
// @access  Public
export const POST = async (req: NextRequest) => {
  try {
    const { email } = await req.json();

    // Validate required fields
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email address",
          error: "Invalid email format"
        },
        { status: 400 }
      );
    }

    let result;
    try {
      result = await requestEmailConfirmationService(email);
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : "Unknown error";
      
      if (errorMessage.includes("already verified")) {
        return NextResponse.json(
          {
            success: false,
            message: "Email is already verified.",
            error: "Email already verified"
          },
          { status: 400 }
        );
      }
      
      throw serviceError;
    }

    // If user doesn't exist, don't reveal it for security
    if (!result.user) {
      return NextResponse.json(
        {
          success: true,
          message: "If an account with that email exists, a confirmation email has been sent."
        },
        { status: 200 }
      );
    }

    // Get user's preferred locale
    const userLocale = result.user.preferences?.language || "en";

    // Get base URL from request
    const baseUrl = getBaseUrlFromRequest(req);

    // Create confirmation link with locale and translated route
    const confirmLink = await generateEmailLink(
      "confirm-email",
      { token: result.verificationToken },
      userLocale,
      baseUrl
    );

    // Send confirmation email
    try {
      validateEmailConfig();

      const emailContent = emailConfirmationTemplate(
        confirmLink, 
        result.user.username, 
        userLocale
      );

      const mailOptions = {
        from: `"Women's Spot" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      };

      await sendEmailWithTransporter(mailOptions);

      return NextResponse.json(
        {
          success: true,
          message: "Email confirmation sent successfully. Please check your email."
        },
        { status: 200 }
      );
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);

      // Remove the verification token if email failed
      await User.findByIdAndUpdate(result.user._id, {
        verificationToken: undefined,
      });

      return NextResponse.json(
        {
          success: false,
          message: "Failed to send confirmation email. Please try again later.",
          error: emailError instanceof Error ? emailError.message : "Email sending failed"
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Request email confirmation failed:', error);
    return handleApiError("Request email confirmation failed!", error as string);
  }
};
