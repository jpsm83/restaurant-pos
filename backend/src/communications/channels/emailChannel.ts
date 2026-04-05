import { getSmtpProviderState } from "../providers/smtpProvider.ts";
import type {
  CommunicationsChannelResult,
  EmailSendInput,
} from "../types.ts";

const LOG_PREFIX = "[communications][emailChannel]";
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 250;

const isDevEmailSinkEnabled = (): boolean =>
  process.env.AUTH_EMAIL_DEV_SINK_ENABLED === "true" &&
  process.env.NODE_ENV !== "production";

const logDevEmailSink = (
  payload: EmailSendInput,
  recipients: string[],
  fallbackReason: string,
) => {
  console.warn(
    `${LOG_PREFIX} DEV sink accepted email (not sent via SMTP) reason=${fallbackReason} to=${recipients.join(",")} correlationId=${payload.correlationId ?? "N/A"}`,
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
  return Math.max(50, Math.floor(raw));
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

const toRecipientsArray = (to: string | string[]): string[] => {
  const rawRecipients = Array.isArray(to) ? to : [to];
  return rawRecipients.map((item) => item.trim()).filter(Boolean);
};

const buildMetaLog = (payload: EmailSendInput, recipientCount: number): string =>
  `eventName=${payload.eventName ?? "UNKNOWN"} businessId=${payload.businessId?.toString() ?? "N/A"} recipientCount=${recipientCount} correlationId=${payload.correlationId ?? "N/A"}`;

/**
 * Sends email using shared SMTP provider.
 * - Uses normalized payload.
 * - Returns channel result instead of throwing in fire-and-forget mode.
 */
const send = async (payload: EmailSendInput): Promise<CommunicationsChannelResult> => {
  const recipients = toRecipientsArray(payload.to);
  const recipientCount = recipients.length;

  if (recipientCount === 0) {
    return {
      channel: "email",
      success: false,
      sentCount: 0,
      error: "No valid email recipients provided",
    };
  }

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

  const smtpState = getSmtpProviderState();
  if (!smtpState.enabled || !smtpState.transport || !smtpState.fromAddress) {
    if (isDevEmailSinkEnabled()) {
      logDevEmailSink(
        payload,
        recipients,
        `smtp_unavailable:${smtpState.reason ?? "unknown"}`,
      );
      return {
        channel: "email",
        success: true,
        sentCount: recipientCount,
      };
    }
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
        from: smtpState.fromAddress,
        to: recipients,
        subject: payload.subject.trim(),
        text: payload.text,
        html: payload.html,
      });

      console.info(
        `${LOG_PREFIX} Email sent ${buildMetaLog(payload, recipientCount)} attempt=${attempt + 1}`
      );

      return {
        channel: "email",
        success: true,
        sentCount: recipientCount,
      };
    } catch (error) {
      lastError = error;
      const transient = isTransientEmailError(error);
      const canRetry = transient && attempt < retryAttempts;

      console.error(
        `${LOG_PREFIX} Email send failed ${buildMetaLog(payload, recipientCount)} attempt=${attempt + 1} transient=${transient} canRetry=${canRetry}`,
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

  const result: CommunicationsChannelResult = {
    channel: "email",
    success: false,
    sentCount: 0,
    error: message,
  };

  if (isDevEmailSinkEnabled()) {
    logDevEmailSink(payload, recipients, `smtp_send_error:${message}`);
    return {
      channel: "email",
      success: true,
      sentCount: recipientCount,
    };
  }

  if (payload.fireAndForget) {
    return result;
  }

  throw (lastError ?? new Error(message));
};

const emailChannel = { send };

export default emailChannel;

