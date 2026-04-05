/**
 * POST /api/v1/business — Phase 4.2 confirmation email after registration
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

const sendWithRollbackMock = vi.fn();

vi.mock("../../src/auth/authEmailSend.ts", () => ({
  sendAuthTransactionalEmail: vi.fn(),
  sendAuthTransactionalEmailWithRollback: (...args: unknown[]) =>
    sendWithRollbackMock(...args),
}));

import { getTestApp, resetTestApp } from "../setup.ts";
import Business from "../../src/models/business.ts";
import { __resetAuthEmailRateLimitsForTests } from "../../src/auth/authEmailRateLimit.ts";

const validAddress = {
  country: "USA",
  state: "CA",
  city: "Los Angeles",
  street: "Main St",
  buildingNumber: "123",
  postCode: "90001",
};

function buildCreateBusinessPayload(params: {
  boundary: string;
  tradeName: string;
  legalName: string;
  email: string;
  taxNumber: string;
  password?: string;
}): string {
  const password = params.password ?? "Password123!";
  const b = params.boundary;
  return [
    `--${b}`,
    `Content-Disposition: form-data; name="tradeName"\r\n\r\n${params.tradeName}`,
    `--${b}`,
    `Content-Disposition: form-data; name="legalName"\r\n\r\n${params.legalName}`,
    `--${b}`,
    `Content-Disposition: form-data; name="email"\r\n\r\n${params.email}`,
    `--${b}`,
    `Content-Disposition: form-data; name="password"\r\n\r\n${password}`,
    `--${b}`,
    `Content-Disposition: form-data; name="phoneNumber"\r\n\r\n1234567890`,
    `--${b}`,
    `Content-Disposition: form-data; name="taxNumber"\r\n\r\n${params.taxNumber}`,
    `--${b}`,
    `Content-Disposition: form-data; name="subscription"\r\n\r\nFree`,
    `--${b}`,
    `Content-Disposition: form-data; name="currencyTrade"\r\n\r\nUSD`,
    `--${b}`,
    `Content-Disposition: form-data; name="address"\r\n\r\n${JSON.stringify(validAddress)}`,
    `--${b}--`,
  ].join("\r\n");
}

async function waitForBusinessVerificationToken(email: string): Promise<void> {
  const maxAttempts = 280;
  for (let i = 0; i < maxAttempts; i++) {
    const row = await Business.findOne({ email })
      .select("emailVerificationTokenHash")
      .lean();
    if (row?.emailVerificationTokenHash) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error("timeout waiting for business emailVerificationTokenHash");
}

async function waitForSendMockCalls(count: number): Promise<void> {
  const maxAttempts = 280;
  for (let i = 0; i < maxAttempts; i++) {
    if (sendWithRollbackMock.mock.calls.length >= count) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(`timeout waiting for ${count} send mock call(s)`);
}

describe("POST /api/v1/business (registration confirmation email)", () => {
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
    sendWithRollbackMock.mockReset();
    sendWithRollbackMock.mockResolvedValue(undefined);
    __resetAuthEmailRateLimitsForTests();
  });

  it("returns 201 with session and stores verification token (business correlation)", async () => {
    const app = await getTestApp();
    const boundary = "----brreg1";
    const tax = `TAX-BR-${Date.now()}`;
    const emailLower = `biz-${Date.now()}@example.com`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/business",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: buildCreateBusinessPayload({
        boundary,
        tradeName: "Branded Café",
        legalName: "Branded Café LLC",
        email: emailLower,
        taxNumber: tax,
      }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.user?.type).toBe("business");
    expect(body.user?.email).toBe(emailLower);

    await waitForBusinessVerificationToken(emailLower);
    expect(sendWithRollbackMock).toHaveBeenCalledTimes(1);
    const firstCall = sendWithRollbackMock.mock.calls[0]?.[0] as {
      correlationId?: string;
    };
    expect(firstCall.correlationId).toMatch(/^email-confirm-business:/);
  });

  it("normalizes email for storage and confirmation", async () => {
    const app = await getTestApp();
    const boundary = "----brreg2";
    const tax = `TAX-BR2-${Date.now()}`;
    const local = `Owner${Date.now()}`;
    const emailMixed = `${local}@EXAMPLE.COM`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/business",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: buildCreateBusinessPayload({
        boundary,
        tradeName: "Mixed Case Co",
        legalName: "Mixed Case Co LLC",
        email: emailMixed,
        taxNumber: tax,
      }),
    });

    expect(res.statusCode).toBe(201);
    const expected = `${local.toLowerCase()}@example.com`;
    expect(JSON.parse(res.body).user?.email).toBe(expected);

    const doc = await Business.findOne({ taxNumber: tax }).lean();
    expect(doc?.email).toBe(expected);

    await waitForBusinessVerificationToken(expected);
  });

  it("still returns 201 when confirmation send fails (token rolled back)", async () => {
    const app = await getTestApp();
    const boundary = "----brreg3";
    const tax = `TAX-BR3-${Date.now()}`;
    const email = `rollback-biz-${Date.now()}@example.com`;

    sendWithRollbackMock.mockImplementation(
      async (options: { rollback: () => Promise<void> }) => {
        await options.rollback();
        throw new Error("SMTP down");
      },
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/business",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: buildCreateBusinessPayload({
        boundary,
        tradeName: "Rollback Biz",
        legalName: "Rollback Biz LLC",
        email,
        taxNumber: tax,
      }),
    });

    expect(res.statusCode).toBe(201);
    await waitForSendMockCalls(1);
    const row = await Business.findOne({ email })
      .select("emailVerificationTokenHash")
      .lean();
    expect(row?.emailVerificationTokenHash).toBeFalsy();
  });
});
