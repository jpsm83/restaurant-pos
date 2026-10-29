import { describe, expect, it } from "vitest";
import {
  ERROR_COPY,
  getErrorCopy,
  isAlreadyVerifiedFailure,
  resolveErrorMessage,
  type ErrorCopy,
} from "../errorCopy";
import { NAMESPACES, SUPPORTED_LANGUAGES } from "../config";
import { buildLocaleResources } from "../localeResources";
import { createTestI18n } from "@/test/i18nTestUtils";
import {
  SERVICE_ERROR_OUTCOMES,
  SERVICE_OPERATIONS,
  type ServiceErrorCode,
  type ServiceFailure,
} from "@/services/serviceErrors";

const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../locales/*/*.json",
  { eager: true },
);
const locales = buildLocaleResources(localeModules, NAMESPACES);

function allCodes(): ServiceErrorCode[] {
  return SERVICE_OPERATIONS.flatMap((operation) =>
    SERVICE_ERROR_OUTCOMES.map(
      (outcome) => `${operation}.${outcome}` as ServiceErrorCode,
    ),
  );
}

function readByPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function localeValue(resource: unknown, key: string): unknown {
  const direct = readByPath(resource, key);
  if (direct !== undefined) return direct;

  const one = readByPath(resource, `${key}_one`);
  const other = readByPath(resource, `${key}_other`);
  return typeof one === "string" && typeof other === "string" ? other : undefined;
}

function failure(code: ServiceErrorCode): ServiceFailure {
  return { code, status: 409 };
}

describe("ERROR_COPY", () => {
  it("has an entry for every operation and outcome code", () => {
    for (const code of allCodes()) {
      expect(ERROR_COPY[code], code).toBeDefined();
    }
  });

  it("maps every code to a key that exists in both languages", () => {
    for (const code of allCodes()) {
      const copy = getErrorCopy(failure(code));
      expect(NAMESPACES, `${code} namespace`).toContain(copy.namespace);

      for (const language of SUPPORTED_LANGUAGES) {
        expect(
          typeof localeValue(locales[language]?.[copy.namespace], copy.key),
          `${language}/${copy.namespace}.${copy.key}`,
        ).toBe("string");
      }
    }
  });

  it("returns namespace, key, and interpolation values", () => {
    const copy: ErrorCopy = getErrorCopy({
      code: "businessUpdate.conflict",
      status: 409,
    });

    expect(copy).toEqual({
      namespace: "business",
      key: "errors.updateConflict",
      values: {},
    });
  });

  it("supplies interpolation values used by the copy", () => {
    expect(
      getErrorCopy({
        code: "businessUpdate.validation",
        status: 400,
        fieldErrors: [
          { field: "email", message: "Required" },
          { field: "city", message: "Invalid" },
        ],
      }),
    ).toEqual({
      namespace: "errors",
      key: "api.validation",
      values: { count: 2 },
    });
  });

  it("uses surface-specific overrides where the generic copy is wrong", () => {
    expect(getErrorCopy(failure("signIn.unauthorized"))).toMatchObject({
      namespace: "auth",
      key: "api.invalidCredentials",
    });
    expect(getErrorCopy(failure("signUp.conflict"))).toMatchObject({
      namespace: "auth",
      key: "api.emailInUse",
    });
    expect(getErrorCopy(failure("googleAuth.unauthorized"))).toMatchObject({
      namespace: "auth",
      key: "api.googleAuthFailed",
    });
    expect(getErrorCopy(failure("googleAuth.conflict"))).toMatchObject({
      namespace: "auth",
      key: "api.googleEmailConflict",
    });
    expect(getErrorCopy(failure("confirmEmail.badRequest"))).toMatchObject({
      namespace: "auth",
      key: "api.invalidConfirmationLink",
    });
    expect(getErrorCopy(failure("passwordReset.validation"))).toMatchObject({
      namespace: "auth",
      key: "api.invalidResetLink",
    });
    expect(
      getErrorCopy(failure("resendConfirmation.badRequest")),
    ).toMatchObject({
      namespace: "auth",
      key: "api.emailAlreadyVerified",
    });
    expect(getErrorCopy(failure("businessFetch.notFound"))).toMatchObject({
      namespace: "business",
      key: "errors.notFound",
    });
    expect(getErrorCopy(failure("modeSave.forbidden"))).toMatchObject({
      namespace: "mode",
      key: "errors.notAllowed",
    });
  });

  it("keeps generic Google failure copy for non-conflict outcomes", () => {
    const nonConflictCodes = allCodes().filter(
      (code) => code.startsWith("googleAuth.") && code !== "googleAuth.conflict",
    );

    expect(nonConflictCodes.length).toBeGreaterThan(0);
    for (const code of nonConflictCodes) {
      expect(getErrorCopy(failure(code)), code).toMatchObject({
        namespace: "auth",
        key: "api.googleAuthFailed",
      });
    }
  });

  it("detects the already-verified outcome by machine code", () => {
    expect(
      isAlreadyVerifiedFailure({ code: "resendConfirmation.badRequest" }),
    ).toBe(true);
    expect(
      isAlreadyVerifiedFailure({ code: "resendConfirmation.unauthorized" }),
    ).toBe(false);
    expect(isAlreadyVerifiedFailure(null)).toBe(false);
  });

  it("falls back to generic transport copy for an unknown runtime code", () => {
    expect(
      getErrorCopy({ code: "not.a.real.code" as ServiceErrorCode }),
    ).toEqual({
      namespace: "errors",
      key: "api.transport",
      values: {},
    });
  });
});

describe("resolveErrorMessage", () => {
  it("renders the localized copy for the active language", async () => {
    const english = await createTestI18n("en");
    const spanish = await createTestI18n("es");
    const transport = failure("tableConfigLoad.transport");

    const enText = resolveErrorMessage(transport, english.t.bind(english));
    const esText = resolveErrorMessage(transport, spanish.t.bind(spanish));

    expect(enText).toBe(
      "We could not reach the server. Check your connection and try again.",
    );
    expect(esText).toBe(
      "No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.",
    );
    expect(esText).not.toBe(enText);
  });
});
