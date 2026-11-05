import { screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { IAuthAccessibleVenue } from "restaurant-pos-packages/interfaces/IAuth";
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

const { mockUseAuth, mockAuthMode, mockVenues } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockAuthMode: {
    mode: "customer" as "customer" | "business" | undefined,
    isLoading: false,
    isError: false,
    setModeAndRefresh: vi.fn(),
  },
  mockVenues: {
    data: [] as IAuthAccessibleVenue[],
    isLoading: false,
    isError: false,
  },
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/context/AuthModeContext", () => ({
  useAuthMode: () => mockAuthMode,
}));

vi.mock("@/services/authVenues", () => ({
  useAccessibleVenuesQuery: () => mockVenues,
}));

vi.mock("@/layouts/BusinessLayout", async () => {
  const { Outlet } = await import("react-router-dom");
  return { default: () => <Outlet /> };
});

vi.mock("@/pages/business/BusinessPeoplePage", () => ({
  default: () => <div data-testid="people-page-stub">People page</div>,
}));

vi.mock("@/pages/notifications/NotificationsInboxPage", () => ({
  default: () => (
    <div data-testid="notifications-page-stub">Notifications page</div>
  ),
}));

describe("App public routing (Phase 1.5.1)", () => {
  beforeEach(() => {
    // Routing is the subject here; keep the real env client id from mounting
    // the Google widget without its provider.
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    mockUseAuth.mockReturnValue({
      state: {
        user: null,
        status: "unauthenticated",
        error: null,
      },
      dispatch: vi.fn(),
    });
    mockAuthMode.mode = "customer";
    mockAuthMode.isLoading = false;
    mockAuthMode.isError = false;
    mockVenues.data = [];
    mockVenues.isLoading = false;
    mockVenues.isError = false;
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

  it("sends anonymous account-surface visits to the shared login entry", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/account/profile"]}>
        <LocationProbe />
        <AppRoutes />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        /^\/login\?returnTo=%2Faccount%2Fprofile$/,
      );
    });
    expect(screen.getByTestId("location")).not.toHaveTextContent(
      /business|audience=/,
    );
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

  it("routes `/business/:businessId/people` for an authenticated User", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        user: { id: "u1", email: "manager@example.com", type: "user" },
        status: "authenticated",
        error: null,
      },
      dispatch: vi.fn(),
    });
    mockAuthMode.mode = "business";
    mockVenues.data = [
      {
        businessId: "507f1f77bcf86cd799439011",
        tradeName: "Alpha Bar",
        source: "membership",
        effectiveLayer: "manager",
        jobRoles: [],
        capabilities: [],
        canEnterBusiness: true,
      },
    ];

    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/business/507f1f77bcf86cd799439011/people"]}
      >
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByTestId("people-page-stub"),
    ).toBeInTheDocument();
  });

  it("routes `/business/:businessId/notifications` for an authenticated User", async () => {
    mockUseAuth.mockReturnValue({
      state: {
        user: { id: "u1", email: "manager@example.com", type: "user" },
        status: "authenticated",
        error: null,
      },
      dispatch: vi.fn(),
    });
    mockAuthMode.mode = "business";
    mockVenues.data = [
      {
        businessId: "507f1f77bcf86cd799439011",
        tradeName: "Alpha Bar",
        source: "membership",
        effectiveLayer: "manager",
        jobRoles: [],
        capabilities: [],
        canEnterBusiness: true,
      },
    ];

    await renderWithI18n(
      <MemoryRouter
        initialEntries={["/business/507f1f77bcf86cd799439011/notifications"]}
      >
        <LocationProbe />
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      await screen.findByTestId("notifications-page-stub"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      /^\/business\/507f1f77bcf86cd799439011\/notifications$/,
    );
  });

  const legalPages = [
    {
      entry: "/legal/privacy",
      heading: { en: /privacy notice/i, es: /aviso de privacidad/i },
    },
    {
      entry: "/legal/terms",
      heading: { en: /account terms/i, es: /términos de la cuenta/i },
    },
  ];
  const legalVisits = [false, true] as const;
  const legalLanguages = ["en", "es"] as const;
  const legalCases = legalVisits.flatMap((authenticated) =>
    legalPages.flatMap((page) =>
      legalLanguages.map((language) => ({
        entry: page.entry,
        heading: page.heading[language],
        authenticated,
        language,
      })),
    ),
  );

  it.each(legalCases)(
    "renders $entry for authenticated=$authenticated in $language",
    async ({ entry, heading, authenticated, language }) => {
      if (authenticated) {
        mockUseAuth.mockReturnValue({
          state: {
            user: { id: "u1", email: "patron@example.com", type: "user" },
            status: "authenticated",
            error: null,
          },
          dispatch: vi.fn(),
        });
      }

      await renderWithI18n(
        <MemoryRouter initialEntries={[entry]}>
          <AppRoutes />
        </MemoryRouter>,
        { language },
      );

      expect(
        await screen.findByRole(
          "heading",
          { level: 1, name: heading },
          { timeout: 10_000 },
        ),
      ).toBeInTheDocument();
    },
    20_000,
  );

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
    const queryClient = new QueryClient();
    await renderWithI18n(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/confirm-email"]}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: /confirm your email/i }),
    ).toBeInTheDocument();
  });

  it.each(["/business/register", "/business/signup"])(
    "sends the retired %s route to plain signup",
    async (entry) => {
      await renderWithI18n(
        <MemoryRouter initialEntries={[entry]}>
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
    },
  );

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
