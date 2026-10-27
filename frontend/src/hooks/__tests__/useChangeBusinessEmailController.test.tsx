import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChangeBusinessEmailController } from "../useChangeBusinessEmailController";

const mockRequestEmailChange = vi.fn();

vi.mock("@/auth/api", () => ({
  requestEmailChange: (...args: unknown[]) => mockRequestEmailChange(...args),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => `mock:${key}`,
  }),
}));

const CURRENT_EMAIL = "owner@demo.test";

describe("useChangeBusinessEmailController", () => {
  beforeEach(() => {
    mockRequestEmailChange.mockReset();
  });

  it("starts closed with no pending address", () => {
    const { result } = renderHook(() =>
      useChangeBusinessEmailController(CURRENT_EMAIL),
    );

    expect(result.current.open).toBe(false);
    expect(result.current.pendingEmail).toBeNull();
    expect(result.current.submitError).toBeNull();
  });

  it("opens the dialog and clears transient state", () => {
    const { result } = renderHook(() =>
      useChangeBusinessEmailController(CURRENT_EMAIL),
    );

    act(() => result.current.openDialog());

    expect(result.current.open).toBe(true);
    expect(result.current.submitError).toBeNull();
    expect(result.current.pendingEmail).toBeNull();
  });

  it("rejects an invalid new email", async () => {
    const { result } = renderHook(() =>
      useChangeBusinessEmailController(CURRENT_EMAIL),
    );

    act(() => result.current.openDialog());
    await act(async () => {
      result.current.register("newEmail").onChange({
        target: { name: "newEmail", value: "not-an-email" },
      });
      result.current.register("currentPassword").onChange({
        target: { name: "currentPassword", value: "CurrentPass1!" },
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => {
      expect(result.current.fieldErrors.newEmail).toBe(
        "mock:profileSettings.changeEmail.errors.invalidEmail",
      );
    });
    expect(mockRequestEmailChange).not.toHaveBeenCalled();
  });

  it("requires the current password", async () => {
    const { result } = renderHook(() =>
      useChangeBusinessEmailController(CURRENT_EMAIL),
    );

    act(() => result.current.openDialog());
    await act(async () => {
      result.current.register("newEmail").onChange({
        target: { name: "newEmail", value: "new@demo.test" },
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => {
      expect(result.current.fieldErrors.currentPassword).toBe(
        "mock:profileSettings.changeEmail.errors.currentPasswordRequired",
      );
    });
    expect(mockRequestEmailChange).not.toHaveBeenCalled();
  });

  it("rejects an address identical to the current sign-in email", async () => {
    const { result } = renderHook(() =>
      useChangeBusinessEmailController(CURRENT_EMAIL),
    );

    act(() => result.current.openDialog());
    await act(async () => {
      result.current.register("newEmail").onChange({
        target: { name: "newEmail", value: CURRENT_EMAIL.toUpperCase() },
      });
      result.current.register("currentPassword").onChange({
        target: { name: "currentPassword", value: "CurrentPass1!" },
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => {
      expect(result.current.fieldErrors.newEmail).toBe(
        "mock:profileSettings.changeEmail.errors.sameEmail",
      );
    });
    expect(mockRequestEmailChange).not.toHaveBeenCalled();
  });

  it("submits trimmed values, records the pending address, and clears the form", async () => {
    mockRequestEmailChange.mockResolvedValue({ ok: true, data: { message: "Sent" } });
    const { result } = renderHook(() =>
      useChangeBusinessEmailController(CURRENT_EMAIL),
    );

    act(() => result.current.openDialog());
    await act(async () => {
      result.current.register("newEmail").onChange({
        target: { name: "newEmail", value: "  new@demo.test  " },
      });
      result.current.register("currentPassword").onChange({
        target: { name: "currentPassword", value: "CurrentPass1!" },
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    expect(mockRequestEmailChange).toHaveBeenCalledWith(
      "new@demo.test",
      "CurrentPass1!",
    );
    await waitFor(() => {
      expect(result.current.pendingEmail).toBe("new@demo.test");
    });
    expect(result.current.submitError).toBeNull();
    expect(result.current.open).toBe(true);
  });

  it("surfaces a wrong-password / duplicate / network error from the request", async () => {
    mockRequestEmailChange.mockResolvedValue({
      ok: false,
      error: {
        code: "emailChange.unauthorized",
        status: 401,
        message: "Current password is incorrect.",
        serverMessage: "Current password is incorrect.",
        fieldErrors: [],
      },
    });
    const { result } = renderHook(() =>
      useChangeBusinessEmailController(CURRENT_EMAIL),
    );

    act(() => result.current.openDialog());
    await act(async () => {
      result.current.register("newEmail").onChange({
        target: { name: "newEmail", value: "new@demo.test" },
      });
      result.current.register("currentPassword").onChange({
        target: { name: "currentPassword", value: "wrong" },
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => {
      expect(result.current.submitError).toBe("Current password is incorrect.");
    });
    expect(result.current.pendingEmail).toBeNull();
  });

  it("clears the previous pending address when the dialog is reopened", async () => {
    mockRequestEmailChange.mockResolvedValue({ ok: true, data: { message: "Sent" } });
    const { result } = renderHook(() =>
      useChangeBusinessEmailController(CURRENT_EMAIL),
    );

    act(() => result.current.openDialog());
    await act(async () => {
      result.current.register("newEmail").onChange({
        target: { name: "newEmail", value: "new@demo.test" },
      });
      result.current.register("currentPassword").onChange({
        target: { name: "currentPassword", value: "CurrentPass1!" },
      });
    });
    await act(async () => {
      await result.current.onSubmit();
    });
    await waitFor(() => {
      expect(result.current.pendingEmail).toBe("new@demo.test");
    });

    act(() => result.current.closeDialog());
    act(() => result.current.openDialog());

    expect(result.current.pendingEmail).toBeNull();
  });
});
