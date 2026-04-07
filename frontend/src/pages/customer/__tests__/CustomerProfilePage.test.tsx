import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import CustomerProfilePage from "../CustomerProfilePage";

const mockUseAuth = vi.fn();
const mockResendEmailConfirmation = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/auth/api", () => ({
  resendEmailConfirmation: (...args: unknown[]) => mockResendEmailConfirmation(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe("CustomerProfilePage", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockResendEmailConfirmation.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });
  });

  it("renders placeholder when verification banner is not needed", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/u1/customer/profile"]}>
        <Routes>
          <Route path="/:userId/customer/profile" element={<CustomerProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("resends email confirmation for unverified authenticated user", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: {
          id: "u1",
          email: "u@test.local",
          type: "user",
          role: "Customer",
          emailVerified: false,
        },
        error: null,
      },
    });
    mockResendEmailConfirmation.mockResolvedValue({
      ok: true,
      data: { message: "resent" },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/u1/customer/profile"]}>
        <Routes>
          <Route path="/:userId/customer/profile" element={<CustomerProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    await waitFor(() => {
      expect(mockResendEmailConfirmation).toHaveBeenCalledTimes(1);
      expect(toastSuccess).toHaveBeenCalled();
    });
  });
});
