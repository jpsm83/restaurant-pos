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
