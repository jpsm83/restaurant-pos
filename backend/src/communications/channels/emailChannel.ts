import { getSmtpProviderState } from "../providers/smtpProvider.ts";
import type {
  CommunicationsChannelResult,
  EmailSendInput,
} from "../types.ts";

const LOG_PREFIX = "[communications][emailChannel]";
const PLATFORM_EMAIL_DISPLAY_NAME = "POS";
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;

const isDevEmailSinkEnabled = (): boolean =>
  process.env.AUTH_EMAIL_DEV_SINK_ENABLED === "true" &&
  process.env.NODE_ENV !== "production";

const logDevEmailSink = (payload: EmailSendInput, recipient: string) => {
  console.warn(
    `${LOG_PREFIX} DEV sink accepted email (not sent via SMTP) reason=dev_sink to=${recipient} correlationId=${payload.correlationId ?? "N/A"}`,
  );
  console.info(
    `${LOG_PREFIX} DEV sink preview subject="${payload.subject.trim()}" text="${(payload.text ?? "").trim()}"`,
  );
};

const getRetryAttempts = (): number => {
  const raw = Number(process.env.COMMUNICATIONS_EMAIL_RETRY_ATTEMPTS ?? DEFAULT_RETRY_ATTEMPTS);
  if (!Number.isFinite(raw)) return DEFAULT_RETRY_ATTEMPTS;
  return Math.max(0, Math.floor(raw));
};

const getRetryBaseDelayMs = (): number => {
  const raw = Number(
    process.env.COMMUNICATIONS_EMAIL_RETRY_BASE_DELAY_MS ?? DEFAULT_RETRY_BASE_DELAY_MS
  );
  if (!Number.isFinite(raw)) return DEFAULT_RETRY_BASE_DELAY_MS;
  return Math.max(0, Math.floor(raw));
};

const isTransientEmailError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("connection reset") ||
    message.includes("econnreset") ||
    message.includes("ehostunreach") ||
    message.includes("enotfound") ||
    message.includes("temporarily unavailable") ||
    message.includes("too many connections") ||
    message.includes("try again later")
  );
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const richPartFor = (payload: EmailSendInput): string | undefined => {
  if (payload.html?.trim()) return payload.html;
  if (!payload.text?.trim()) return undefined;
  return `<p>${escapeHtml(payload.text)}</p>`;
};

const senderNameFor = (payload: EmailSendInput): string => {
  const supplied = payload.displayName?.trim();
  return supplied || PLATFORM_EMAIL_DISPLAY_NAME;
};

const resolveRecipient = (
  to: unknown,
): { recipient: string } | { error: string } => {
  if (Array.isArray(to) || (typeof to === "string" && to.includes(","))) {
    return { error: "Email must have exactly one recipient" };
  }
  if (typeof to !== "string") {
    return { error: "No valid email recipient provided" };
  }
  const recipient = to.trim();
  if (!recipient) {
    return { error: "No valid email recipient provided" };
  }
  return { recipient };
};

const buildMetaLog = (payload: EmailSendInput): string =>
  `eventName=${payload.eventName ?? "UNKNOWN"} businessId=${payload.businessId?.toString() ?? "N/A"} recipientCount=1 correlationId=${payload.correlationId ?? "N/A"}`;

/**
 * One address per send. A delivery outcome is returned, never thrown.
 */
const send = async (payload: EmailSendInput): Promise<CommunicationsChannelResult> => {
  const resolvedRecipient = resolveRecipient(payload.to);
  if ("error" in resolvedRecipient) {
    return {
      channel: "email",
      success: false,
      sentCount: 0,
      error: resolvedRecipient.error,
    };
  }
  const recipient = resolvedRecipient.recipient;

  if (!payload.subject?.trim()) {
    return {
      channel: "email",
      success: false,
      sentCount: 0,
      error: "Email subject is required",
    };
  }

  if (!payload.text?.trim() && !payload.html?.trim()) {
    return {
      channel: "email",
      success: false,
      sentCount: 0,
      error: "Email content is required (text or html)",
    };
  }

  if (isDevEmailSinkEnabled()) {
    logDevEmailSink(payload, recipient);
    return {
      channel: "email",
      success: true,
      sentCount: 1,
    };
  }

  const smtpState = getSmtpProviderState();
  if (!smtpState.enabled || !smtpState.transport || !smtpState.fromAddress) {
    return {
      channel: "email",
      success: false,
      sentCount: 0,
      error: `SMTP unavailable (${smtpState.reason ?? "unknown"})`,
    };
  }

  const retryAttempts = getRetryAttempts();
  const retryBaseDelayMs = getRetryBaseDelayMs();

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= retryAttempts) {
    try {
      await smtpState.transport.sendMail({
        from: {
          name: senderNameFor(payload),
          address: smtpState.fromAddress,
        },
        to: recipient,
        subject: payload.subject.trim(),
        text: payload.text,
        html: richPartFor(payload),
      });

      console.info(
        `${LOG_PREFIX} Email sent ${buildMetaLog(payload)} attempt=${attempt + 1}`
      );

      return {
        channel: "email",
        success: true,
        sentCount: 1,
      };
    } catch (error) {
      lastError = error;
      const transient = isTransientEmailError(error);
      const canRetry = transient && attempt < retryAttempts;

      console.error(
        `${LOG_PREFIX} Email send failed ${buildMetaLog(payload)} attempt=${attempt + 1} transient=${transient} canRetry=${canRetry}`,
        error
      );

      if (!canRetry) break;

      const delayMs = retryBaseDelayMs * 2 ** attempt;
      await sleep(delayMs);
      attempt += 1;
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "Unknown email error";

  return {
    channel: "email",
    success: false,
    sentCount: 0,
    error: message,
  };
};

const emailChannel = { send };

export default emailChannel;

