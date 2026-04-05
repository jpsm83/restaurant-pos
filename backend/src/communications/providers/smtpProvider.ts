import nodemailer, { type Transporter } from "nodemailer";

interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from?: string;
}

export interface SmtpProviderState {
  enabled: boolean;
  reason?:
    | "missing_config"
    | "invalid_port"
    | "invalid_auth_config"
    | "transport_init_failed";
  fromAddress?: string;
  transport?: Transporter;
}

let cachedTransport: Transporter | null = null;
let cachedState: SmtpProviderState | null = null;

const LOG_PREFIX = "[communications][smtpProvider]";

const readRawConfig = () => {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const portRaw = process.env.SMTP_PORT?.trim() ?? "";
  const user = process.env.SMTP_USER?.trim() || undefined;
  const pass = process.env.SMTP_PASS?.trim() || undefined;
  const from = process.env.SMTP_FROM?.trim() || undefined;

  return { host, portRaw, user, pass, from };
};

const buildConfig = (): { config?: SmtpConfig; reason?: SmtpProviderState["reason"] } => {
  const raw = readRawConfig();

  if (!raw.host || !raw.portRaw) {
    return { reason: "missing_config" };
  }

  const hasUser = typeof raw.user === "string";
  const hasPass = typeof raw.pass === "string";
  if (hasUser !== hasPass) {
    return { reason: "invalid_auth_config" };
  }

  const parsedPort = Number(raw.portRaw);
  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    return { reason: "invalid_port" };
  }

  return {
    config: {
      host: raw.host,
      port: parsedPort,
      user: raw.user,
      pass: raw.pass,
      from: raw.from,
    },
  };
};

const warnDisabled = (reason: Exclude<SmtpProviderState["reason"], undefined>) => {
  if (reason === "missing_config") {
    console.warn(
      `${LOG_PREFIX} SMTP disabled: missing SMTP_HOST/SMTP_PORT.`
    );
    return;
  }

  if (reason === "invalid_port") {
    console.warn(`${LOG_PREFIX} SMTP disabled: SMTP_PORT is invalid.`);
    return;
  }

  if (reason === "invalid_auth_config") {
    console.warn(
      `${LOG_PREFIX} SMTP disabled: SMTP_USER and SMTP_PASS must both be set or both be empty.`
    );
    return;
  }

  console.warn(`${LOG_PREFIX} SMTP disabled: transport initialization failed.`);
};

/**
 * Returns a singleton SMTP transport and config state.
 * - Validates configuration once.
 * - Creates transport once (lazy).
 * - Reuses transport across all callers.
 * - Caches disabled state as well; env changes require process restart.
 */
export const getSmtpProviderState = (): SmtpProviderState => {
  if (cachedState) return cachedState;

  const { config, reason } = buildConfig();

  if (!config || reason) {
    const finalReason = reason ?? "missing_config";
    warnDisabled(finalReason);
    cachedState = { enabled: false, reason: finalReason };
    return cachedState;
  }

  try {
    cachedTransport =
      cachedTransport ??
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        ...(config.user && config.pass
          ? { auth: { user: config.user, pass: config.pass } }
          : {}),
      });

    cachedState = {
      enabled: true,
      transport: cachedTransport,
      fromAddress: config.from ?? config.user ?? "no-reply@localhost",
    };
    return cachedState;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to initialize SMTP transport`, error);
    cachedState = { enabled: false, reason: "transport_init_failed" };
    return cachedState;
  }
};

