import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChangeBusinessEmailController } from "@/hooks/useChangeBusinessEmailController";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { ChangeEmailDialog } from "../ChangeEmailDialog";

function controller(
  overrides: Partial<ChangeBusinessEmailController> = {},
): ChangeBusinessEmailController {
  return {
    open: true,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    register: (() => ({})) as unknown as ChangeBusinessEmailController["register"],
    fieldErrors: {},
    isSubmitting: false,
    submitError: null,
    pendingEmail: null,
    onSubmit: vi.fn(),
    ...overrides,
  };
}

describe("ChangeEmailDialog", () => {
  it("renders a localized submission error through the shared resolver", async () => {
    await renderWithI18n(
      <ChangeEmailDialog
        controller={controller({
          submitError: { code: "emailChange.conflict", status: 409 },
        })}
      />,
      { language: "es" },
    );

    expect(
      screen.getByText("Esa dirección de correo ya la usa otra cuenta."),
    ).toBeInTheDocument();
  });
});
