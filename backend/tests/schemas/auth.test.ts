import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  confirmEmailBodySchema,
  loginBodySchema,
  requestEmailConfirmationBodySchema,
  requestPasswordResetBodySchema,
  resetPasswordBodySchema,
  setModeBodySchema,
  signupBodySchema,
} from "../../../packages/schemas/auth.ts";
import { PASSWORD_POLICY_MESSAGE } from "../../../packages/utils/passwordPolicy.ts";

const SERVER_OWNED_FIELDS = [
  "verificationToken",
  "resetPasswordToken",
  "resetPasswordExpires",
  "refreshSessionVersion",
  "emailVerified",
] as const;

describe("signupBodySchema", () => {
  const valid = {
    email: "New.User@Example.COM",
    password: "TestPass1!",
  };

  it("normalizes the email (trim + lowercase)", () => {
    const parsed = signupBodySchema.parse({
      ...valid,
      email: "  New.User@Example.COM ",
    });
    expect(parsed.email).toBe("new.user@example.com");
  });

  it("rejects a malformed email", () => {
    expect(signupBodySchema.safeParse({ ...valid, email: "nope" }).success).toBe(
      false,
    );
  });

  it("enforces the password policy", () => {
    const result = signupBodySchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(PASSWORD_POLICY_MESSAGE);
    }
  });

  it("treats the profile names as optional", () => {
    expect(signupBodySchema.safeParse(valid).success).toBe(true);
  });

  it("sanitizes profile names", () => {
    const parsed = signupBodySchema.parse({
      ...valid,
      username: "  <b>Pat</b>\u0000  ",
      firstName: "Pat",
      lastName: "Lee",
    });
    expect(parsed.username).toBe("Pat");
  });

  it.each(SERVER_OWNED_FIELDS)("rejects server-owned field %s", (field) => {
    const result = signupBodySchema.safeParse({ ...valid, [field]: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      signupBodySchema.safeParse({ ...valid, isAdmin: true }).success,
    ).toBe(false);
  });
});

describe("loginBodySchema", () => {
  it("normalizes the email", () => {
    expect(
      loginBodySchema.parse({ email: "  A@B.COM ", password: "x" }).email,
    ).toBe("a@b.com");
  });

  it("accepts any non-empty password (no policy on login)", () => {
    expect(loginBodySchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(
      true,
    );
  });

  it("rejects a blank password", () => {
    expect(
      loginBodySchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("requestEmailConfirmationBodySchema", () => {
  it("requires a valid email", () => {
    expect(
      requestEmailConfirmationBodySchema.safeParse({ email: "a@b.com" }).success,
    ).toBe(true);
    expect(requestEmailConfirmationBodySchema.safeParse({}).success).toBe(false);
    expect(
      requestEmailConfirmationBodySchema.safeParse({ email: "nope" }).success,
    ).toBe(false);
  });
});

describe("requestPasswordResetBodySchema", () => {
  it("requires a valid email", () => {
    expect(
      requestPasswordResetBodySchema.safeParse({ email: "a@b.com" }).success,
    ).toBe(true);
    expect(requestPasswordResetBodySchema.safeParse({}).success).toBe(false);
  });
});

describe("confirmEmailBodySchema", () => {
  it("trims the token", () => {
    expect(confirmEmailBodySchema.parse({ token: "  abc  " }).token).toBe("abc");
  });

  it("rejects a blank token", () => {
    const result = confirmEmailBodySchema.safeParse({ token: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Please provide a confirmation token.",
      );
    }
  });

  it("rejects a missing token with the same message", () => {
    const result = confirmEmailBodySchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Please provide a confirmation token.",
      );
    }
  });
});

describe("resetPasswordBodySchema", () => {
  it("requires a token", () => {
    const result = resetPasswordBodySchema.safeParse({
      token: "",
      newPassword: "TestPass1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Please provide a reset token.",
      );
    }
  });

  it("rejects a missing token with the same message", () => {
    const result = resetPasswordBodySchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Please provide a reset token.",
      );
    }
  });

  it("requires a new password", () => {
    const result = resetPasswordBodySchema.safeParse({
      token: "abc",
      newPassword: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Please provide a new password.",
      );
    }
  });

  it("enforces the password policy", () => {
    const result = resetPasswordBodySchema.safeParse({
      token: "abc",
      newPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(PASSWORD_POLICY_MESSAGE);
    }
  });

  it("accepts a valid token and password", () => {
    expect(
      resetPasswordBodySchema.safeParse({
        token: "abc",
        newPassword: "TestPass1!",
      }).success,
    ).toBe(true);
  });
});

describe("setModeBodySchema", () => {
  it.each(["customer", "employee"])("accepts %s", (mode) => {
    expect(setModeBodySchema.safeParse({ mode }).success).toBe(true);
  });

  it("rejects an unknown mode", () => {
    const result = setModeBodySchema.safeParse({ mode: "invalid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Mode must be 'customer' or 'employee'",
      );
    }
  });
});

describe("server-owned fields are excluded from every auth DTO", () => {
  const dtoSchemas: Record<string, z.ZodObject> = {
    signupBodySchema,
    loginBodySchema,
    requestEmailConfirmationBodySchema,
    requestPasswordResetBodySchema,
    confirmEmailBodySchema,
    resetPasswordBodySchema,
    setModeBodySchema,
  };

  it.each(Object.entries(dtoSchemas))("%s has no server-owned key", (_name, schema) => {
    const keys = Object.keys(schema.shape);
    for (const owned of SERVER_OWNED_FIELDS) {
      expect(keys).not.toContain(owned);
    }
  });
});
