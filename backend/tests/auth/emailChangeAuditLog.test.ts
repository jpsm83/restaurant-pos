/**
 * Audit logging for the sign-in email change flow.
 *
 * A successful request and confirmation each append one entry to the
 * append-only audit rail and write no success process-log line. Failures stay
 * on the process log and append nothing. Neither the log nor the entry ever
 * carries the raw token or full address. The delivery rail and the logger are
 * mocked so the tests observe exactly what the domain emits; the old-address
 * notice uses that same rail. The append operation is wrapped so a failed
 * append can be proved to leave the completed change in place.
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
import mongoose from "mongoose";

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

const appendAuditEntryMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/audit/appendAuditEntry.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/audit/appendAuditEntry.ts")>();
  appendAuditEntryMock.mockImplementation(actual.appendAuditEntry);
  return { ...actual, appendAuditEntry: appendAuditEntryMock };
});

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
import {
  AUDIT_ACT_KINDS,
  AUDIT_ACTOR_KINDS,
  AUDIT_TARGET_KINDS,
} from "../../src/audit/auditCatalogue.ts";
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

interface RawAuditEntry {
  actorKind?: string;
  actorId?: unknown;
  actKind?: string;
  target?: { kind?: string; id?: unknown };
  businessId?: unknown;
  occurredAt?: Date;
  payload?: unknown;
}

async function auditEntries(): Promise<RawAuditEntry[]> {
  return (await mongoose.connection
    .collection("auditentries")
    .find({})
    .toArray()) as unknown as RawAuditEntry[];
}

describe("logEmailChange", () => {
  it("does not write a success process-log line", () => {
    const logger = recordingLogger();
    logEmailChange(logger as unknown as FastifyBaseLogger, {
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId: "acct-1",
      outcome: "sent",
    });
    logEmailChange(logger as unknown as FastifyBaseLogger, {
      event: EMAIL_CHANGE_CONFIRM_EVENT,
      accountId: "acct-1",
      outcome: "confirmed",
    });

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
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
    appendAuditEntryMock.mockClear();
  });

  it("appends one request entry for the signed-in Business and no success log line", async () => {
    const logger = recordingLogger();
    const business = await createBusiness("audit-request@example.com");
    const newEmail = "audit-request-new@example.com";

    const result = await handleRequestEmailChange(
      businessSession(business),
      { newEmail, currentPassword: testPassword },
      logger as unknown as FastifyBaseLogger,
    );

    expect(result.kind).toBe("success_200");
    expect(appendAuditEntryMock).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();

    const outcome = await Business.findById(business._id).lean();
    const entries = await auditEntries();
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.actorKind).toBe(AUDIT_ACTOR_KINDS.BUSINESS);
    expect(String(entry.actorId)).toBe(String(business._id));
    expect(entry.actKind).toBe(AUDIT_ACT_KINDS.EMAIL_CHANGE_REQUESTED);
    expect(entry.target?.kind).toBe(AUDIT_TARGET_KINDS.BUSINESS);
    expect(String(entry.target?.id)).toBe(String(business._id));
    expect(String(entry.businessId)).toBe(String(business._id));
    expect(entry.occurredAt).toBeInstanceOf(Date);
    expect(entry.payload).toEqual({ outcome: "sent" });

    const stored = JSON.stringify(entry);
    expect(stored).not.toContain(newEmail);
    expect(stored).not.toContain(String(outcome?.pendingEmailToken));
  });

  it("appends one confirmation entry for the Business whose token was consumed", async () => {
    const logger = recordingLogger();
    const token = "c".repeat(64);
    const oldEmail = "audit-confirm@example.com";
    const newEmail = "audit-confirm-new@example.com";
    const business = await createBusiness(oldEmail, {
      pendingEmail: newEmail,
      pendingEmailToken: token,
      pendingEmailExpires: new Date(Date.now() + 3_600_000),
    });

    const result = await handleConfirmEmailChange(
      token,
      logger as unknown as FastifyBaseLogger,
    );

    expect(result.kind).toBe("success_200");
    expect(appendAuditEntryMock).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();

    const entries = await auditEntries();
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.actorKind).toBe(AUDIT_ACTOR_KINDS.BUSINESS);
    expect(String(entry.actorId)).toBe(String(business._id));
    expect(entry.actKind).toBe(AUDIT_ACT_KINDS.EMAIL_CHANGE_CONFIRMED);
    expect(entry.target?.kind).toBe(AUDIT_TARGET_KINDS.BUSINESS);
    expect(String(entry.target?.id)).toBe(String(business._id));
    expect(String(entry.businessId)).toBe(String(business._id));
    expect(entry.occurredAt).toBeInstanceOf(Date);
    expect(entry.payload).toEqual({ outcome: "confirmed" });

    const stored = JSON.stringify(entry);
    expect(stored).not.toContain(token);
    expect(stored).not.toContain(oldEmail);
    expect(stored).not.toContain(newEmail);
  });

  it("logs a wrong-password outcome and appends nothing", async () => {
    const logger = recordingLogger();
    const business = await createBusiness("audit-wrongpass@example.com");

    await handleRequestEmailChange(
      businessSession(business),
      {
        newEmail: "audit-wrongpass-new@example.com",
        currentPassword: "WrongPassword123!",
      },
      logger as unknown as FastifyBaseLogger,
    );

    expect(logger.warn).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId: String(business._id),
      outcome: "invalid_password",
    });
    expect(appendAuditEntryMock).not.toHaveBeenCalled();
    expect(await auditEntries()).toHaveLength(0);
  });

  it("logs a same-email outcome and appends nothing", async () => {
    const logger = recordingLogger();
    const business = await createBusiness("audit-same@example.com");

    await handleRequestEmailChange(
      businessSession(business),
      { newEmail: "audit-same@example.com", currentPassword: testPassword },
      logger as unknown as FastifyBaseLogger,
    );

    expect(logger.warn).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId: String(business._id),
      outcome: "same_email",
    });
    expect(appendAuditEntryMock).not.toHaveBeenCalled();
    expect(await auditEntries()).toHaveLength(0);
  });

  it("logs a taken-email outcome and appends nothing", async () => {
    const logger = recordingLogger();
    const business = await createBusiness("audit-taken@example.com");
    await createBusiness("audit-taken-other@example.com");

    await handleRequestEmailChange(
      businessSession(business),
      {
        newEmail: "audit-taken-other@example.com",
        currentPassword: testPassword,
      },
      logger as unknown as FastifyBaseLogger,
    );

    expect(logger.warn).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId: String(business._id),
      outcome: "email_taken",
    });
    expect(appendAuditEntryMock).not.toHaveBeenCalled();
    expect(await auditEntries()).toHaveLength(0);
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
    expect(appendAuditEntryMock).not.toHaveBeenCalled();
    expect(await auditEntries()).toHaveLength(0);
  });

  it("logs a send-failed outcome when the confirmation send fails", async () => {
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
    expect(appendAuditEntryMock).not.toHaveBeenCalled();
    expect(await auditEntries()).toHaveLength(0);
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
    expect(appendAuditEntryMock).not.toHaveBeenCalled();
    expect(await auditEntries()).toHaveLength(0);
  });

  it("logs a handler error and appends nothing", async () => {
    const logger = recordingLogger();
    const token = "f".repeat(64);
    await createBusiness("audit-handler-error@example.com", {
      pendingEmail: "audit-handler-error-new@example.com",
      pendingEmailToken: token,
      pendingEmailExpires: new Date(Date.now() + 3_600_000),
    });
    const updateOneSpy = vi
      .spyOn(Business, "updateOne")
      .mockRejectedValueOnce(new Error("boom"));

    const result = await handleConfirmEmailChange(
      token,
      logger as unknown as FastifyBaseLogger,
    );
    updateOneSpy.mockRestore();

    expect(result.kind).toBe("server_error_500");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "error" }),
    );
    expect(appendAuditEntryMock).not.toHaveBeenCalled();
    expect(await auditEntries()).toHaveLength(0);
  });

  it("keeps a completed request in place and logs when the append fails", async () => {
    const logger = recordingLogger();
    const business = await createBusiness("audit-request-appendfail@example.com");
    const newEmail = "audit-request-appendfail-new@example.com";
    appendAuditEntryMock.mockResolvedValueOnce({
      success: false,
      error: "audit unavailable",
    });

    const result = await handleRequestEmailChange(
      businessSession(business),
      { newEmail, currentPassword: testPassword },
      logger as unknown as FastifyBaseLogger,
    );

    expect(result.kind).toBe("success_200");
    const stored = await Business.findById(business._id).lean();
    expect(stored?.pendingEmail).toBe(newEmail);
    expect(stored?.pendingEmailToken).toBeTruthy();
    expect(logger.warn).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_REQUEST_EVENT,
      accountId: String(business._id),
      outcome: "audit_append_failed",
    });
    expect(logger.info).not.toHaveBeenCalled();
    expect(await auditEntries()).toHaveLength(0);
  });

  it("keeps a completed confirmation in place and logs when the append fails", async () => {
    const logger = recordingLogger();
    const token = "a".repeat(64);
    const oldEmail = "audit-confirm-appendfail@example.com";
    const newEmail = "audit-confirm-appendfail-new@example.com";
    const business = await createBusiness(oldEmail, {
      pendingEmail: newEmail,
      pendingEmailToken: token,
      pendingEmailExpires: new Date(Date.now() + 3_600_000),
    });
    appendAuditEntryMock.mockResolvedValueOnce({
      success: false,
      error: "audit unavailable",
    });

    const result = await handleConfirmEmailChange(
      token,
      logger as unknown as FastifyBaseLogger,
    );

    expect(result.kind).toBe("success_200");
    const stored = await Business.findById(business._id).lean();
    expect(stored?.email).toBe(newEmail);
    expect(stored?.emailVerified).toBe(true);
    expect(stored?.pendingEmail).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith({
      event: EMAIL_CHANGE_CONFIRM_EVENT,
      accountId: String(business._id),
      outcome: "audit_append_failed",
    });
    expect(logger.info).not.toHaveBeenCalled();
    expect(await auditEntries()).toHaveLength(0);
  });
});
