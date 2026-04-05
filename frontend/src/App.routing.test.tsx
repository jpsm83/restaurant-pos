import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { renderWithI18n } from "@/test/i18nTestUtils";

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      user: null,
      status: "unauthenticated",
      error: null,
    },
    dispatch: vi.fn(),
  }),
}));

vi.mock("@/services/business/businessService", () => ({
  useCreateBusinessMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("App public routing (Phase 1.5.1)", () => {
  it("renders `/` customer marketing when anonymous", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /for customers/i }),
    ).toBeInTheDocument();
  });

  it("renders `/business` marketing when anonymous", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /for restaurants and bars/i }),
    ).toBeInTheDocument();
  });

  it("renders NotFoundPage for unknown routes", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/this-route-does-not-exist"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it("renders BusinessRegisterPage for `/business/signup`", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/signup"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /register your business/i }),
    ).toBeInTheDocument();
  });

  it("renders ForgotPasswordPage for `/forgot-password`", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /^forgot password$/i }),
    ).toBeInTheDocument();
  });

  it("renders ResetPasswordPage for `/reset-password`", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /set a new password/i }),
    ).toBeInTheDocument();
  });

  it("renders ConfirmEmailPage for `/confirm-email`", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/confirm-email"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /confirm your email/i }),
    ).toBeInTheDocument();
  });

  it("renders RequestEmailConfirmationPage for `/request-email-confirmation`", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/request-email-confirmation"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /resend confirmation email/i }),
    ).toBeInTheDocument();
  });
});
