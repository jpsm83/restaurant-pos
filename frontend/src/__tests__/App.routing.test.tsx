import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { renderWithI18n } from "@/test/i18nTestUtils";

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

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

describe("App public routing (Phase 1.5.1)", () => {
  beforeEach(() => {
    // Routing is the subject here; keep the real env client id from mounting
    // the Google widget without its provider.
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("redirects legacy /:userId/customer/* URLs to session-derived paths", async () => {
    await renderWithI18n(
      <MemoryRouter
        initialEntries={[
          "/507f1f77bcf86cd799439011/customer/favorites?tab=all",
        ]}
      >
        <LocationProbe />
        <AppRoutes />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        /^\/login\?returnTo=%2Ffavorites%3Ftab%3Dall$/,
      );
    });
  });

  it("redirects legacy /:userId/employee/* URLs to session-derived paths", async () => {
    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/507f1f77bcf86cd799439011/employee/profile"]}
      >
        <LocationProbe />
        <AppRoutes />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        /^\/login\?returnTo=%2Femployee%2Fprofile$/,
      );
    });
  });

  it("redirects legacy /:userId/mode URLs", async () => {
    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/507f1f77bcf86cd799439011/mode"]}
      >
        <LocationProbe />
        <AppRoutes />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        /^\/login\?returnTo=%2Fmode$/,
      );
    });
  });

  it("renders NotFoundPage for an unknown legacy remainder", async () => {
    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/507f1f77bcf86cd799439011/customer/unknown"]}
      >
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it("renders NotFoundPage for a legacy-looking prefix that is not an ObjectId", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/not-an-object-id/customer/dashboard"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it("renders NotFoundPage for an inherited object key in the legacy remainder", async () => {
    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/507f1f77bcf86cd799439011/customer/constructor"]}
      >
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: /page not found/i }),
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

  it("sends the retired business registration route to plain signup", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business/register"]}>
        <LocationProbe />
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /create account/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/signup$/);
    expect(
      screen.queryByRole("heading", { name: /register your business/i }),
    ).not.toBeInTheDocument();
  });

  it("renders ConfirmEmailChangePage for `/confirm-email-change`", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/confirm-email-change"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /confirm your new email/i }),
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
