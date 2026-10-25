import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadProvider() {
  vi.resetModules();
  return import("../../src/communications/providers/smtpProvider.ts");
}

describe("smtpProvider", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("disables provider when SMTP_HOST/SMTP_PORT are missing", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const { getSmtpProviderState } = await loadProvider();
    const state = getSmtpProviderState();

    expect(state.enabled).toBe(false);
    expect(state.reason).toBe("missing_config");
  });

  it("enables provider for local relay without auth when host/port are set", async () => {
    process.env.SMTP_HOST = "localhost";
    process.env.SMTP_PORT = "1025";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.SMTP_FROM = "noreply@restaurant-pos.local";

    const { getSmtpProviderState } = await loadProvider();
    const state = getSmtpProviderState();

    expect(state.enabled).toBe(true);
    expect(state.fromAddress).toBe("noreply@restaurant-pos.local");
    expect(state.transport).toBeDefined();
  });

  it("uses the SMTP user as the platform from-address when SMTP_FROM is unset", async () => {
    process.env.SMTP_HOST = "localhost";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_USER = "rail@example.com";
    process.env.SMTP_PASS = "secret";
    delete process.env.SMTP_FROM;

    const { getSmtpProviderState } = await loadProvider();
    const state = getSmtpProviderState();

    expect(state.enabled).toBe(true);
    expect(state.fromAddress).toBe("rail@example.com");
  });

  it("uses the local fallback from-address when SMTP_FROM and the SMTP user are unset", async () => {
    process.env.SMTP_HOST = "localhost";
    process.env.SMTP_PORT = "1025";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;

    const { getSmtpProviderState } = await loadProvider();
    const state = getSmtpProviderState();

    expect(state.enabled).toBe(true);
    expect(state.fromAddress).toBe("no-reply@localhost");
  });

  it("leaves the provider disabled when only the retired Gmail credential pair is set", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    process.env.EMAIL_USER = "retired@gmail.com";
    process.env.EMAIL_PASSWORD = "retired-secret";

    const { getSmtpProviderState } = await loadProvider();
    const state = getSmtpProviderState();

    expect(state.enabled).toBe(false);
    expect(state.reason).toBe("missing_config");
  });

  it("keeps SMTP_FROM as the platform from-address when the retired Gmail pair is also set", async () => {
    process.env.SMTP_HOST = "localhost";
    process.env.SMTP_PORT = "1025";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.SMTP_FROM = "platform@example.com";
    process.env.EMAIL_USER = "retired@gmail.com";
    process.env.EMAIL_PASSWORD = "retired-secret";

    const { getSmtpProviderState } = await loadProvider();
    const state = getSmtpProviderState();

    expect(state.fromAddress).toBe("platform@example.com");
  });

  it("disables provider on partial auth config", async () => {
    process.env.SMTP_HOST = "localhost";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_USER = "user-only";
    delete process.env.SMTP_PASS;

    const { getSmtpProviderState } = await loadProvider();
    const state = getSmtpProviderState();

    expect(state.enabled).toBe(false);
    expect(state.reason).toBe("invalid_auth_config");
  });
});
