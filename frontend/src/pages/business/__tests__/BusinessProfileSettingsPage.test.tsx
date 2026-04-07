import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import {
  BusinessServiceError,
  type BusinessProfileDto,
} from "@/services/business/businessService";
import BusinessProfileSettingsPage from "../BusinessProfileSettingsPage";

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

const mockDispatch = vi.fn();
const mockUseBusinessProfileQuery = vi.fn();
const mockUseUpdateBusinessProfileMutation = vi.fn();
const mockLogout = vi.fn();
const mockSetAccessToken = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      user: {
        id: "64b000000000000000000001",
        email: "owner@demo.test",
        type: "business",
        emailVerified: true,
        role: "Tenant",
      },
      status: "authenticated",
      error: null,
    },
    dispatch: mockDispatch,
  }),
}));

const mockResendEmailConfirmation = vi.fn();
const mockRefreshSession = vi.fn();

vi.mock("@/auth/api", () => ({
  logout: (...args: unknown[]) => mockLogout(...args),
  setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
  getAccessToken: () => "test-access-token",
  resendEmailConfirmation: (...args: unknown[]) =>
    mockResendEmailConfirmation(...args),
  refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockFetchManagementContactOptions = vi.fn();

vi.mock("@/services/business/businessService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/business/businessService")>();
  return {
    ...actual,
    useBusinessProfileQuery: (...args: unknown[]) =>
      mockUseBusinessProfileQuery(...args),
    useUpdateBusinessProfileMutation: (...args: unknown[]) =>
      mockUseUpdateBusinessProfileMutation(...args),
    fetchManagementContactOptions: (...args: unknown[]) =>
      mockFetchManagementContactOptions(...args),
  };
});

function makeBusinessProfileDto(): BusinessProfileDto {
  return {
    _id: "64b000000000000000000001",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/logo-demo.png",
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
    emailVerified: true,
  };
}

describe("BusinessProfileSettingsPage (Phase 3.1)", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockUseBusinessProfileQuery.mockReset();
    mockUseUpdateBusinessProfileMutation.mockReset();
    mockLogout.mockReset();
    mockSetAccessToken.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    mockFetchManagementContactOptions.mockReset();
    mockResendEmailConfirmation.mockReset();
    mockRefreshSession.mockReset();
    mockRefreshSession.mockResolvedValue({
      ok: true,
      data: {
        accessToken: "refreshed",
        user: {
          id: "64b000000000000000000001",
          email: "owner@demo.test",
          type: "business",
          emailVerified: true,
          role: "Tenant",
        },
      },
    });
    mockFetchManagementContactOptions.mockResolvedValue([]);
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
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
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
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Could not load profile")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows email confirmed when profile emailVerified is true", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: { ...makeBusinessProfileDto(), emailVerified: true },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Email confirmed")).toBeInTheDocument();
  });

  it("offers resend confirmation when profile emailVerified is false", async () => {
    const refetch = vi.fn().mockResolvedValue({ data: makeBusinessProfileDto() });
    mockResendEmailConfirmation.mockResolvedValue({ ok: true, data: { message: "Sent." } });
    mockUseBusinessProfileQuery.mockReturnValue({
      data: { ...makeBusinessProfileDto(), emailVerified: false },
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    });
    const user = userEvent.setup();

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Click to confirm email" }),
    );
    expect(mockResendEmailConfirmation).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith("Sent.");
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "AUTH_SUCCESS",
      payload: {
        id: "64b000000000000000000001",
        email: "owner@demo.test",
        type: "business",
        emailVerified: true,
        role: "Tenant",
      },
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("hydrates form defaults from the fetched business profile", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Trade name")).toHaveValue("Demo Bistro");
    expect(screen.getByLabelText("Legal name")).toHaveValue("Demo Bistro LLC");
    expect(screen.getByLabelText("Business email")).toHaveValue("owner@demo.test");
    expect(screen.getByLabelText("Phone number")).toHaveValue("+10000000000");
  });

  it("renders profile-only sections and omits other settings slices", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Core business info" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Cuisine type")).toBeInTheDocument();
    expect(screen.queryByText("Subscription")).not.toBeInTheDocument();
    expect(screen.queryByText("Address")).not.toBeInTheDocument();
    expect(screen.queryByText("Metrics")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Subscription plan" })).not.toBeInTheDocument();
  });

  it("uses backend cloud image URL, hides manual URL field, and previews uploaded file state", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();

    const view = await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const logo = screen.getByAltText("Business logo");
    expect(logo).toHaveAttribute(
      "src",
      "https://res.cloudinary.com/demo/image/upload/logo-demo.png",
    );
    expect(screen.queryByLabelText("Image URL")).not.toBeInTheDocument();

    const fileInput = view.container.querySelector(
      "#bp-image-file",
    ) as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    const nextLogo = new File(["mock-image"], "updated-logo.png", {
      type: "image/png",
    });
    await user.upload(fileInput!, nextLogo);
    await waitFor(() => {
      const preview = screen.getByAltText("Business logo");
      expect(preview.getAttribute("src")).toMatch(/^blob:/);
    });
  });

  it("disables save while form is pristine and enables it after changes", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ data: makeBusinessProfileDto() }),
    });
    const user = userEvent.setup();

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const saveButton = screen.getByRole("button", { name: "Save changes" });
    expect(saveButton).toBeDisabled();

    await user.clear(screen.getByLabelText("Trade name"));
    await user.type(screen.getByLabelText("Trade name"), "Demo Bistro Updated");
    expect(saveButton).toBeEnabled();
  });

  it("submits profile changes and shows success toast", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ message: "Business updated" });
    mockUseUpdateBusinessProfileMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ data: makeBusinessProfileDto() }),
    });
    const user = userEvent.setup();

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("Trade name"));
    await user.type(screen.getByLabelText("Trade name"), "Demo Bistro Updated");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith("Business profile saved successfully.");
  });

  it("after successful non-credential save, form display matches refetched server baseline (dirty cleared)", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ message: "Business updated" });
    mockUseUpdateBusinessProfileMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ data: makeBusinessProfileDto() }),
    });
    const user = userEvent.setup();

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const saveButton = screen.getByRole("button", { name: "Save changes" });
    await user.clear(screen.getByLabelText("Trade name"));
    await user.type(screen.getByLabelText("Trade name"), "Demo Bistro Saved");
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Business profile saved successfully.");
    });
    // Refetch mock supplies canonical DTO; displayed values must match server baseline after reset.
    await waitFor(() => {
      expect(screen.getByLabelText("Trade name")).toHaveValue("Demo Bistro");
    });
  });

  it("keeps session and shows re-verification after business email changes on save", async () => {
    const newEmail = "newowner@demo.test";
    const updatedDto: BusinessProfileDto = {
      ...makeBusinessProfileDto(),
      email: newEmail,
      emailVerified: false,
    };
    const profileRef: { current: BusinessProfileDto } = {
      current: makeBusinessProfileDto(),
    };
    const refetch = vi.fn(async () => {
      profileRef.current = updatedDto;
      return { data: updatedDto };
    });
    mockUseBusinessProfileQuery.mockImplementation(() => ({
      get data() {
        return profileRef.current;
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    }));
    const mutateAsync = vi.fn().mockResolvedValue({
      message: "Business updated",
      user: {
        id: "64b000000000000000000001",
        email: newEmail,
        type: "business" as const,
        emailVerified: false,
        role: "Tenant" as const,
      },
    });
    mockUseUpdateBusinessProfileMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    const user = userEvent.setup();

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={<BusinessProfileSettingsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("Business email"));
    await user.type(screen.getByLabelText("Business email"), newEmail);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "AUTH_SUCCESS",
        payload: expect.objectContaining({
          email: newEmail,
          emailVerified: false,
        }),
      });
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Business profile saved successfully.",
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Click to confirm email" }),
      ).toBeInTheDocument();
    });
  });

  it("shows unsaved-changes dialog on dirty navigation and respects stay/leave actions", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ data: makeBusinessProfileDto() }),
    });
    const user = userEvent.setup();

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={
              <div>
                <Link to="/business/64b000000000000000000001/dashboard">Go dashboard</Link>
                <BusinessProfileSettingsPage />
              </div>
            }
          />
          <Route
            path="/business/:businessId/dashboard"
            element={<div>Business dashboard destination</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("Trade name"));
    await user.type(screen.getByLabelText("Trade name"), "Dirty draft");
    await user.click(screen.getByRole("link", { name: "Go dashboard" }));

    expect(
      screen.getByRole("heading", { name: "You have unsaved changes" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stay on page" }));
    expect(screen.queryByText("Business dashboard destination")).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Go dashboard" }));
    await user.click(screen.getByRole("button", { name: "Leave without saving" }));
    expect(screen.getByText("Business dashboard destination")).toBeInTheDocument();
  });

  it("allows navigation without dialog after successful save resets dirty baseline", async () => {
    mockUseBusinessProfileQuery.mockReturnValue({
      data: makeBusinessProfileDto(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue({ data: makeBusinessProfileDto() }),
    });
    const user = userEvent.setup();

    await renderWithQueryClient(
      <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
        <Routes>
          <Route
            path="/business/:businessId/settings/profile"
            element={
              <div>
                <Link to="/business/64b000000000000000000001/dashboard">Go dashboard</Link>
                <BusinessProfileSettingsPage />
              </div>
            }
          />
          <Route
            path="/business/:businessId/dashboard"
            element={<div>Business dashboard destination</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("Trade name"));
    await user.type(screen.getByLabelText("Trade name"), "Saved draft");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Business profile saved successfully.");
    });
    await user.click(screen.getByRole("link", { name: "Go dashboard" }));

    expect(screen.getByText("Business dashboard destination")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "You have unsaved changes" })).not.toBeInTheDocument();
  });

  describe("error paths (Phase 6.3)", () => {
    beforeEach(() => {
      mockUseBusinessProfileQuery.mockReturnValue({
        data: makeBusinessProfileDto(),
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn().mockResolvedValue({ data: makeBusinessProfileDto() }),
      });
    });

    it("surfaces 409 conflict message, error toast, and preserves edits after failed save", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(
        new BusinessServiceError(
          "A business with the same legal name, email, or tax number already exists.",
          409,
        ),
      );
      mockUseUpdateBusinessProfileMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
      });
      const user = userEvent.setup();

      await renderWithQueryClient(
        <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
          <Routes>
            <Route
              path="/business/:businessId/settings/profile"
              element={<BusinessProfileSettingsPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await user.clear(screen.getByLabelText("Trade name"));
      await user.type(screen.getByLabelText("Trade name"), "Edited For Conflict");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Failed to save business profile.");
      });
      expect(
        screen.getByText(
          "A business with the same legal name, email, or tax number already exists.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Trade name")).toHaveValue("Edited For Conflict");
    });

    it("surfaces 401 auth message and preserves edits after failed save", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(
        new BusinessServiceError(
          "Please sign in to save business profile changes.",
          401,
        ),
      );
      mockUseUpdateBusinessProfileMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
      });
      const user = userEvent.setup();

      await renderWithQueryClient(
        <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
          <Routes>
            <Route
              path="/business/:businessId/settings/profile"
              element={<BusinessProfileSettingsPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await user.clear(screen.getByLabelText("Legal name"));
      await user.type(screen.getByLabelText("Legal name"), "Needs Reauth LLC");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Failed to save business profile.");
      });
      expect(
        screen.getByText("Please sign in to save business profile changes."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Legal name")).toHaveValue("Needs Reauth LLC");
    });

    it("surfaces 403 permission message and preserves edits after failed save", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(
        new BusinessServiceError(
          "You do not have permission to update this business profile.",
          403,
        ),
      );
      mockUseUpdateBusinessProfileMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
      });
      const user = userEvent.setup();

      await renderWithQueryClient(
        <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
          <Routes>
            <Route
              path="/business/:businessId/settings/profile"
              element={<BusinessProfileSettingsPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await user.clear(screen.getByLabelText("Phone number"));
      await user.type(screen.getByLabelText("Phone number"), "+19995550123");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Failed to save business profile.");
      });
      expect(
        screen.getByText("You do not have permission to update this business profile."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Phone number")).toHaveValue("+19995550123");
    });

    it("surfaces API validation (400) message and preserves edits after failed save", async () => {
      const mutateAsync = vi.fn().mockRejectedValue(
        new BusinessServiceError("Invalid opening hours: close must be after open.", 400),
      );
      mockUseUpdateBusinessProfileMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
      });
      const user = userEvent.setup();

      await renderWithQueryClient(
        <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
          <Routes>
            <Route
              path="/business/:businessId/settings/profile"
              element={<BusinessProfileSettingsPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await user.clear(screen.getByLabelText("Trade name"));
      await user.type(screen.getByLabelText("Trade name"), "Invalid Hours Bistro");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Failed to save business profile.");
      });
      expect(
        screen.getByText("Invalid opening hours: close must be after open."),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Trade name")).toHaveValue("Invalid Hours Bistro");
    });

    it("surfaces generic failure message on network-style errors and preserves edits", async () => {
      const mutateAsync = vi
        .fn()
        .mockRejectedValue(new Error("Network request failed"));
      mockUseUpdateBusinessProfileMutation.mockReturnValue({
        mutateAsync,
        isPending: false,
      });
      const user = userEvent.setup();

      await renderWithQueryClient(
        <MemoryRouter initialEntries={["/business/64b000000000000000000001/settings/profile"]}>
          <Routes>
            <Route
              path="/business/:businessId/settings/profile"
              element={<BusinessProfileSettingsPage />}
            />
          </Routes>
        </MemoryRouter>,
      );

      await user.clear(screen.getByLabelText("Phone number"));
      await user.type(screen.getByLabelText("Phone number"), "+19995558888");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Failed to save business profile.");
      });
      expect(screen.getByText("Network request failed")).toBeInTheDocument();
      expect(screen.getByLabelText("Phone number")).toHaveValue("+19995558888");
    });
  });
});
