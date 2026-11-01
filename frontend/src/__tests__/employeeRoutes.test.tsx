import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import type { IAuthAccessibleVenue } from "restaurant-pos-packages/interfaces/IAuth";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/appRoutes";
import { renderWithI18n } from "@/test/i18nTestUtils";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

const mockUseAuth = vi.fn();
const mockVenues = vi.hoisted(() => ({
  data: [] as IAuthAccessibleVenue[] | undefined,
  isLoading: false,
  isSuccess: true,
  isError: false,
  error: null as Error | null,
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/services/authVenues", () => ({
  useAccessibleVenuesQuery: () => mockVenues,
}));

function venue(
  overrides: Partial<IAuthAccessibleVenue> = {},
): IAuthAccessibleVenue {
  return {
    businessId: "alpha",
    tradeName: "Alpha Bar",
    source: "membership",
    effectiveLayer: "employee",
    jobRoles: [],
    capabilities: [],
    canEnterBusiness: true,
    ...overrides,
  };
}

function signedInUser(businessId = "alpha") {
  mockUseAuth.mockReturnValue({
    state: {
      status: "authenticated",
      user: {
        id: "u1",
        email: "staff@example.com",
        type: "user",
        role: "Employee",
        employeeId: "507f1f77bcf86cd799439011",
        businessId,
      },
      error: null,
    },
    dispatch: vi.fn(),
  });
}

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  return renderWithI18n(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <QueryClientProvider client={client}>
        <AppRoutes />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("retired employee routes", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockVenues.data = [venue()];
    mockVenues.isLoading = false;
    mockVenues.isSuccess = true;
    mockVenues.isError = false;
    mockVenues.error = null;
    signedInUser();
  });

  it("sends /employee/dashboard to the linked venue's Business dashboard", async () => {
    await renderAt("/employee/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/business/alpha/dashboard",
      );
    });
  });

  it("sends a blocked linked venue to the Customer dashboard", async () => {
    signedInUser("blocked");
    mockVenues.data = [
      venue({ businessId: "blocked", tradeName: "Blocked Bar", canEnterBusiness: false }),
      venue({ businessId: "alpha", tradeName: "Alpha Bar" }),
    ];

    await renderAt("/employee/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    });
  });

  it("sends /employee/dashboard to the Customer dashboard when no venue is usable", async () => {
    mockVenues.data = [venue({ canEnterBusiness: false })];

    await renderAt("/employee/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    });
  });

  it("sends /employee/profile to the account Profile", async () => {
    await renderAt("/employee/profile");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/account/profile",
      );
    });
  });

  it("keeps legacy /:userId/employee/dashboard URLs working", async () => {
    await renderAt("/507f1f77bcf86cd799439011/employee/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/business/alpha/dashboard",
      );
    });
  });

  it("keeps legacy /:userId/employee/profile URLs working", async () => {
    await renderAt("/507f1f77bcf86cd799439011/employee/profile");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/account/profile",
      );
    });
  });
});
