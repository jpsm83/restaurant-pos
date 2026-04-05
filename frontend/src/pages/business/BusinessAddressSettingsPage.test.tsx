import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { type BusinessProfileDto } from "@/services/business/businessService";
import BusinessAddressSettingsPage from "./BusinessAddressSettingsPage";

const mockDispatch = vi.fn();
const mockUseBusinessProfileQuery = vi.fn();
const mockUseUpdateBusinessProfileMutation = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      user: {
        id: "64b000000000000000000001",
        email: "owner@demo.test",
        type: "business",
      },
      status: "authenticated",
      error: null,
    },
    dispatch: mockDispatch,
  }),
}));

vi.mock("@/services/businessService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/business/businessService")>();
  return {
    ...actual,
    useBusinessProfileQuery: (...args: unknown[]) =>
      mockUseBusinessProfileQuery(...args),
    useUpdateBusinessProfileMutation: (...args: unknown[]) =>
      mockUseUpdateBusinessProfileMutation(...args),
  };
});

vi.mock("@/components/BusinessAddressLocationMap", () => ({
  BusinessAddressLocationMap: ({ addressQuery }: { addressQuery: string }) => (
    <div
      role="region"
      aria-label="Location map mock"
      data-testid="address-location-map-mock"
      data-address-query={addressQuery}
    />
  ),
}));

async function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });
  return renderWithI18n(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

function makeBusinessProfileDto(): BusinessProfileDto {
  return {
    _id: "64b000000000000000000001",
    imageUrl: "",
    tradeName: "Demo Bistro",
    legalName: "Demo Bistro LLC",
    email: "owner@demo.test",
    phoneNumber: "+10000000000",
    taxNumber: "TAX-001",
    subscription: "Free",
    currencyTrade: "USD",
    address: {
      country: "US",
      state: "CA",
      city: "San Diego",
      street: "Main St",
      buildingNumber: "10",
      doorNumber: "",
      complement: "",
      postCode: "92101",
      region: "",
    },
    contactPerson: "",
    cuisineType: ["Italian"],
    categories: ["Pizza"],
    acceptsDelivery: false,
    metrics: {
      foodCostPercentage: 30,
      beverageCostPercentage: 20,
      laborCostPercentage: 30,
      fixedCostPercentage: 20,
      supplierGoodWastePercentage: {
        veryLowBudgetImpact: 9,
        lowBudgetImpact: 7,
        mediumBudgetImpact: 5,
        hightBudgetImpact: 3,
        veryHightBudgetImpact: 1,
      },
    },
    businessOpeningHours: [],
    deliveryOpeningWindows: [],
    reportingConfig: { weeklyReportStartDay: 1 },
  };
}

describe("BusinessAddressSettingsPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockUseBusinessProfileQuery.mockReset();
    mockUseUpdateBusinessProfileMutation.mockReset();
    mockUseUpdateBusinessProfileMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ message: "Business updated" }),
      isPending: false,
    });
  });

  it("renders explicit loading state while profile query is pending", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/address"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/address"
            element={<BusinessAddressSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("status", { name: "Loading business profile..." }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("renders explicit error state and retries on click", async () => {
    const retry = vi.fn();
    mockUseBusinessProfileQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Failed to load business profile."),
      refetch: retry,
    });
    const user = userEvent.setup();

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/address"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/address"
            element={<BusinessAddressSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Could not load profile")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("hydrates address fields and passes a street-first geocode string to the map preview", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/address"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/address"
            element={<BusinessAddressSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Address" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Location preview" })).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toHaveValue("US");
    expect(screen.getByLabelText("Street")).toHaveValue("Main St");

    const map = screen.getByTestId("address-location-map-mock");
    expect(map).toHaveAttribute(
      "data-address-query",
      "Main St, 10, San Diego, CA, 92101, US",
    );
  });

  it("omits profile-only sections so the page stays scoped to postal address", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/address"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/address"
            element={<BusinessAddressSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("Trade name")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Logo" })).not.toBeInTheDocument();
  });
});
