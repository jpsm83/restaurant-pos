/**
 * Audit logging for the sign-in email change flow.
 *
 * Request, confirmation, and failure each leave one structured log line that
 * carries the account id and outcome and never the raw token or full address.
 * The delivery rail and the logger are mocked so the tests observe exactly
 * what the domain emits. The old-address notice uses that same rail.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
import bcrypt from "bcrypt";
import type { FastifyBaseLogger } from "fastify";

const railSendMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    channel: "email",
    success: true,
    sentCount: 1,
  }),
);

vi.mock("../../src/communications/channels/emailChannel.ts", () => ({
  default: { send: railSendMock },
}));

import {
  emailRailFailure,
  emailRailSuccess,
} from "../helpers/accountEmailRail.ts";
import { resetTestApp } from "../setup.ts";
import Business from "../../src/models/business.ts";
import {
  EMAIL_CHANGE_REQUEST_EVENT,
  EMAIL_CHANGE_CONFIRM_EVENT,
  logEmailChange,
} from "../../src/auth/emailChangeAuditLog.ts";
import { handleRequestEmailChange } from "../../src/auth/requestEmailChange.ts";
import { handleConfirmEmailChange } from "../../src/auth/confirmEmailChange.ts";
import type { AuthBusiness } from "../../src/auth/types.ts";

const testPassword = "TestPassword123!";

interface RecordingLogger {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

function recordingLogger(): RecordingLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

async function createBusiness(
  email: string,
  overrides: Record<string, unknown> = {},
) {
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  return Business.create({
    tradeName: "Audit Bistro",
    legalName: "Audit Bistro LLC",
    email,
    password: hashedPassword,
    taxNumber: `TAX-${email.replace(/[@.]/g, "-")}`,
    phoneNumber: "1234567890",
    currencyTrade: "USD",
    emailVerified: false,
    address: {
      country: "USA",
      state: "CA",
      city: "LA",
      street: "Main St",
      buildingNumber: "123",
      postCode: "90001",
    },
    ...overrides,
  });
}

function businessSession(business: { _id: unknown; email: string }): AuthBusiness {
  return {
    id: String(business._id),
    email: business.email,
    type: "business",
    role: "Tenant",
  };
}

describe("logEmailChange", () => {
  it("logs a success outcome at info with the event, account id, and outcome", () => {
    const logger = recordingLogger();
    logEmailChange(logger as unknown as FastifyBaseLogger, {
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId: "acct-1",
      outcome: "sent",
    });

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId: "acct-1",
      outcome: "sent",
    });
  });

  it("logs a failure outcome at warn", () => {
    const logger = recordingLogger();
    logEmailChange(logger as unknown as FastifyBaseLogger, {
      event: EMAIL_CHANGE_CONFIRM_EVENT,
      accountId: "acct-9",
      outcome: "invalid_token",
    });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_CONFIRM_EVENT,
      accountId: "acct-9",
      outcome: "invalid_token",
    });
  });

  it("records a null account id when none is known", () => {
    const logger = recordingLogger();
    logEmailChange(logger as unknown as FastifyBaseLogger, {
      event: EMAIL_CHANGE_CONFIRM_EVENT,
      outcome: "invalid_token",
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: null }),
    );
  });

  it("is a no-op without a logger", () => {
    expect(() =>
      logEmailChange(undefined, {
        event: EMAIL_CHANGE_REQUEST_EVENT,
        accountId: "acct-1",
        outcome: "sent",
      }),
    ).not.toThrow();
  });
});

describe("email change audit emission", () => {
  beforeAll(async () => {
    if (!process.env.APP_BASE_URL?.trim()) {
      process.env.APP_BASE_URL = "http://127.0.0.1:3000";
    }
    await resetTestApp();
  });

  afterAll(async () => {
    await resetTestApp();
  });

  beforeEach(() => {
    railSendMock.mockReset();
    railSendMock.mockResolvedValue(emailRailSuccess);
  });

  it("logs a requested outcome with the account id and no address or token", async () => {
    const logger = recordingLogger();
    const business = await createBusiness("audit-request@example.com");
    const newEmail = "audit-request-new@example.com";

    await handleRequestEmailChange(
      businessSession(business),
      { newEmail, currentPassword: testPassword },
      logger as unknown as FastifyBaseLogger,
    );

    const outcome = await Business.findById(business._id).lean();
    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logger.info).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId: String(business._id),
      outcome: "sent",
    });
    expect(logged).not.toContain(newEmail);
    expect(logged).not.toContain(String(outcome?.pendingEmailToken));
  });

  it("logs a throttled outcome when a request lands inside the cooldown", async () => {
    const logger = recordingLogger();
    const business = await createBusiness("audit-throttle@example.com", {
      pendingEmail: "audit-throttle-new@example.com",
      pendingEmailToken: "t".repeat(64),
      pendingEmailExpires: new Date(Date.now() + 3_600_000),
      pendingEmailRequestedAt: new Date(),
    });

    await handleRequestEmailChange(
      businessSession(business),
      { newEmail: "audit-throttle-second@example.com", currentPassword: testPassword },
      logger as unknown as FastifyBaseLogger,
    );

    expect(logger.warn).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId: String(business._id),
      outcome: "throttled",
    });
  });

  it("logs a failed outcome when the confirmation send fails", async () => {
    const logger = recordingLogger();
    const business = await createBusiness("audit-sendfail@example.com");
    railSendMock.mockResolvedValue(emailRailFailure);

    await handleRequestEmailChange(
      businessSession(business),
      { newEmail: "audit-sendfail-new@example.com", currentPassword: testPassword },
      logger as unknown as FastifyBaseLogger,
    );

    expect(logger.warn).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId: String(business._id),
      outcome: "send_failed",
    });
  });

  it("logs a confirmation outcome with the account id", async () => {
    const logger = recordingLogger();
    const token = "c".repeat(64);
    const business = await createBusiness("audit-confirm@example.com", {
      pendingEmail: "audit-confirm-new@example.com",
      pendingEmailToken: token,
      pendingEmailExpires: new Date(Date.now() + 3_600_000),
    });

    await handleConfirmEmailChange(token, logger as unknown as FastifyBaseLogger);

    expect(logger.info).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_CONFIRM_EVENT,
      accountId: String(business._id),
      outcome: "confirmed",
    });
  });

  it("logs a rejected confirmation outcome with a null account id and no token", async () => {
    const logger = recordingLogger();
    await createBusiness("audit-confirm-miss@example.com");

    await handleConfirmEmailChange(
      "d".repeat(64),
      logger as unknown as FastifyBaseLogger,
    );

    expect(logger.warn).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_CONFIRM_EVENT,
      accountId: null,
      outcome: "invalid_token",
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("d".repeat(64));
  });
});
